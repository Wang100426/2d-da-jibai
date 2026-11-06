import os
import tempfile
import unittest
from unittest.mock import patch

import app as game
import player_save


class UserProfileTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.save_path = os.path.join(self.tempdir.name, "profile.json")
        self.save_patch = patch.dict(os.environ, {"DAJIBAI_SAVE": self.save_path})
        self.save_patch.start()
        player_save.bind_scope("")
        self.client = game.app.test_client()

    def tearDown(self):
        player_save.bind_scope("")
        self.save_patch.stop()
        self.tempdir.cleanup()

    def test_new_and_legacy_saves_require_a_username_before_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/profile/name", response.headers["Location"])
        self.assertEqual(player_save.load()["username"], "")

        self.client.post("/profile/name", data={"username": "玩家 A", "next": "/"})
        home = self.client.get("/")
        self.assertEqual(home.status_code, 200)
        self.assertIn("玩家 A".encode(), home.data)

    def test_username_is_used_for_multiplayer_instead_of_request_name(self):
        player_save.set_username("Saved Name")
        lobby = self.client.get("/multiplayer")
        self.assertEqual(lobby.status_code, 200)
        self.assertIn(b'MP_USERNAME = "Saved Name"', lobby.data)
        self.assertIn(b'readonly', lobby.data)

        created = self.client.post(
            "/api/mp/rooms",
            json={"name": "Forged Name", "mode": "rogue"},
        )
        self.assertEqual(created.status_code, 200)
        self.assertEqual(created.get_json()["room"]["players"][0]["name"], "Saved Name")

    def test_multiplayer_page_renders_explorable_hall_and_invite_controls(self):
        player_save.set_username("Lobby Player")
        for language in ("zh", "en", "ja"):
            lobby = self.client.get(f"/multiplayer?lang={language}")
            self.assertEqual(lobby.status_code, 200)
            self.assertIn(b'id="hall-map"', lobby.data)
            self.assertIn(b'id="arena-object"', lobby.data)
            self.assertIn(b'id="portal-object"', lobby.data)
            self.assertIn(b'id="invite-overlay"', lobby.data)
            self.assertIn(b'id="mp-invitations"', lobby.data)

    def test_home_map_links_each_room_object_to_its_existing_page(self):
        player_save.set_username("Apartment Player")
        home = self.client.get("/")
        self.assertIn(b'data-home-href="/backpack"', home.data)
        self.assertIn(b'data-home-action="save"', home.data)
        self.assertIn(b'data-home-href="/shop"', home.data)
        self.assertIn(b'data-home-href="/story/choose"', home.data)
        self.assertIn(b'data-home-href="/codex"', home.data)
        self.assertIn(b'data-home-action="destinations"', home.data)

        wardrobe = self.client.get("/wardrobe")
        self.assertEqual(wardrobe.status_code, 200)
        self.assertIn("衣柜".encode(), wardrobe.data)

    def test_roguelike_battle_displays_saved_username_above_hero(self):
        player_save.set_username("Battle Name")
        response = self.client.get("/battle?hero=volt")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'playerName: "Battle Name"', response.data)

    def test_import_of_pre_username_save_requests_name_again(self):
        old_profile = player_save._normalized({"version": 2, "coins": 42})
        self.assertEqual(old_profile["coins"], 42)
        self.assertEqual(old_profile["username"], "")


if __name__ == "__main__":
    unittest.main()
