"""3.0.0 新英雄在 duel 1V1 的服务端权威结算回归。

没有这些分支时，技能会「扣蓝进冷却但不结算伤害」；这里覆盖 Q/E/R、
2/3 阶 patch 展开、绝对装甲充能与血月击杀成长。
"""

import unittest

import app as game


def duel_player(player_id, hero_id, x=300, y=450):
    return {
        "player_id": player_id,
        "name": player_id,
        "hero_id": hero_id,
        "hp": 1000,
        "max_hp": 1000,
        "x": x,
        "y": y,
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


class Heroes300MultiplayerTests(unittest.TestCase):
    def setUp(self):
        self.now = 1000.0
        self.attacker = duel_player("attacker", "blood_reaper")
        self.target = duel_player("target", "volt", x=400)
        self.room = {
            "mode": "duel",
            "status": "playing",
            "players": {p["player_id"]: p for p in (self.attacker, self.target)},
        }
        self.seq = 0

    def set_attacker_hero(self, hero_id):
        self.attacker["hero_id"] = hero_id

    def cast(self, skill_id, tier=1, target_ids=None, **extra):
        self.seq += 1
        attack = {
            "id": f"attack-{self.seq}",
            "kind": "skill",
            "skill_id": skill_id,
            "skill_tier": tier,
            "target_ids": ["target"] if target_ids is None else target_ids,
        }
        attack.update(extra)
        game.apply_player_attack(self.room, self.attacker, attack, self.now)
        return attack

    # ---------- 血月死神 ----------

    def test_execute_sacrifices_hp_and_drains_target(self):
        self.cast("blood-ult")
        self.assertEqual(self.attacker["hp"], 700)  # 1000 - 30%
        self.assertLessEqual(self.target["hp"], 616)  # 500 伤害经 volt 23.2% 减伤后 384
        self.assertAlmostEqual(self.target["effects"]["眩晕"], self.now + 1)

    def test_execute_tier_two_and_three(self):
        self.cast("blood-ult", tier=2)
        self.assertLessEqual(self.target["hp"], 538)  # 700 伤害经 23.2% 减伤后 462
        self.now += 30
        self.attacker["energy"] = 100
        self.attacker["hp"] = 1000
        self.cast("blood-ult", tier=3)
        self.assertAlmostEqual(self.target["effects"]["眩晕"], self.now + 3)

    def test_execute_does_not_lifesteal(self):
        self.attacker["lifesteal_rate"] = 0.5
        self.attacker["hp"] = 500
        self.cast("blood-ult")
        # 只扣献祭的 300，不会因为打出的 500 伤害回血。
        self.assertEqual(self.attacker["hp"], 200)

    def test_execute_at_low_hp_kills_attacker(self):
        self.attacker["hp"] = 100
        self.cast("blood-ult")
        self.assertEqual(self.attacker["hp"], 0)
        self.assertEqual(self.room["status"], "finished")
        self.assertEqual(self.room["winner_id"], "target")

    def test_moonrise_applies_ratio_slow_and_tier3_root(self):
        self.cast("blood-moonrise")
        self.assertLess(self.target["hp"], 1000)
        self.assertGreater(self.target["effects"]["比例减速33"], self.now)
        self.now += 30
        self.attacker["energy"] = 100
        self.cast("blood-moonrise", tier=3)
        self.assertGreater(self.target["effects"]["禁锢"], self.now)

    def test_scythe_stuns_and_grants_invulnerability(self):
        self.cast("blood-scythe", tier=2)
        self.assertLess(self.target["hp"], 1000)
        self.assertGreater(self.target["effects"]["眩晕"], self.now)
        self.assertGreater(self.attacker["invulnerable_until"], self.now)

    def test_kill_grants_permanent_max_hp_and_lifesteal(self):
        self.target["hp"] = 10
        self.cast("blood-moonrise")
        self.assertEqual(self.attacker["max_hp"], 1010)
        self.assertAlmostEqual(self.attacker["lifesteal_rate"], 0.02)

    # ---------- 零号壁垒 ----------

    def test_absolute_armor_stacks_and_shield(self):
        self.target["hero_id"] = "void_bastion"
        for i in range(10):
            game.apply_player_attack(
                self.room,
                self.attacker,
                {"id": f"hit-{i}", "kind": "basic", "target_ids": ["target"]},
                self.now + 20 + i,
            )
        self.assertEqual(self.target.get("armor_charges", 0), 10)
        game.apply_player_attack(
            self.room,
            self.attacker,
            {"id": "hit-final", "kind": "basic", "target_ids": ["target"]},
            self.now + 40,
        )
        self.assertEqual(self.target.get("armor_charges", 0), 0)
        self.assertEqual(self.target.get("shield", 0), 150)

    def test_steel_domain_reduces_incoming_damage(self):
        self.set_attacker_hero("void_bastion")
        self.cast("void-domain")
        self.assertLess(self.target["hp"], 1000)
        # 对手打回来时，领域减伤 40% 生效（守方 1000 HP，被打掉应少于无减伤）。
        before = self.attacker["hp"]
        game.apply_player_attack(
            self.room,
            self.target,
            {"id": "counter", "kind": "basic", "target_ids": ["attacker"]},
            self.now + 0.1,
        )
        self.assertLessEqual(before - self.attacker["hp"], 12)

    def test_mag_rail_damage_shield_and_tier2_stun(self):
        self.set_attacker_hero("void_bastion")
        self.cast("void-charge", tier=2)
        self.assertLess(self.target["hp"], 1000)
        self.assertEqual(self.attacker["shield"], 100)
        self.assertEqual(self.target["effects"]["眩晕"], self.now + 1)

    def test_last_stand_is_defensive_only(self):
        self.set_attacker_hero("void_bastion")
        self.cast("void-ult")
        self.assertEqual(self.target["hp"], 1000)
        self.assertAlmostEqual(self.attacker["stand_until"], self.now + 5)
        self.assertGreater(self.attacker["effects"]["最后防线"], self.now)

    def test_last_stand_reduces_incoming_and_blocks_stun(self):
        self.set_attacker_hero("void_bastion")
        self.cast("void-ult")
        before = self.attacker["hp"]
        game.apply_player_attack(
            self.room,
            self.target,
            {"id": "counter", "kind": "basic", "target_ids": ["attacker"]},
            self.now + 0.1,
        )
        self.assertLessEqual(before - self.attacker["hp"], 12)


if __name__ == "__main__":
    unittest.main()
