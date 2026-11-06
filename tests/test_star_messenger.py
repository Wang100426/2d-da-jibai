import unittest

import app as game


def duel_player(player_id, hero_id):
    return {
        "player_id": player_id,
        "hero_id": hero_id,
        "hp": 1000,
        "max_hp": 1000,
        "x": 300,
        "y": 450,
        "energy": 100,
        "max_energy": 100,
        "shield": 0,
        "effects": {},
        "seen_attacks": {},
        "dash_casts": {},
        "skill_cooldowns": {},
        "invulnerable_until": 0,
        "last_basic_attack": 0,
    }


class StarMessengerTests(unittest.TestCase):
    def setUp(self):
        self.room = {"mode": "duel", "status": "playing", "players": {}}
        self.attacker = duel_player("attacker", "star_messenger")
        self.target = duel_player("target", "volt")
        self.target["x"] = 340
        self.room["players"] = {
            self.attacker["player_id"]: self.attacker,
            self.target["player_id"]: self.target,
        }

    def test_hero_catalog_has_shop_price_skills_and_three_locales(self):
        hero = game.hero_by_id("star_messenger")
        self.assertEqual(game.hero_price(hero), 2000)
        self.assertEqual(
            [skill["action"] for skill in hero["skills"]],
            ["star_cage", "star_guard", "star_suppression"],
        )
        for language in ("zh", "en", "ja"):
            self.assertIn("star_messenger", game.get_locale(language)["heroes"])

    def test_empowered_basic_attack_stuns_and_slows_and_resets_energy(self):
        now = 1000
        self.attacker["star_energy"] = 6
        self.attacker["last_basic_attack"] = now - 1

        game.apply_player_attack(
            self.room,
            self.attacker,
            {"id": "star-attack", "kind": "basic", "target_ids": ["target"]},
            now,
        )

        self.assertEqual(self.attacker["star_energy"], 0)
        self.assertLess(self.target["hp"], 1000)
        self.assertGreater(self.target["effects"]["眩晕"], now)
        self.assertGreater(self.target["effects"]["减速"], now)

    def test_tier_two_guard_blocks_two_hits_and_grants_energy(self):
        now = 1000
        self.attacker["hero_id"] = "volt"
        self.target["hero_id"] = "star_messenger"
        self.target["skill_cooldowns"] = {}
        self.target["energy"] = 100

        game.apply_player_attack(
            self.room,
            self.target,
            {
                "id": "star-guard",
                "kind": "skill",
                "skill_id": "star-guard",
                "skill_tier": 2,
                "target_ids": [],
            },
            now,
        )
        self.assertEqual(self.target["star_guard_charges"], 2)

        self.attacker["last_basic_attack"] = now - 1
        game.apply_player_attack(
            self.room,
            self.attacker,
            {"id": "guarded-hit", "kind": "basic", "target_ids": ["target"]},
            now + 1,
        )

        self.assertEqual(self.target["hp"], 1000)
        self.assertEqual(self.target["star_guard_charges"], 1)
        self.assertEqual(self.target["star_energy"], 3)


if __name__ == "__main__":
    unittest.main()
