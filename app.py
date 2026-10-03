import copy
import json
import secrets
import socket
import threading
import time
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, send_file, url_for


app = Flask(__name__)
ROOMS = {}
ROOMS_LOCK = threading.RLock()
ROOM_CAPACITY = 8
ROOM_PLAYER_TIMEOUT = 30
MAP_THEMES = ("city", "hospital", "music", "gym", "airport", "school")

LOCALE_DIRECTORY = Path(__file__).resolve().parent / "locale"
ASSET_DIRECTORY = Path(__file__).resolve().parent / "assets"
LOCALE_PACKAGES = {
    language: json.loads((LOCALE_DIRECTORY / f"{language}.json").read_text(encoding="utf-8"))
    for language in ("zh", "en")
}


def get_locale(language):
    return LOCALE_PACKAGES[language if language in LOCALE_PACKAGES else "zh"]


def localized_heroes(language):
    package = get_locale(language)
    tier_labels = package.get("tier_labels", {})
    heroes = copy.deepcopy(HEROES)
    for hero in heroes:
        localized = package["heroes"][hero["id"]]
        hero["name"] = localized["name"]
        hero["class_name"] = localized["class_name"]
        hero["tagline"] = localized["tagline"]
        hero["initial"] = localized["initial"]
        hero["stats"] = dict(zip(localized["stats"], hero["stats"].values()))
        hero["passive"] = {
            "id": hero["passive"]["id"],
            "name": localized["passive"]["name"],
            "description": localized["passive"]["description"],
        }
        for skill in hero["skills"]:
            translation = localized["skills"].get(skill["id"])
            if translation:
                skill.update(translation)
            for tier_effect in skill.get("tier_effects", {}).values():
                if tier_effect["label"] in tier_labels:
                    tier_effect["label"] = tier_labels[tier_effect["label"]]
    return heroes


@app.context_processor
def inject_language():
    lang = request.args.get("lang", request.cookies.get("lang", "zh"))
    if lang not in LOCALE_PACKAGES:
        lang = "zh"
    return {"lang": lang, "locale_pack": get_locale(lang), "tr": lambda key: get_locale(lang)["ui"].get(key, key)}


@app.after_request
def persist_language(response):
    lang = request.args.get("lang")
    if lang in LOCALE_PACKAGES:
        response.set_cookie("lang", lang, max_age=60 * 60 * 24 * 365, samesite="Lax")
    return response


@app.get("/favicon.ico")
def favicon():
    language = request.args.get("lang", request.cookies.get("lang", "zh"))
    icon = "2d_da_jibai_ico_en.ico" if language == "en" else "2d_da_jibai_ico.ico"
    return send_file(ASSET_DIRECTORY / icon, mimetype="image/vnd.microsoft.icon", max_age=3600)


