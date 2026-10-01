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
MAP_THEMES = ("city", "hospital", "music", "gym", "airport")

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
    heroes = copy.deepcopy(HEROES)
    for hero in heroes:
        localized = package["heroes"][hero["id"]]
        hero["name"] = localized["name"]
        hero["class_name"] = localized["class_name"]
        hero["tagline"] = localized["tagline"]
        hero["initial"] = localized["initial"]
        hero["stats"] = dict(zip(localized["stats"], hero["stats"].values()))
        for skill in hero["skills"]:
            translation = localized["skills"].get(skill["id"])
            if translation:
                skill.update(translation)
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


HEROES = [
    {
        "id": "volt",
        "name": "霓虹拳王",
        "class_name": "突进斗士",
        "tagline": "贴脸、击飞、再追上去打一拳。",
        "initial": "拳",
        "accent": "pink",
        "stats": {"攻击": 92, "防御": 58, "机动": 86},
        "skills": [
            {"id": "volt-ult", "name": "雷霆追猎", "description": "突进最近敌人 · 范围眩晕", "kind": "大招", "target": "enemy", "action": "dash_aoe", "cost": 60, "cooldown": 14, "damage": 38, "radius": 115, "dash_range": 300, "effect": "眩晕", "effect_turns": 2},
            {"id": "volt-chain", "name": "震荡重拳", "description": "强化下次普攻 · 击退", "kind": "小技能", "target": "self", "action": "empower_attack", "cost": 20, "cooldown": 7, "damage": 0, "effect": "强化普攻", "effect_turns": 1},
            {"id": "volt-overdrive", "name": "破阵冲刺", "description": "朝移动方向冲刺 · 路径伤害", "kind": "小技能", "target": "self", "action": "dash_strike", "cost": 25, "cooldown": 8, "damage": 24, "dash_range": 230, "effect": "", "effect_turns": 0},
        ],
    },
    {
        "id": "moss",
        "name": "苔藓守卫",
        "class_name": "荆棘壁垒",
        "tagline": "把战场变成自己的花园。",
        "initial": "苔",
        "accent": "green",
        "stats": {"攻击": 66, "防御": 94, "机动": 42},
        "skills": [
            {"id": "moss-ult", "name": "荆棘花园", "description": "目标区域扎根 · 群体禁锢并回复生命", "kind": "大招", "target": "enemy", "action": "moss_rootfield", "cast_range": 430, "cost": 60, "cooldown": 16, "damage": 32, "radius": 185, "effect": "禁锢", "effect_turns": 3},
            {"id": "moss-vine", "name": "树皮壁垒", "description": "获得减伤 · 近战敌人会被荆棘反伤", "kind": "小技能", "target": "self", "action": "moss_barkskin", "cost": 20, "cooldown": 10, "damage": 0, "effect": "荆棘护甲", "effect_turns": 6},
            {"id": "moss-bark", "name": "孢子绽放", "description": "目标区域爆开 · 持续毒伤", "kind": "小技能", "target": "enemy", "action": "moss_spore", "cast_range": 400, "cost": 30, "cooldown": 9, "damage": 14, "radius": 130, "effect": "中毒", "effect_turns": 5},
        ],
    },
    {
        "id": "luna",
        "name": "月蚀术士",
        "class_name": "月相炮手",
        "tagline": "在安全距离外，把整片夜空砸下来。",
        "initial": "蚀",
        "accent": "blue",
        "stats": {"攻击": 88, "防御": 48, "机动": 79},
        "skills": [
            {"id": "luna-ult", "name": "新月陨星", "description": "远距离指定落点 · 大范围爆发", "kind": "大招", "target": "enemy", "action": "luna_moonfall", "cast_range": 560, "cost": 65, "cooldown": 17, "damage": 58, "radius": 150, "effect": "眩晕", "effect_turns": 1},
            {"id": "luna-orbit", "name": "弦月穿波", "description": "朝最近敌人射出月刃 · 穿透直线敌人", "kind": "小技能", "target": "enemy", "action": "luna_crescent", "cast_range": 500, "cost": 25, "cooldown": 6, "damage": 27, "dash_range": 480, "effect": "减速", "effect_turns": 3},
            {"id": "luna-phase", "name": "月影相移", "description": "沿移动方向闪现 · 获得 30 点护盾", "kind": "小技能", "target": "self", "action": "luna_phase", "cost": 25, "cooldown": 9, "damage": 0, "dash_range": 190, "shield": 30, "effect": "月影护盾", "effect_turns": 4},
        ],
    },
    {
        "id": "tech",
        "name": "科技男",
        "class_name": "全息游击手",
        "tagline": "用平板、残影和三段冲刺接管战场。",
        "initial": "科",
        "accent": "tech",
        "stats": {"攻击": 84, "防御": 58, "机动": 90},
        "skills": [
            {"id": "tech-ult", "name": "超频突袭", "description": "眩晕普攻范围内敌人 · 朝移动方向冲刺", "kind": "大招", "target": "self", "action": "tech_overdrive", "cost": 60, "cooldown": 16, "damage": 36, "radius": 330, "dash_range": 300, "effect": "眩晕", "effect_turns": 2},
            {"id": "tech-tablets", "name": "五屏合击", "description": "五台平板向前飞行 · 200 米处汇聚爆炸", "kind": "小技能", "target": "self", "action": "tech_tablets", "cost": 30, "cooldown": 10, "damage": 18, "radius": 100, "dash_range": 200, "effect": "减速", "effect_turns": 3},
            {"id": "tech-afterimage", "name": "残影折返", "description": "留下幻影 · 三次往返瞬移无敌 · 沿途伤害击退", "kind": "小技能", "target": "self", "action": "tech_afterimage", "cost": 35, "cooldown": 12, "damage": 16, "radius": 180, "dash_range": 180, "effect": "", "effect_turns": 0},
        ],
    },
]


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/select")
def select_hero():
    game_mode = "duel" if request.args.get("mode") == "duel" else "rogue"
    return render_template("select.html", heroes=localized_heroes(request.args.get("lang", request.cookies.get("lang", "zh"))), game_mode=game_mode)


