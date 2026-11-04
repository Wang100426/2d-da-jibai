import unittest

import app as game


class ModePickerTests(unittest.TestCase):
    def test_mode_picker_excludes_ai_duel(self):
        response = game.app.test_client().get("/mode")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(b'data-mode-id="duel"', response.data)
        self.assertIn(b'data-mode-id="rogue"', response.data)
        self.assertIn(b'data-mode-id="lan"', response.data)
        self.assertIn(b'data-mode-id="story"', response.data)


if __name__ == "__main__":
    unittest.main()