# 英雄机制的唯一配置源。
# 新增英雄时只需在 HEROES 里追加一条记录：调色板走 palette，战斗数值走 combat，
# 技能的 2/3 阶效果走技能自身的 tier_effects。前端不再按 accent 硬编码分支。
HEROES = [
    {
        "id": "volt",
        "name": "霓虹拳王",
        "class_name": "突进斗士",
        "tagline": "贴脸、击飞、再追上去打一拳。",
        "initial": "拳",
        "accent": "pink",
        "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
        "stats": {"攻击": 92, "防御": 58, "机动": 86},
        "combat": {
            "speed": 235,
            "basic_range": 95,
            "basic_damage": 16,
            "basic_effect": "",
            "basic_effect_turns": 0,
            "basic_beam": None,
            "basic_restore_label": "MELEE_RESTORE",
            "bot_skill_effect": "眩晕",
            "bot_skill_effect_turns": 0.8,
            "bot_skill_damage_scale": 2.2,
            "thorns_damage": 0,
        },
        "passive": {
            "id": "volt_limit_break",
            "on_basic_attack": {"attack_speed": 0.05},
            "uncapped": ["attack_speed"],
        },
        "skills": [
            {"id": "volt-ult", "name": "雷霆追猎", "description": "突进最近敌人 · 范围眩晕", "kind": "大招", "target": "enemy", "action": "dash_aoe", "cost": 60, "cooldown": 14, "damage": 38, "radius": 115, "dash_range": 300, "effect": "眩晕", "effect_turns": 2,
             "tier_effects": {2: {"label": "范围眩晕半径 +40", "patch": {"radius": {"add": 40}}},
                              3: {"label": "眩晕时间 +1 秒", "patch": {"effect_turns": {"add": 0.5}}}}},
            {"id": "volt-chain", "name": "震荡重拳", "description": "强化下次普攻 · 击退", "kind": "小技能", "target": "self", "action": "empower_attack", "cost": 20, "cooldown": 7, "damage": 0, "effect": "强化普攻", "effect_turns": 1,
             "tier_effects": {2: {"label": "强化普攻额外伤害 +12", "patch": {"empowered_damage": {"add": 12, "base": 34}}},
                              3: {"label": "强化普攻可波及周围敌人", "patch": {"empowered_splash_radius": {"set": 90}}}}},
            {"id": "volt-overdrive", "name": "破阵冲刺", "description": "朝移动方向冲刺 · 路径伤害", "kind": "小技能", "target": "self", "action": "dash_strike", "cost": 25, "cooldown": 8, "damage": 24, "dash_range": 230, "effect": "", "effect_turns": 0,
             "tier_effects": {2: {"label": "冲刺距离 +45", "patch": {"dash_range": {"add": 45}}},
                              3: {"label": "冲刺伤害提高 30%", "patch": {"damage": {"scale": 1.3}}}}},
        ],
    },
    {
        "id": "moss",
        "name": "苔藓守卫",
        "class_name": "荆棘壁垒",
        "tagline": "把战场变成自己的花园。",
        "initial": "苔",
        "accent": "green",
        "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"},
        "stats": {"攻击": 66, "防御": 94, "机动": 42},
        "combat": {
            "speed": 235,
            "basic_range": 150,
            "basic_damage": 12,
            "basic_effect": "禁锢",
            "basic_effect_turns": 0.8,
            "basic_beam": {"color": "#b7ef55", "duration": 0.25},
            "basic_restore_label": "VINE_RESTORE",
            "bot_skill_effect": "禁锢",
            "bot_skill_effect_turns": 1.2,
            "bot_skill_damage_scale": 1.8,
            "thorns_damage": 12,
        },
        "passive": {
            "id": "moss_gift",
            "init": {"lifesteal": 0.1},
            "on_kill": {"lifesteal": 0.01},
            "uncapped": ["lifesteal"],
        },
        "skills": [
            {"id": "moss-ult", "name": "荆棘花园", "description": "目标区域扎根 · 群体禁锢并回复生命", "kind": "大招", "target": "enemy", "action": "moss_rootfield", "cast_range": 430, "cost": 60, "cooldown": 16, "damage": 32, "radius": 185, "effect": "禁锢", "effect_turns": 3,
             "tier_effects": {2: {"label": "荆棘花园半径 +40", "patch": {"radius": {"add": 40}}},
                              3: {"label": "禁锢时间 +1 秒，回复生命 +15", "patch": {"effect_turns": {"add": 0.5}, "heal_bonus": {"add": 15}}}}},
            {"id": "moss-vine", "name": "树皮壁垒", "description": "获得减伤 · 近战敌人会被荆棘反伤", "kind": "小技能", "target": "self", "action": "moss_barkskin", "cost": 20, "cooldown": 10, "damage": 0, "effect": "荆棘护甲", "effect_turns": 6,
             "tier_effects": {2: {"label": "荆棘壁垒持续时间 +2 秒", "patch": {"effect_turns": {"add": 2}}},
                              3: {"label": "减伤提升，荆棘反伤提高至 20", "player_patch": {"thornDamageMultiplier": {"set": 0.3}, "thornReturnDamage": {"set": 20}}}}},
            {"id": "moss-bark", "name": "孢子绽放", "description": "目标区域爆开 · 持续毒伤", "kind": "小技能", "target": "enemy", "action": "moss_spore", "cast_range": 400, "cost": 30, "cooldown": 9, "damage": 14, "radius": 130, "effect": "中毒", "effect_turns": 5,
             "tier_effects": {2: {"label": "中毒每秒伤害 +4", "patch": {"poison_damage_bonus": {"add": 4}}},
                              3: {"label": "中毒持续时间 +2 秒", "patch": {"effect_turns": {"add": 2}}}}},
        ],
    },
    {
        "id": "luna",
        "name": "月蚀术士",
        "class_name": "月相炮手",
        "tagline": "在安全距离外，把整片夜空砸下来。",
        "initial": "蚀",
        "accent": "blue",
        "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"},
        "stats": {"攻击": 88, "防御": 48, "机动": 79},
        "combat": {
            "speed": 235,
            "basic_range": 300,
            "basic_damage": 15,
            "basic_effect": "",
            "basic_effect_turns": 0,
            "basic_beam": {"color": "#bda5ff", "duration": 0.22},
            "basic_restore_label": "RANGED_RESTORE",
            "bot_skill_effect": "减速",
            "bot_skill_effect_turns": 1.8,
            "bot_skill_damage_scale": 2.2,
            "thorns_damage": 0,
        },
        "passive": {
            "id": "luna_expansion",
            "on_kill": {"basic_range": 5},
            "uncapped": ["basic_range"],
            "every_kills": 20,
            "every_kills_effect": "extra_meteor",
        },
        "skills": [
            {"id": "luna-ult", "name": "新月陨星", "description": "远距离指定落点 · 大范围爆发", "kind": "大招", "target": "enemy", "action": "luna_moonfall", "cast_range": 560, "cost": 65, "cooldown": 17, "damage": 58, "radius": 150, "effect": "眩晕", "effect_turns": 1,
             "tier_effects": {2: {"label": "陨星爆炸半径 +40", "patch": {"radius": {"add": 40}}},
                              3: {"label": "眩晕时间 +1 秒", "patch": {"effect_turns": {"add": 0.5}}}}},
            {"id": "luna-orbit", "name": "弦月穿波", "description": "朝最近敌人射出月刃 · 穿透直线敌人", "kind": "小技能", "target": "enemy", "action": "luna_crescent", "cast_range": 500, "cost": 25, "cooldown": 6, "damage": 27, "dash_range": 480, "effect": "减速", "effect_turns": 3,
             "tier_effects": {2: {"label": "月刃伤害 +10", "patch": {"damage": {"add": 10}}},
                              3: {"label": "月刃飞行距离 +120", "patch": {"dash_range": {"add": 120}}}}},
            {"id": "luna-phase", "name": "月影相移", "description": "沿移动方向闪现 · 获得 30 点护盾", "kind": "小技能", "target": "self", "action": "luna_phase", "cost": 25, "cooldown": 9, "damage": 0, "dash_range": 190, "shield": 30, "effect": "月影护盾", "effect_turns": 4,
             "tier_effects": {2: {"label": "获得护盾 +25", "patch": {"shield": {"add": 25, "base": 30}}},
                              3: {"label": "护盾持续时间 +2 秒", "patch": {"effect_turns": {"add": 2}}}}},
        ],
    },
    {
        "id": "tech",
        "name": "科技男",
        "class_name": "全息游击手",
        "tagline": "用平板、残影和三段冲刺接管战场。",
        "initial": "科",
        "accent": "tech",
        "palette": {"main": "#438dff", "light": "#e1eeff", "dark": "#183c88"},
        "stats": {"攻击": 84, "防御": 58, "机动": 90},
        "combat": {
            "speed": 235,
            "basic_range": 330,
            "basic_damage": 14,
            "basic_effect": "",
            "basic_effect_turns": 0,
            "basic_beam": {"color": "#49e6e0", "duration": 0.24},
            "basic_restore_label": "RANGED_RESTORE",
            "bot_skill_effect": "眩晕",
            "bot_skill_effect_turns": 0.8,
            "bot_skill_damage_scale": 2.2,
            "thorns_damage": 0,
        },
        "passive": {
            "id": "tech_overclock",
            "every_kills": 20,
            "every_kills_effect": "tech_overclock_burst",
            "tech_burst": {"extra_round_trips": 1, "extra_tablets": 1, "ultimate_damage_scale": 1.2},
        },
        "skills": [
            {"id": "tech-ult", "name": "超频突袭", "description": "眩晕普攻范围内敌人 · 朝移动方向冲刺", "kind": "大招", "target": "self", "action": "tech_overdrive", "cost": 60, "cooldown": 16, "damage": 36, "radius": 330, "dash_range": 300, "effect": "眩晕", "effect_turns": 2,
             "tier_effects": {2: {"label": "范围眩晕半径 +40", "patch": {"radius": {"add": 40}}},
                              3: {"label": "眩晕时间 +1 秒", "patch": {"effect_turns": {"add": 0.5}}}}},
            {"id": "tech-tablets", "name": "五屏合击", "description": "五台平板向前飞行 · 200 米处汇聚爆炸", "kind": "小技能", "target": "self", "action": "tech_tablets", "cost": 30, "cooldown": 10, "damage": 18, "radius": 100, "dash_range": 200, "effect": "减速", "effect_turns": 3,
             "tier_effects": {2: {"label": "平板合击爆炸半径 +35", "patch": {"radius": {"add": 35}}},
                              3: {"label": "减速持续时间 +2 秒", "patch": {"effect_turns": {"add": 1}}}}},
            {"id": "tech-afterimage", "name": "残影折返", "description": "留下幻影 · 三次往返瞬移无敌 · 沿途伤害击退", "kind": "小技能", "target": "self", "action": "tech_afterimage", "cost": 35, "cooldown": 12, "damage": 16, "radius": 180, "dash_range": 180, "effect": "", "effect_turns": 0,
             "tier_effects": {2: {"label": "残影冲刺伤害提高 30%", "patch": {"damage": {"scale": 1.3}}},
                              3: {"label": "额外增加一次往返冲刺", "patch": {"extra_round_trips": {"add": 1}}}}},
        ],
    },
    {
        "id": "pipa",
        "name": "琵琶女",
        "class_name": "弦音控场师",
        "tagline": "弦起阳春，埋伏四方，狂舞收场。",
        "initial": "琵",
        "accent": "pipa",
        "palette": {"main": "#f1b95b", "light": "#fff0b8", "dark": "#80552a"},
        "stats": {"攻击": 78, "防御": 66, "机动": 72},
        "combat": {
            "speed": 235,
            "basic_range": 200,
            "basic_damage": 13,
            "basic_effect": "",
            "basic_effect_turns": 0,
            "basic_beam": None,
            "basic_restore_label": "MELEE_RESTORE",
            "bot_skill_effect": "减速",
            "bot_skill_effect_turns": 1.8,
            "bot_skill_damage_scale": 2.2,
            "thorns_damage": 0,
        },
        "passive": {
            "id": "pipa_endless",
            "frenzy_kills": 3,
            "minion_kills": 10,
            "threshold_effect": "extra_minion",
            "minion_bonus": 1,
            "frenzy_duration_bonus": 1,
        },
        "skills": [
            {"id": "pipa-ult", "name": "金蛇狂舞", "description": "重击周围生命值最高的 3 个敌人，并令其狂舞 5 秒", "kind": "大招", "target": "self", "action": "pipa_kinsnake", "cost": 65, "cooldown": 18, "damage": 34, "radius": 360, "effect": "狂舞", "effect_turns": 5,
             "tier_effects": {2: {"label": "狂舞时间 +1 秒", "patch": {"frenzy_duration_bonus": {"add": 1}}},
                              3: {"label": "狂舞目标攻速 +20%", "patch": {"frenzy_attack_speed_bonus": {"add": 0.2}}}}},
            {"id": "pipa-yangchun", "name": "阳春白雪", "description": "攻击最近的 3 个敌人，造成伤害、禁锢 3 秒并按伤害量的 20% 吸血", "kind": "小技能", "target": "self", "action": "pipa_yangchun", "cast_range": 420, "cost": 35, "cooldown": 10, "damage": 28, "radius": 0, "effect": "禁锢", "effect_turns": 3,
             "tier_effects": {2: {"label": "攻击对象 +1", "patch": {"target_count": {"add": 1, "base": 3}}},
                              3: {"label": "禁锢时间 +1 秒", "patch": {"effect_turns": {"add": 1}}}}},
            {"id": "pipa-shimian", "name": "十面埋伏", "description": "召唤 5 名生命值 15 的小兵，自主追击并攻击敌人", "kind": "小技能", "target": "self", "action": "pipa_shimian", "cost": 40, "cooldown": 16, "damage": 0, "radius": 0, "effect": "", "effect_turns": 0,
             "tier_effects": {2: {"label": "小兵生命 +50%", "patch": {"minion_hp_multiplier": {"scale": 1.5, "base": 1, "round": False}}},
                              3: {"label": "小兵数量 +2", "patch": {"minion_count": {"add": 2, "base": 5}}}}},
        ],
    },
    {
        "id": "volt2",
        "name": "电音人",
        "class_name": "声浪打击者",
        "tagline": "把整片战场当成舞池。",
        "initial": "音",
        "accent": "volt2",
        "palette": {"main": "#ff5cf0", "light": "#ffd6fb", "dark": "#7a1f6d"},
        "stats": {"攻击": 86, "防御": 55, "机动": 85},
        "combat": {
            "speed": 245,
            "basic_range": 300,
            "basic_damage": 13,
            "basic_effect": "",
            "basic_effect_turns": 0,
            "basic_beam": {"color": "#ff5cf0", "duration": 0.22},
            "basic_restore_label": "RANGED_RESTORE",
            "bot_skill_effect": "眩晕",
            "bot_skill_effect_turns": 0.8,
            "bot_skill_damage_scale": 2.2,
            "thorns_damage": 0,
        },
        "passive": {
            "id": "volt2_resonance",
            "stack_required": 3,
            "stack_effect": "frenzy",
            "frenzy_turns": 3,
            "frenzy_damage_scale": 1.5,
        },
        "skills": [
            {"id": "volt2-ult", "name": "音浪冲击", "description": "朝移动方向射出音浪 · 造成伤害并击退", "kind": "小技能", "target": "self", "action": "volt2_wave", "cost": 35, "cooldown": 11, "damage": 30, "dash_range": 420, "radius": 130, "effect": "", "effect_turns": 0,
             "tier_effects": {2: {"label": "音浪飞行更远", "patch": {"dash_range": {"add": 130}}},
                              3: {"label": "音浪忽视建筑 · 击中 2 个敌人后爆炸", "patch": {"wave_pierce": {"set": 1}, "wave_max_targets": {"set": 2}}}}},
            {"id": "volt2-empower", "name": "低音震荡", "description": "强化下次普攻 · 伤害 +50% 并附加狂舞", "kind": "小技能", "target": "self", "action": "volt2_empower", "cost": 25, "cooldown": 10, "damage": 0, "effect": "强化普攻", "effect_turns": 1,
             "empowered_damage": 20, "empower_frenzy_turns": 3,
             "tier_effects": {2: {"label": "强化普攻伤害变为 200%", "patch": {"empower_damage_scale": {"scale": 2, "base": 1.5}}},
                              3: {"label": "强化普攻计入被动 · 狂舞延长至 9 秒", "patch": {"empower_counts_as_skill": {"set": 1}}}}},
            {"id": "volt2-disc", "name": "碟片风暴", "description": "向最近的敌人连续投出 10 枚追踪唱片", "kind": "大招", "target": "self", "action": "volt2_discs", "cost": 65, "cooldown": 18, "damage": 16, "radius": 90, "effect": "", "effect_turns": 0,
             "disc_count": 10, "disc_interval": 0.09, "disc_speed": 620, "disc_knockback": 40,
             "tier_effects": {2: {"label": "唱片数量 +4", "patch": {"disc_count": {"add": 4, "base": 10}}},
                              3: {"label": "唱片伤害 +50%", "patch": {"damage": {"scale": 1.5}}}}},
        ],
    },
]