def public_player(player):
    hero = next((item for item in HEROES if item["id"] == player["hero_id"]), HEROES[0])
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
    if hero_id == "tech":
        return 330, 14
    if hero_id == "luna":
        return 300, 15
    if hero_id == "moss":
        return 150, 12
    return 95, 16


def hero_damage_reduction(hero_id):
    hero = next((item for item in HEROES if item["id"] == hero_id), HEROES[0])
    return min(0.6, hero["stats"]["防御"] / 250)


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
    if active_effect(attacker, "眩晕", now) or (attacker["invulnerable_until"] > now and not dash_action):
        return

    hero = next(item for item in HEROES if item["id"] == attacker["hero_id"])
    basic_range, basic_damage = player_limits(attacker["hero_id"])
    skill_id = str(attack.get("skill_id", ""))
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
        effect = "禁锢" if attacker["hero_id"] == "moss" else ""
        effect_duration = 0.8
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
    for target_id in set(str(item) for item in target_ids) - {attacker["player_id"]}:
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
        target["hp"] = max(0, target["hp"] - incoming_damage + absorbed)
        if effect and effect_duration > 0:
            target["effects"][effect] = max(
                target["effects"].get(effect, 0), now + effect_duration
            )
        if target["hero_id"] == "moss" and active_effect(target, "荆棘护甲", now):
            attacker["hp"] = max(0, attacker["hp"] - 12)


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
        if player["hp"] > 0 and not active_effect(player, "眩晕", now) and not active_effect(player, "禁锢", now):
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
    base_player = next((hero for hero in HEROES if hero["id"] == selected_id), HEROES[0])
    base_defense = base_player["stats"]["防御"]
    player = base_player
    enemy = next(hero for hero in HEROES if hero["id"] != player["id"])
    room_id = request.args.get("room", "").strip().upper()
    player_id = request.args.get("pid", "").strip()
    multiplayer_config = None
    game_mode = "duel" if request.args.get("mode") == "duel" else "rogue"
    map_theme = "city" if game_mode == "duel" else secrets.choice(MAP_THEMES)
    if room_id and player_id:
        with ROOMS_LOCK:
            room, room_player = find_room_player(room_id, player_id)
            if room is None or room_player is None or room["status"] != "playing":
                return redirect(url_for("multiplayer"))
            player = next(hero for hero in HEROES if hero["id"] == room_player["hero_id"])
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
    }
    map_name_key, map_event_key = transition_map_keys[map_theme]
    if game_mode == "duel":
        map_event_key = "MAP_EVENT_DUEL"
    elif multiplayer_config:
        map_event_key = "MAP_EVENT_MULTIPLAYER"
    locale_ui = get_locale(lang)["ui"]
    return render_template(
        "battle.html",
        player=player,
        enemy=next(hero for hero in localized_heroes(lang) if hero["id"] == enemy["id"]),
        multiplayer=multiplayer_config,
        game_mode=game_mode,
        defense=base_defense,
        map_theme=map_theme,
        transition_map_name=locale_ui[map_name_key],
        transition_event=locale_ui[map_event_key],
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=False, port=5000)
