import os
import unittest

import app as game
import player_save


class ArchiveScopeTests(unittest.TestCase):
    """存档作用域统一入口：本地单文件 / 云端按身份分档。"""

    def setUp(self):
        self._env = {key: os.environ.get(key) for key in ("PORT", "DAJIBAI_CLOUD_ARCHIVE")}
        os.environ.pop("PORT", None)
        os.environ.pop("DAJIBAI_CLOUD_ARCHIVE", None)
        player_save.bind_scope("")

    def tearDown(self):
        for key, value in self._env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        player_save.bind_scope("")

    def test_local_mode_uses_single_file(self):
        self.assertFalse(game.cloud_archive_enabled())
        player_save.bind_scope("")
        self.assertEqual(player_save.current_scope(), "")
        self.assertEqual(player_save.save_path().name, "profile.json")

    def test_local_mode_sends_no_archive_cookie(self):
        client = game.app.test_client()
        client.get("/api/profile")
        self.assertIsNone(client.get_cookie("dajibai_uid"))

    def test_cloud_mode_scopes_by_cookie(self):
        os.environ["PORT"] = "5000"
        self.assertTrue(game.cloud_archive_enabled())
        client = game.app.test_client()
        client.get("/api/profile")
        cookie = client.get_cookie("dajibai_uid")
        self.assertIsNotNone(cookie)
        self.assertTrue(player_save.valid_uid(cookie.value))
        # 再访问一次应复用同一身份，而不是换新档
        client.get("/api/profile")
        self.assertEqual(client.get_cookie("dajibai_uid").value, cookie.value)
        self.assertEqual(player_save.save_path().parent.name, "profiles")
        self.assertEqual(player_save.save_path().name, f"{cookie.value}.json")

    def test_cloud_mode_two_browsers_are_independent(self):
        os.environ["PORT"] = "5000"
        first = game.app.test_client()
        first.get("/api/profile")
        first_uid = first.get_cookie("dajibai_uid").value
        first.post("/api/run/settle", json={"run_id": "scope-a", "wave": 1, "kills": 40})
        coins_first = first.get("/api/profile").get_json()["coins"]

        second = game.app.test_client()
        second.get("/api/profile")
        second_uid = second.get_cookie("dajibai_uid").value
        coins_second = second.get("/api/profile").get_json()["coins"]

        self.assertNotEqual(first_uid, second_uid)
        self.assertGreater(coins_first, 0)
        self.assertEqual(coins_second, 0)

    def test_cloud_mode_rejects_forged_cookie(self):
        os.environ["PORT"] = "5000"
        client = game.app.test_client()
        client.set_cookie("dajibai_uid", "../../../etc/passwd", domain="localhost")
        client.get("/api/profile")
        issued = client.get_cookie("dajibai_uid").value
        self.assertNotEqual(issued, "../../../etc/passwd")
        self.assertTrue(player_save.valid_uid(issued))

    def test_explicit_env_switch_overrides_port(self):
        os.environ["PORT"] = "5000"
        os.environ["DAJIBAI_CLOUD_ARCHIVE"] = "1"
        self.assertTrue(game.cloud_archive_enabled())
        os.environ.pop("DAJIBAI_CLOUD_ARCHIVE")
        os.environ.pop("PORT")
        os.environ["DAJIBAI_CLOUD_ARCHIVE"] = "1"
        self.assertTrue(game.cloud_archive_enabled())


if __name__ == "__main__":
    unittest.main()