def hero_by_id(hero_id):
    return next((item for item in HEROES if item["id"] == hero_id), HEROES[0])


def hero_roster(language="zh"):
    """注入前端的英雄花名册：id、配色、战斗数值与防御，accent 仅作为 CSS 主题键。"""
    package = get_locale(language)
    roster = []
    for hero in HEROES:
        localized = package["heroes"][hero["id"]]
        combat = dict(hero["combat"])
        combat["basic_hit_message"] = package["battle"]["basic_hit"].get(
            hero["id"], "普攻命中，造成 {damage} 点伤害，回复 5 点能量。"
        )
        passive = dict(hero["passive"])
        passive["name"] = localized["passive"]["name"]
        passive["description"] = localized["passive"]["description"]
        roster.append({
            "id": hero["id"],
            "accent": hero["accent"],
            "initial": localized["initial"],
            "name": localized["name"],
            "palette": hero["palette"],
            "defense": hero["stats"]["防御"],
            "combat": combat,
            "passive": passive,
        })
    return roster


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/select")
def select_hero():
    game_mode = "duel" if request.args.get("mode") == "duel" else "rogue"
    return render_template("select.html", heroes=localized_heroes(request.args.get("lang", request.cookies.get("lang", "zh"))), game_mode=game_mode)


def public_player(player):
    hero = hero_by_id(player["hero_id"])
    effects = {
        name: max(0, round(expires_at - time.time(), 2))
        for name, expires_at in player["effects"].items()
        if expires_at > time.time()
    }
    return {
        "player_id": player["player_id"],
        "name": player["name"],
        "hero_id": hero["id"],
        "hero_name": hero["name"],
        "initial": hero["initial"],
        "accent": hero["accent"],
        "x": player["x"],
        "y": player["y"],
        "hp": player["hp"],
        "max_hp": player["max_hp"],
        "shield": player.get("shield", 0) if effects.get("月影护盾", 0) > 0 else 0,
        "energy": player["energy"],
        "max_energy": player["max_energy"],
        "effects": effects,
        "invulnerable": player["invulnerable_until"] > time.time(),
    }


