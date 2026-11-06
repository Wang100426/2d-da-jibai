import unittest

import app as game


class BattleDuelDomTests(unittest.TestCase):
    """战斗页 DOM 契约：前端 requireElement("#wave-title") 是加载期硬要求。

    历史事故：battle.html 曾用 `{% if game_mode != "duel" ... %}` 把整个 wave-status
    包住，duel 模式（本地人机 / 联机 1V1）下 #wave-title 不存在，
    app.js 加载即抛 "Required map element was not found: #wave-title"，战斗页全瘫。
    回归于 2.5.0（加入 LAN duel 时引入），2.7.5 的联机大厅「1V1 人机对战」入口把它引爆。
    """

    def _battle_html(self, url: str) -> str:
        response = game.app.test_client().get(url)
        self.assertEqual(response.status_code, 200)
        return response.data.decode("utf-8")

    def test_roguelike_has_wave_title(self):
        html = self._battle_html("/battle?hero=volt")
        self.assertIn('id="wave-title"', html)
        self.assertNotIn('class="wave-status" hidden', html)

    def test_local_ai_duel_has_wave_title(self):
        """本地人机对决要用 #wave-title 显示比分，所以面板必须显示。"""
        html = self._battle_html("/battle?hero=volt&mode=duel")
        self.assertIn('id="wave-title"', html)
        self.assertNotIn('class="wave-status" hidden', html)
        self.assertIn('id="duel-opponent"', html)

    def test_online_duel_keeps_element_but_hides_panel(self):
        """联机 1V1 没有本地比分，面板隐藏，但元素必须留在 DOM 里。"""
        client = game.app.test_client()
        room = client.post("/api/mp/rooms", json={"name": "A", "mode": "duel"}).get_json()
        room_id = room["room"]["room_id"]
        host = room["player_id"]
        guest = client.post(
            "/api/mp/rooms/join", json={"room_id": room_id, "name": "B", "mode": "duel"}
        ).get_json()["player_id"]

        client.post(f"/api/mp/rooms/{room_id}/start", json={"player_id": host})
        client.post(f"/api/mp/rooms/{room_id}/ready", json={"player_id": host, "ready": True})
        client.post(f"/api/mp/rooms/{room_id}/ready", json={"player_id": guest, "ready": True})
        self.assertEqual(
            client.get(f"/api/mp/rooms/{room_id}").get_json()["room"]["status"], "playing"
        )

        html = self._battle_html(f"/battle?hero=volt&room={room_id}&pid={host}")
        self.assertIn('id="wave-title"', html)
        self.assertIn('class="wave-status" hidden', html)


if __name__ == "__main__":
    unittest.main()
