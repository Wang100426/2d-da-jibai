"""飞索超人在联机 1V1（duel）里的服务端权威结算。

回归目标：通用派发只发空 target_ids 的技能包，历史上 grapple 三技能会
「扣蓝进冷却但零伤害」。这里覆盖 Q/E/R 三技能、2/3 阶、R 充能与落地包。
"""

import unittest

import app as game


def duel_player(player_id, hero_id="grapple", x=300, y=450):
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


class GrappleMultiplayerTests(unittest.TestCase):
    def setUp(self):
        self.now = 1000.0
        self.attacker = duel_player("attacker")
        self.target = duel_player("target", "volt", x=400)
        self.room = {
            "mode": "duel",
            "status": "playing",
            "players": {p["player_id"]: p for p in (self.attacker, self.target)},
        }
        self.seq = 0

    def cast(self, skill_id, tier=1, target_ids=None, **extra):
        self.seq += 1
        attack = {
            "id": f"attack-{self.seq}",
            "kind": "skill",
            "skill_id": skill_id,
            "skill_tier": tier,
            "target_ids": [] if target_ids is None else target_ids,
        }
        attack.update(extra)
        game.apply_player_attack(self.room, self.attacker, attack, self.now)
        return attack

    def landing(self, x, y, radius=150, tier=1, target_ids=None):
        self.seq += 1
        attack = {
            "id": f"landing-{self.seq}",
            "kind": "grapple_landing",
            "skill_id": "grapple-leap",
            "skill_tier": tier,
            "target_ids": [] if target_ids is None else target_ids,
            "landing_x": x,
            "landing_y": y,
            "landing_radius": radius,
        }
        game.apply_player_attack(self.room, self.attacker, attack, self.now)

    # ---------- 升阶 patch 展开 ----------

    def test_expanded_skill_applies_tier_patches_like_frontend(self):
        skill = game.hero_by_id("grapple")["skills"]
        ult = next(s for s in skill if s["action"] == "grapple_myriad")
        tier2 = game.expanded_skill(ult, 2)
        self.assertEqual(tier2["radius"], 520)  # 400 + 120
        self.assertEqual(tier2["myriad_damage_scale"], 1.25)
        tier3 = game.expanded_skill(ult, 3)
        self.assertEqual(tier3["myriad_pull_duration"], 1.5)
        self.assertEqual(tier3["effect_turns"], 2)  # 1 + 1

        leap = next(s for s in skill if s["action"] == "grapple_leap")
        self.assertEqual(game.expanded_skill(leap, 2)["leap_charges"], 10)
        self.assertEqual(game.expanded_skill(leap, 2)["cooldown"], 0.5)
        self.assertEqual(game.expanded_skill(leap, 1)["leap_charges"], 5)
        # 原始配置没被就地改写
        self.assertEqual(leap["leap_charges"], 5)

    # ---------- Q 万重飞索 ----------

    def test_myriad_empty_target_ids_still_resolves(self):
        self.cast("grapple-ult")
        # 46 基础伤害，对手防御减伤后仍应掉血；眩晕 1 秒（不被通用 *2 放大）
        self.assertLess(self.target["hp"], 1000)
        self.assertAlmostEqual(self.target["effects"]["眩晕"], self.now + 1)
        self.assertEqual(self.attacker["energy"], 35)  # 100 - 65

    def test_myriad_range_is_radius_times_scale(self):
        self.target["x"] = 1000  # 距施法者 700，在 800 内、在通用 400 外
        self.cast("grapple-ult")
        self.assertLess(self.target["hp"], 1000)

    def test_myriad_tier_two_reaches_further_and_hits_harder(self):
        self.target["x"] = 1300  # 距离 1000：1 阶够不到，2 阶 1040 够得到
        self.cast("grapple-ult", tier=1)
        self.assertEqual(self.target["hp"], 1000)
        self.now += 30  # 冷却 22 秒
        self.attacker["energy"] = 100  # 直接调结算函数，不会走 /sync 的能量回复
        self.cast("grapple-ult", tier=2)
        self.assertLess(self.target["hp"], 1000)

    def test_myriad_out_of_range_does_not_hit(self):
        self.target["x"] = 1350  # 距离 1050 > 800
        self.cast("grapple-ult")
        self.assertEqual(self.target["hp"], 1000)

    # ---------- E 飞索·抓 ----------

    def test_hook_reports_path_damage_and_stuns_hooked_target(self):
        self.cast("grapple-hook", target_ids=["target"])
        # 沿途 9 + 落点 22 = 31（减伤前）
        self.assertLess(self.target["hp"], 1000)
        self.assertGreater(self.target["effects"]["眩晕"], self.now)
        self.assertEqual(self.attacker["energy"], 75)  # 100 - 25
        self.assertGreater(self.attacker["invulnerable_until"], self.now)

    def test_hook_without_target_ids_has_no_damage(self):
        # 方向只有前端知道，空包不能靠圆形补全误伤背后的对手
        self.cast("grapple-hook")
        self.assertEqual(self.target["hp"], 1000)

    def test_hook_tier_two_stuns_whole_map_even_out_of_range(self):
        self.target["x"] = 1390  # 远超 hook_range 620
        self.cast("grapple-hook", tier=2)
        self.assertEqual(self.target["hp"], 1000)  # 不受伤害
        self.assertAlmostEqual(self.target["effects"]["眩晕"], self.now + 1.5)
        self.assertEqual(self.attacker["energy"], 75)

    def test_hook_tier_three_inherits_tier_two_global_stun(self):
        self.target["x"] = 1390
        self.cast("grapple-hook", tier=3)
        self.assertAlmostEqual(self.target["effects"]["眩晕"], self.now + 1.5)

    def test_hook_tier_one_has_no_global_stun(self):
        self.target["x"] = 1390
        self.cast("grapple-hook", tier=1)
        self.assertNotIn("眩晕", self.target["effects"])

    # ---------- R 飞索·移 ----------

    def test_leap_ground_hit_uses_landing_point_not_cast_point(self):
        self.target["x"] = 500  # 距施法点 200 > radius 150
        self.cast("grapple-leap")
        self.assertEqual(self.target["hp"], 1000)  # 施法时不该命中
        self.landing(460, 450, radius=150)  # 落在对手旁边
        self.assertLess(self.target["hp"], 1000)
        self.assertGreater(self.target["effects"]["减速"], self.now)

    def test_leap_landing_does_not_charge_energy_or_cooldown_twice(self):
        self.cast("grapple-leap")
        energy = self.attacker["energy"]
        cooldown = self.attacker["skill_cooldowns"]["grapple-leap"]
        self.landing(400, 450, target_ids=["target"])
        self.assertEqual(self.attacker["energy"], energy)
        self.assertEqual(self.attacker["skill_cooldowns"]["grapple-leap"], cooldown)

    def test_leap_grants_invulnerability_for_airborne_duration(self):
        self.cast("grapple-leap")
        self.assertAlmostEqual(self.attacker["invulnerable_until"], self.now + 1)

    def test_leap_charges_recover_over_time(self):
        self.cast("grapple-leap")
        self.assertEqual(self.attacker["grapple_leap_charges"], 4)
        self.now += 3.1  # 恢复 1 次，再放又扣 1 次
        self.attacker["energy"] = 100
        self.cast("grapple-leap")
        self.assertEqual(self.attacker["grapple_leap_charges"], 4)

    def test_leap_empty_charge_still_costs_energy_but_deals_no_damage(self):
        # 人为清空充能（伪造包 / 极端时序）：能量冷却照扣，但不再结算伤害
        self.attacker["grapple_leap_max"] = 5
        self.attacker["grapple_leap_charges"] = 0
        self.attacker["grapple_leap_timer"] = 0
        self.attacker["grapple_leap_tick_at"] = self.now
        hp_before = self.target["hp"]
        self.cast("grapple-leap")
        self.assertEqual(self.target["hp"], hp_before)
        self.assertEqual(self.attacker["energy"], 80)
        self.assertEqual(self.attacker["grapple_leap_charges"], 0)
        # 等满 3 秒恢复 1 次，再放就能命中
        self.now += 3.1
        self.attacker["energy"] = 100
        self.cast("grapple-leap")
        self.assertLess(self.target["hp"], hp_before)

    def test_leap_tier_two_has_ten_charges_and_half_second_cooldown(self):
        self.cast("grapple-leap", tier=2)
        self.assertEqual(self.attacker["grapple_leap_charges"], 9)
        self.assertAlmostEqual(self.attacker["skill_cooldowns"]["grapple-leap"], self.now + 0.5)

    def test_leap_charges_exposed_in_public_snapshot(self):
        self.cast("grapple-leap")
        snapshot = game.public_player(self.attacker)
        self.assertEqual(snapshot["grapple_leap_charges"], 4)

    # ---------- 房间边界 ----------

    def test_coop_room_never_damages_teammates(self):
        self.room["mode"] = "rogue"
        self.cast("grapple-ult")
        self.cast("grapple-hook", tier=2)
        self.assertEqual(self.target["hp"], 1000)
        self.assertEqual(self.target["effects"], {})
        self.assertEqual(self.attacker["energy"], 100)

    def test_duplicate_attack_id_is_ignored(self):
        self.cast("grapple-ult")
        hp = self.target["hp"]
        game.apply_player_attack(
            self.room, self.attacker,
            {"id": "attack-1", "kind": "skill", "skill_id": "grapple-ult",
             "skill_tier": 1, "target_ids": ["target"]},
            self.now,
        )
        self.assertEqual(self.target["hp"], hp)


if __name__ == "__main__":
    unittest.main()