def player_limits(hero_id):
    combat = hero_by_id(hero_id)["combat"]
    return combat["basic_range"], combat["basic_damage"]


def hero_damage_reduction(hero_id):
    return min(0.6, hero_by_id(hero_id)["stats"]["防御"] / 250)


def active_effect(player, name, now):
    return player["effects"].get(name, 0) > now


def apply_player_attack(room, attacker, attack, now):
    if not isinstance(attack, dict):
        return
    attack_id = str(attack.get("id", ""))[:80]
    if not attack_id or attack_id in attacker["seen_attacks"]:
        return
    if attacker["hp"] <= 0:
        return
    attacker["seen_attacks"][attack_id] = now
    if len(attacker["seen_attacks"]) > 128:
        attacker["seen_attacks"] = {
            key: created for key, created in attacker["seen_attacks"].items()
            if now - created < 30
        }
    attacker["dash_casts"] = {
        key: expires_at for key, expires_at in attacker["dash_casts"].items()
        if expires_at > now
    }
    attack_kind = attack.get("kind")
    dash_action = attack_kind in ("dash_start", "dash_hit")
    if (
        active_effect(attacker, "眩晕", now)
        or (active_effect(attacker, "狂舞", now) and attack_kind != "basic")
        or (attacker["invulnerable_until"] > now and not dash_action)
    ):
        return

    hero = hero_by_id(attacker["hero_id"])
    basic_range, basic_damage = player_limits(attacker["hero_id"])
    skill_id = str(attack.get("skill_id", ""))
    lifesteal_rate = 0
    if attack_kind == "dash_start":
        skill = next((item for item in hero["skills"] if item["id"] == skill_id), None)
        cast_id = str(attack.get("cast_id", ""))
        if attacker["hero_id"] != "tech" or skill_id != "tech-afterimage" or skill is None or not cast_id:
            return
        if attacker["skill_cooldowns"].get(skill_id, 0) > now or attacker["energy"] < skill["cost"]:
            return
        attacker["energy"] -= skill["cost"]
        attacker["skill_cooldowns"][skill_id] = now + skill["cooldown"]
        attacker["dash_casts"][cast_id] = now + 8
        attacker["invulnerable_until"] = max(attacker["invulnerable_until"], now + 2.5)
        return
    if attack_kind == "basic":
        if now - attacker["last_basic_attack"] < 0.5:
            return
        attacker["last_basic_attack"] = now
        attacker["energy"] = min(attacker["max_energy"], attacker["energy"] + 5)
        damage = basic_damage
        if active_effect(attacker, "强化普攻", now):
            damage = max(damage, 34)
            attacker["effects"].pop("强化普攻", None)
        effect = hero["combat"]["basic_effect"]
        effect_duration = hero["combat"]["basic_effect_turns"]
        attack_range = basic_range
    elif attack_kind in ("skill", "dash_hit"):
        skill = next((item for item in hero["skills"] if item["id"] == skill_id), None)
        if skill is None:
            return
        is_dash_hit = attack_kind == "dash_hit"
        cast_id = str(attack.get("cast_id", ""))
        if is_dash_hit:
            if skill_id != "tech-afterimage" or attacker["dash_casts"].get(cast_id, 0) < now:
                return
            attacker["dash_casts"].pop(cast_id, None)
        else:
            cooldowns = attacker["skill_cooldowns"]
            if cooldowns.get(skill_id, 0) > now or attacker["energy"] < skill["cost"]:
                return
            attacker["energy"] -= skill["cost"]
            cooldowns[skill_id] = now + skill["cooldown"]
        damage = skill["damage"]
        effect = skill.get("effect", "")
        if skill.get("action") == "pipa_yangchun":
            lifesteal_rate = 0.2
        if skill.get("action") == "pipa_yangchun":
            effect_duration = 3
        elif skill.get("action") == "pipa_kinsnake":
            effect_duration = 2
        else:
            effect_duration = skill.get("effect_turns", 0) if skill.get("action") in (
                "moss_barkskin", "luna_phase", "empower_attack"
            ) else skill.get("effect_turns", 0) * 2
        attack_range = skill.get("dash_range", 0) * 2 if is_dash_hit else max(
            basic_range,
            skill.get("cast_range", 0) + skill.get("radius", 0),
            skill.get("dash_range", 0) + skill.get("radius", 0),
        )
        if not is_dash_hit and skill.get("action") in ("moss_barkskin", "luna_phase", "empower_attack") and effect and effect_duration > 0:
            attacker["effects"][effect] = max(attacker["effects"].get(effect, 0), now + effect_duration)
            if skill.get("action") == "luna_phase":
                attacker["shield"] = max(attacker.get("shield", 0), skill.get("shield", 30))
        if damage <= 0:
            return
    else:
        return

    target_ids = attack.get("target_ids", [])
    if not isinstance(target_ids, list):
        return
    target_ids = set(str(item) for item in target_ids)
    if active_effect(attacker, "狂舞", now):
        target_ids.intersection_update({attacker["player_id"]})
    else:
        target_ids.discard(attacker["player_id"])
    for target_id in target_ids:
        target = room["players"].get(target_id)
        if target is None or target["hp"] <= 0:
            continue
        if (target["x"] - attacker["x"]) ** 2 + (target["y"] - attacker["y"]) ** 2 > attack_range ** 2:
            continue
        if target["invulnerable_until"] > now:
            continue
        if not active_effect(target, "月影护盾", now):
            target["shield"] = 0
        damage_multiplier = (0.45 if active_effect(target, "荆棘护甲", now) else 1) * (
            1 - hero_damage_reduction(target["hero_id"])
        )
        incoming_damage = max(1, round(damage * damage_multiplier))
        absorbed = min(target.get("shield", 0), incoming_damage)
        target["shield"] = max(0, target.get("shield", 0) - absorbed)
        health_damage = min(target["hp"], incoming_damage - absorbed)
        target["hp"] = max(0, target["hp"] - health_damage)
        if lifesteal_rate:
            attacker["hp"] = min(
                attacker["max_hp"],
                attacker["hp"] + int(health_damage * lifesteal_rate),
            )
        if effect and effect_duration > 0:
            target["effects"][effect] = max(
                target["effects"].get(effect, 0), now + effect_duration
            )
        thorns = hero_by_id(target["hero_id"])["combat"]["thorns_damage"]
        if thorns > 0 and active_effect(target, "荆棘护甲", now):
            attacker["hp"] = max(0, attacker["hp"] - thorns)


