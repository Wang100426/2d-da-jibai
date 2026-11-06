import unittest

import app as game


class MultiplayerModeTests(unittest.TestCase):
    def setUp(self):
        game.ROOMS.clear()
        game.MP_HALL_PLAYERS.clear()
        game.MP_HALL_INVITATIONS.clear()
        self.client = game.app.test_client()

    def tearDown(self):
        game.ROOMS.clear()
        game.MP_HALL_PLAYERS.clear()
        game.MP_HALL_INVITATIONS.clear()

    def create_room(self, mode):
        response = self.client.post(
            "/api/mp/rooms",
            json={"name": "Host", "mode": mode},
        )
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def join_room(self, room_id, mode, name="Guest"):
        return self.client.post(
            "/api/mp/rooms/join",
            json={"room_id": room_id, "name": name, "mode": mode},
        )

    def hall_heartbeat(self, player_id, name, x=500, y=350):
        return self.client.post(
            "/api/mp/hall",
            json={"player_id": player_id, "name": name, "x": x, "y": y},
        )

    def test_hall_presence_and_room_invitations(self):
        host_presence = self.hall_heartbeat("hall-host", "Host").get_json()["self"]
        guest_presence = self.hall_heartbeat("hall-guest", "Guest", 600, 360).get_json()["self"]
        self.assertNotEqual((host_presence["x"], host_presence["y"]), (guest_presence["x"], guest_presence["y"]))

        host_view = self.client.get("/api/mp/hall?player_id=hall-host").get_json()
        self.assertEqual(len(host_view["players"]), 1)
        self.assertEqual(host_view["players"][0]["player_id"], "hall-guest")

        created = self.client.post(
            "/api/mp/rooms",
            json={"name": "Host", "mode": "duel", "hall_player_id": "hall-host"},
        ).get_json()
        room_id = created["room"]["room_id"]
        invitation = self.client.post(
            "/api/mp/hall/invitations",
            json={
                "player_id": "hall-host",
                "target_id": "hall-guest",
                "room_id": room_id,
                "mode": "duel",
            },
        )
        self.assertEqual(invitation.status_code, 200)
        guest_view = self.client.get("/api/mp/hall?player_id=hall-guest").get_json()
        self.assertEqual(guest_view["invitations"][0]["room_id"], room_id)
        self.assertEqual(
            self.client.get("/api/mp/hall?player_id=hall-host").get_json()["invitations"],
            [],
        )

        rejected = self.client.post(
            "/api/mp/hall/invitations",
            json={
                "player_id": "hall-host",
                "target_id": "hall-guest",
                "room_id": room_id,
                "mode": "rogue",
            },
        )
        self.assertEqual(rejected.status_code, 409)

        self.client.delete("/api/mp/hall?player_id=hall-guest")
        self.assertEqual(
            self.client.get("/api/mp/hall?player_id=hall-host").get_json()["players"],
            [],
        )
        self.assertEqual(game.MP_HALL_INVITATIONS, {})

    def test_hall_presence_rejects_missing_identity_and_invalid_coordinates(self):
        missing_identity = self.client.post(
            "/api/mp/hall",
            json={"name": "Guest", "x": 500, "y": 350},
        )
        self.assertEqual(missing_identity.status_code, 400)
        invalid_position = self.hall_heartbeat("hall-invalid", "Guest", 1200, 350)
        self.assertEqual(invalid_position.status_code, 400)

    def start_room(self, room_id, host_id, guest_id):
        started = self.client.post(
            f"/api/mp/rooms/{room_id}/start",
            json={"player_id": host_id},
        )
        self.assertEqual(started.status_code, 200)
        self.client.post(
            f"/api/mp/rooms/{room_id}/ready",
            json={"player_id": host_id, "ready": True},
        )
        ready = self.client.post(
            f"/api/mp/rooms/{room_id}/ready",
            json={"player_id": guest_id, "ready": True},
        )
        self.assertEqual(ready.get_json()["room"]["status"], "playing")

    def test_duel_room_is_capped_at_two_and_rejects_mode_mismatch(self):
        created = self.create_room("duel")
        room_id = created["room"]["room_id"]
        self.assertEqual(created["room"]["mode"], "duel")
        self.assertEqual(created["room"]["capacity"], 2)

        mismatch = self.join_room(room_id, "rogue")
        self.assertEqual(mismatch.status_code, 409)

        guest_response = self.join_room(room_id, "duel")
        self.assertEqual(guest_response.status_code, 200)
        guest_id = guest_response.get_json()["player_id"]
        self.assertEqual(guest_response.get_json()["room"]["capacity"], 2)

        full = self.join_room(room_id, "duel", "Third")
        self.assertEqual(full.status_code, 409)
        self.assertEqual(len(game.ROOMS[room_id]["players"]), 2)
        self.assertNotEqual(
            created["room"]["players"][0]["x"],
            guest_response.get_json()["room"]["players"][1]["x"],
        )
        self.assertEqual(guest_id, guest_response.get_json()["player_id"])

    def test_duel_attack_is_server_settled_and_declares_winner(self):
        created = self.create_room("duel")
        room_id = created["room"]["room_id"]
        host_id = created["player_id"]
        guest_response = self.join_room(room_id, "duel")
        guest_id = guest_response.get_json()["player_id"]
        self.start_room(room_id, host_id, guest_id)

        room = game.ROOMS[room_id]
        host = room["players"][host_id]
        guest = room["players"][guest_id]
        host["x"], host["y"] = 300, 450
        guest["x"], guest["y"] = 340, 450
        guest["hp"] = 1

        result = self.client.post(
            f"/api/mp/rooms/{room_id}/sync",
            json={
                "player_id": host_id,
                "x": host["x"],
                "y": host["y"],
                "attacks": [{
                    "id": "test-basic-hit",
                    "kind": "basic",
                    "target_ids": [guest_id],
                }],
            },
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()["winner_id"], host_id)
        self.assertEqual(room["status"], "finished")
        self.assertEqual(guest["hp"], 0)

    def test_duel_sync_rejects_coordinates_outside_arena(self):
        created = self.create_room("duel")
        room_id = created["room"]["room_id"]
        host_id = created["player_id"]
        guest_response = self.join_room(room_id, "duel")
        guest_id = guest_response.get_json()["player_id"]
        self.start_room(room_id, host_id, guest_id)

        result = self.client.post(
            f"/api/mp/rooms/{room_id}/sync",
            json={"player_id": host_id, "x": 1500, "y": 450},
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(game.ROOMS[room_id]["players"][host_id]["x"], 300)

    def test_duel_battle_page_receives_online_mode_configuration(self):
        created = self.create_room("duel")
        room_id = created["room"]["room_id"]
        host_id = created["player_id"]
        guest_response = self.join_room(room_id, "duel")
        guest_id = guest_response.get_json()["player_id"]
        self.start_room(room_id, host_id, guest_id)

        battle = self.client.get(
            f"/battle?hero=volt&room={room_id}&pid={host_id}",
        )
        self.assertEqual(battle.status_code, 200)
        self.assertIn(b'"mode": "duel"', battle.data)
        self.assertIn(b"arena: true", battle.data)

    def test_leaving_active_duel_awards_other_player_and_cleans_room(self):
        created = self.create_room("duel")
        room_id = created["room"]["room_id"]
        host_id = created["player_id"]
        guest_response = self.join_room(room_id, "duel")
        guest_id = guest_response.get_json()["player_id"]
        self.start_room(room_id, host_id, guest_id)

        left = self.client.post(
            f"/api/mp/rooms/{room_id}/leave",
            json={"player_id": host_id},
        )
        self.assertEqual(left.status_code, 200)
        self.assertEqual(game.ROOMS[room_id]["winner_id"], guest_id)
        self.assertEqual(game.ROOMS[room_id]["status"], "finished")

        remaining = self.client.post(
            f"/api/mp/rooms/{room_id}/sync",
            json={"player_id": guest_id, "x": 1100, "y": 450},
        )
        self.assertEqual(remaining.get_json()["winner_id"], guest_id)
        self.client.post(
            f"/api/mp/rooms/{room_id}/leave",
            json={"player_id": guest_id},
        )
        self.assertNotIn(room_id, game.ROOMS)

    def test_coop_room_ignores_player_attack_packets(self):
        created = self.create_room("rogue")
        room_id = created["room"]["room_id"]
        host_id = created["player_id"]
        guest_response = self.join_room(room_id, "rogue")
        guest_id = guest_response.get_json()["player_id"]
        self.start_room(room_id, host_id, guest_id)

        room = game.ROOMS[room_id]
        host = room["players"][host_id]
        guest = room["players"][guest_id]
        host["x"], host["y"] = 1600, 1200
        guest["x"], guest["y"] = 1640, 1200
        guest["hp"] = 1

        result = self.client.post(
            f"/api/mp/rooms/{room_id}/sync",
            json={
                "player_id": host_id,
                "x": host["x"],
                "y": host["y"],
                "attacks": [{
                    "id": "test-friendly-fire",
                    "kind": "basic",
                    "target_ids": [guest_id],
                }],
            },
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(guest["hp"], 1)
        self.assertIsNone(result.get_json()["winner_id"])


if __name__ == "__main__":
    unittest.main()