def room_snapshot(room):
    return {
        "room_id": room["room_id"],
        "host_id": room["host_id"],
        "status": room["status"],
        "players": [public_player(player) for player in room["players"].values()],
        "capacity": ROOM_CAPACITY,
    }


def find_room_player(room_id, player_id):
    room = ROOMS.get(room_id.upper())
    if room is None:
        return None, None
    return room, room["players"].get(player_id)


def cleanup_rooms():
    now = time.time()
    for room_id, room in list(ROOMS.items()):
        for player_id, player in list(room["players"].items()):
            if now - player["last_seen"] > ROOM_PLAYER_TIMEOUT:
                room["players"].pop(player_id, None)
        if not room["players"]:
            ROOMS.pop(room_id, None)
        elif room["host_id"] not in room["players"]:
            room["host_id"] = next(iter(room["players"]))
        if room["status"] == "waiting" and len(room["players"]) == 1:
            room["status"] = "waiting"


def error_response(message, status=400):
    return jsonify({"ok": False, "error": message}), status


@app.get("/multiplayer")
def multiplayer():
    return render_template("multiplayer.html", heroes=localized_heroes(request.args.get("lang", request.cookies.get("lang", "zh"))))


@app.get("/api/server-info")
def server_info():
    port = int(request.environ.get("SERVER_PORT", "5000"))
    addresses = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 80))
            addresses.add(probe.getsockname()[0])
    except OSError:
        pass
    try:
        for address in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    return jsonify({
        "ok": True,
        "port": port,
        "lan_urls": [f"http://{address}:{port}/multiplayer" for address in sorted(addresses)],
    })


@app.get("/api/mp/rooms")
def list_multiplayer_rooms():
    with ROOMS_LOCK:
        cleanup_rooms()
        rooms = [
            {
                "room_id": room["room_id"],
                "host_name": room["players"].get(room["host_id"], {}).get("name", "未知玩家"),
                "count": len(room["players"]),
                "capacity": ROOM_CAPACITY,
                "status": room["status"],
                "players": [player["name"] for player in room["players"].values()],
            }
            for room in ROOMS.values()
        ]
    return jsonify({"ok": True, "rooms": rooms})


@app.post("/api/mp/rooms")
def create_multiplayer_room():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()[:20]
    hero_id = str(body.get("hero_id", ""))
    if not name:
        return error_response("请先输入昵称。")
    if hero_id not in {hero["id"] for hero in HEROES}:
        return error_response("请选择有效英雄。")
    with ROOMS_LOCK:
        cleanup_rooms()
        room_id = secrets.token_hex(3).upper()
        player_id = secrets.token_urlsafe(18)
        player = {
            "player_id": player_id,
            "name": name,
            "hero_id": hero_id,
            "x": 1600,
            "y": 1200,
            "hp": 100,
            "max_hp": 100,
            "shield": 0,
            "energy": 100,
            "max_energy": 100,
            "effects": {},
            "invulnerable_until": 0,
            "last_basic_attack": 0,
            "skill_cooldowns": {},
            "dash_casts": {},
            "seen_attacks": {},
            "last_seen": time.time(),
        }
        room = {"room_id": room_id, "host_id": player_id, "status": "waiting", "players": {player_id: player}}
        ROOMS[room_id] = room
        snapshot = room_snapshot(room)
    return jsonify({"ok": True, "player_id": player_id, "room": snapshot})


@app.post("/api/mp/rooms/join")
def join_multiplayer_room():
    body = request.get_json(silent=True) or {}
    room_id = str(body.get("room_id", "")).strip().upper()
    name = str(body.get("name", "")).strip()[:20]
    hero_id = str(body.get("hero_id", ""))
    if not name:
        return error_response("请先输入昵称。")
    if hero_id not in {hero["id"] for hero in HEROES}:
        return error_response("请选择有效英雄。")
    with ROOMS_LOCK:
        cleanup_rooms()
        room = ROOMS.get(room_id)
        if room is None:
            return error_response("房间不存在或已关闭。", 404)
        if room["status"] != "waiting":
            return error_response("该房间已经开始游戏。", 409)
        if len(room["players"]) >= ROOM_CAPACITY:
            return error_response("房间人数已满。", 409)
        player_id = secrets.token_urlsafe(18)
        slot = len(room["players"])
        spawn_points = [(1600, 1200), (1650, 1200), (1600, 1250), (1650, 1250),
                        (1550, 1200), (1600, 1150), (1700, 1200), (1600, 1300)]
        x, y = spawn_points[slot]
        room["players"][player_id] = {
            "player_id": player_id,
            "name": name,
            "hero_id": hero_id,
            "x": x,
            "y": y,
            "hp": 100,
            "max_hp": 100,
            "shield": 0,
            "energy": 100,
            "max_energy": 100,
            "effects": {},
            "invulnerable_until": 0,
            "last_basic_attack": 0,
            "skill_cooldowns": {},
            "dash_casts": {},
            "seen_attacks": {},
            "last_seen": time.time(),
        }
        snapshot = room_snapshot(room)
    return jsonify({"ok": True, "player_id": player_id, "room": snapshot})


@app.get("/api/mp/rooms/<room_id>")
def get_multiplayer_room(room_id):
    with ROOMS_LOCK:
        cleanup_rooms()
        room = ROOMS.get(room_id.upper())
        if room is None:
            return error_response("房间不存在或已关闭。", 404)
        return jsonify({"ok": True, "room": room_snapshot(room)})


@app.post("/api/mp/rooms/<room_id>/start")
def start_multiplayer_room(room_id):
    body = request.get_json(silent=True) or {}
    with ROOMS_LOCK:
        cleanup_rooms()
        room, player = find_room_player(room_id, str(body.get("player_id", "")))
        if room is None or player is None:
            return error_response("你已离开房间，请重新加入。", 404)
        if room["host_id"] != player["player_id"]:
            return error_response("只有房主可以开始游戏。", 403)
        if len(room["players"]) < 2:
            return error_response("至少需要两名玩家才能开始。", 409)
        room["status"] = "playing"
        return jsonify({"ok": True, "room": room_snapshot(room)})


@app.post("/api/mp/rooms/<room_id>/leave")
def leave_multiplayer_room(room_id):
    body = request.get_json(silent=True) or {}
    with ROOMS_LOCK:
        room, player = find_room_player(room_id, str(body.get("player_id", "")))
        if room is not None and player is not None:
            room["players"].pop(player["player_id"], None)
            if not room["players"]:
                ROOMS.pop(room["room_id"], None)
            elif room["host_id"] == player["player_id"]:
                room["host_id"] = next(iter(room["players"]))
        return jsonify({"ok": True})


@app.post("/api/mp/rooms/<room_id>/sync")
def sync_multiplayer_room(room_id):
    body = request.get_json(silent=True) or {}
    player_id = str(body.get("player_id", ""))
    try:
        x = float(body.get("x"))
        y = float(body.get("y"))
    except (TypeError, ValueError):
        return error_response("玩家坐标无效。")
    if not (0 <= x <= 3200 and 0 <= y <= 2400):
        return error_response("玩家坐标超出地图范围。")
    with ROOMS_LOCK:
        cleanup_rooms()
        room, player = find_room_player(room_id, player_id)
        if room is None or player is None:
            return error_response("房间已关闭或你已掉线。", 404)
        if room["status"] != "playing":
            return error_response("房间尚未开始。", 409)
        now = time.time()
        player["last_seen"] = now
        player["energy"] = min(player["max_energy"], player["energy"] + max(0, now - player.get("energy_updated_at", now)) * 1.5)
        player["energy_updated_at"] = now
        attacks = body.get("attacks", [])
        if isinstance(attacks, list):
            for attack in attacks[:16]:
                apply_player_attack(room, player, attack, now)
        if (
            player["hp"] > 0
            and not active_effect(player, "眩晕", now)
            and not active_effect(player, "禁锢", now)
            and not active_effect(player, "狂舞", now)
        ):
            player["x"] = x
            player["y"] = y
        others = [public_player(other) for other in room["players"].values() if other["player_id"] != player_id]
        return jsonify({
            "ok": True,
            "players": others,
            "self": public_player(player),
        })


@app.get("/battle")
def battle():
    selected_id = request.args.get("hero", "volt")
    base_player = hero_by_id(selected_id)
    base_defense = base_player["stats"]["防御"]
    player = base_player
    enemy = next(hero for hero in HEROES if hero["id"] != player["id"])
    room_id = request.args.get("room", "").strip().upper()
    player_id = request.args.get("pid", "").strip()
    multiplayer_config = None
    game_mode = "duel" if request.args.get("mode") == "duel" else "rogue"
    map_theme = "city" if game_mode == "duel" else secrets.choice(MAP_THEMES[:-1] if room_id else MAP_THEMES)
    if room_id and player_id:
        with ROOMS_LOCK:
            room, room_player = find_room_player(room_id, player_id)
            if room is None or room_player is None or room["status"] != "playing":
                return redirect(url_for("multiplayer"))
            player = hero_by_id(room_player["hero_id"])
            base_defense = player["stats"]["防御"]
            game_mode = "rogue"
            multiplayer_config = {
                "room_id": room_id,
                "player_id": player_id,
                "x": room_player["x"],
                "y": room_player["y"],
                "hp": room_player["hp"],
                "max_hp": room_player["max_hp"],
                "shield": room_player.get("shield", 0),
                "energy": room_player["energy"],
                "max_energy": room_player["max_energy"],
            }
    lang = request.args.get("lang", request.cookies.get("lang", "zh"))
    player = next(hero for hero in localized_heroes(lang) if hero["id"] == player["id"])
    transition_map_keys = {
        "city": ("MAP_CITY", "MAP_EVENT_CITY"),
        "hospital": ("MAP_HOSPITAL", "MAP_EVENT_HOSPITAL"),
        "music": ("MAP_MUSIC", "MAP_EVENT_MUSIC"),
        "gym": ("MAP_GYM", "MAP_EVENT_GYM"),
        "airport": ("MAP_AIRPORT", "MAP_EVENT_AIRPORT"),
        "school": ("MAP_SCHOOL", "MAP_EVENT_SCHOOL"),
    }
    map_name_key, map_event_key = transition_map_keys[map_theme]
    if game_mode == "duel":
        map_event_key = "MAP_EVENT_DUEL"
    elif multiplayer_config:
        map_event_key = "MAP_EVENT_MULTIPLAYER"
    locale_ui = get_locale(lang)["ui"]
    localized = {hero["id"]: hero for hero in localized_heroes(lang)}
    return render_template(
        "battle.html",
        player=localized[player["id"]],
        enemy=localized[enemy["id"]],
        roster=hero_roster(lang),
        multiplayer=multiplayer_config,
        game_mode=game_mode,
        defense=base_defense,
        map_theme=map_theme,
        transition_map_name=locale_ui[map_name_key],
        transition_event=locale_ui[map_event_key],
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=False, port=5000)
