"""玩家存档：金币、已解锁英雄、装备与已结算的对局。

- 开发环境写入 `<仓库>/save/profile.json`（已 gitignore，方便随时维护测试存档）。
- PyInstaller 打包后写入 `%LOCALAPPDATA%/2d-da-jibai/save.json`：安装目录通常在
  Program Files 下不可写，写在那里会导致存档失败。
- 设置环境变量 `DAJIBAI_SAVE` 可指定存档路径（自动化测试用）。

存档结构：
    {
      "version": 2,
      "coins": 0,                 # 当前金币
      "infinite_coins": false,    # 测试存档：金币无限，购买不扣钱
      "unlocked_heroes": [],      # 额外解锁的英雄（免费英雄恒解锁，不入档）
      "equipment_inventory": [],  # 已拥有的装备列表
      "equipment_loadout": {},    # 当前装配的装备 {slot: equipment_id}
      "settled_runs": []          # 已结算的对局编号（同一局只发一次金币）
    }
"""

from __future__ import annotations

import json
import os
import random
import sys
import tempfile
import threading
from pathlib import Path

SAVE_VERSION = 2
# 结算公式：通过波次 × 10 + 击杀数 × 1，单局上限 500。
COINS_PER_WAVE = 10
COINS_PER_KILL = 1
COINS_RUN_CAP = 500
# 只保留最近若干局的对局编号，避免存档无限膨胀。
SETTLED_HISTORY = 120
# 金币上限，防止手改/导入的存档写出天文数字。
MAX_COINS = 999_999_999
# 测试存档可以把金币直接写成这些词，表示无限金币。
INFINITE_WORDS = {"infinity", "infinite", "inf", "∞", "无限", "무한"}

# 装备系统（1.9.0）
EQUIPMENT_SLOTS = ("weapon", "helmet", "armor", "boots", "accessory")
EQUIPMENT_SLOT_LABELS = {
    "weapon": "武器",
    "helmet": "头盔",
    "armor": "护甲",
    "boots": "靴子",
    "accessory": "饰品",
}
EQUIPMENT_QUALITIES = ("common", "uncommon", "rare", "epic", "legendary")
EQUIPMENT_QUALITY_LABELS = {
    "common": "普通",
    "uncommon": "精良",
    "rare": "稀有",
    "epic": "史诗",
    "legendary": "传说",
}
EQUIPMENT_QUALITY_COLORS = {
    "common": "#d1d5db",
    "uncommon": "#4ade80",
    "rare": "#60a5fa",
    "epic": "#c084fc",
    "legendary": "#facc15",
}
# 品质倍率：白 / 绿 / 蓝 / 紫 / 金
EQUIPMENT_QUALITY_MULTIPLIERS = {"common": 1.0, "uncommon": 1.5, "rare": 2.0, "epic": 2.5, "legendary": 3.0}
# 抽取品质权重（总和不必为 1，内部归一化）
EQUIPMENT_QUALITY_WEIGHTS = {"common": 40, "uncommon": 30, "rare": 20, "epic": 8, "legendary": 2}
# 单抽价格
EQUIPMENT_DRAW_PRICE = 100
# 每件装备的基础属性值（白色），按品质倍率放大
EQUIPMENT_BASE_STATS = {
    "weapon": {"stat": "attack", "value": 5, "label": "攻击"},
    "helmet": {"stat": "defense", "value": 3, "label": "防御"},
    "armor": {"stat": "max_hp", "value": 20, "label": "生命上限"},
    "boots": {"stat": "speed", "value": 5, "label": "移速"},
    "accessory": {"stat": "max_energy", "value": 10, "label": "能量上限"},
}

_LOCK = threading.RLock()


def save_path() -> Path:
    override = os.environ.get("DAJIBAI_SAVE")
    if override:
        return Path(override).expanduser()
    if getattr(sys, "frozen", False):
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return Path(base) / "2d-da-jibai" / "save.json"
    return Path(__file__).resolve().parent / "save" / "profile.json"


def default_profile() -> dict:
    return {
        "version": SAVE_VERSION,
        "coins": 0,
        "infinite_coins": False,
        "unlocked_heroes": [],
        "equipment_inventory": [],
        "equipment_loadout": {slot: None for slot in EQUIPMENT_SLOTS},
        "settled_runs": [],
    }


def _truthy(value) -> bool:
    """宽松判断布尔值：手写存档里的 "true" / "1" / "infinity" 都算真。"""
    if isinstance(value, str):
        return value.strip().lower() in INFINITE_WORDS | {"1", "true", "yes", "on"}
    return bool(value)


def _normalized(raw) -> dict:
    """把任意（可能被手改坏的）存档整理成合法结构。"""
    profile = default_profile()
    if not isinstance(raw, dict):
        return profile
    infinite = _truthy(raw.get("infinite_coins"))
    coins = raw.get("coins")
    if isinstance(coins, str):
        # 手写的测试存档允许直接把金币写成 "infinity"
        if coins.strip().lower() in INFINITE_WORDS:
            infinite = True
        coins = 0
    if isinstance(coins, bool) or not isinstance(coins, (int, float)) or coins != coins:
        coins = 0
    elif coins == float("inf"):
        infinite = True
        coins = 0
    elif coins <= 0:
        coins = 0
    profile["coins"] = min(MAX_COINS, int(coins))
    profile["infinite_coins"] = infinite
    unlocked = raw.get("unlocked_heroes")
    if isinstance(unlocked, list):
        seen = []
        for item in unlocked:
            if isinstance(item, str) and item and item not in seen:
                seen.append(item)
        profile["unlocked_heroes"] = seen
    settled = raw.get("settled_runs")
    if isinstance(settled, list):
        profile["settled_runs"] = [str(item) for item in settled if isinstance(item, str)][-SETTLED_HISTORY:]

    # 装备字段（1.9.0）：兼容旧版存档（无该字段时按空装备处理）
    inventory = raw.get("equipment_inventory")
    if isinstance(inventory, list):
        valid = []
        for item in inventory:
            if not isinstance(item, dict):
                continue
            slot = str(item.get("slot", ""))
            quality = str(item.get("quality", ""))
            if slot not in EQUIPMENT_SLOTS or quality not in EQUIPMENT_QUALITIES:
                continue
            base = EQUIPMENT_BASE_STATS[slot]
            multiplier = EQUIPMENT_QUALITY_MULTIPLIERS[quality]
            value = int(round(base["value"] * multiplier))
            valid.append({
                "id": str(item.get("id", "")).strip() or _equipment_id(),
                "slot": slot,
                "quality": quality,
                "stat": base["stat"],
                "value": value,
                "label": base["label"],
            })
        profile["equipment_inventory"] = valid

    loadout = raw.get("equipment_loadout")
    if isinstance(loadout, dict):
        valid_ids = {item["id"] for item in profile["equipment_inventory"]}
        for slot in EQUIPMENT_SLOTS:
            equip_id = loadout.get(slot)
            profile["equipment_loadout"][slot] = equip_id if equip_id in valid_ids else None
    else:
        # 没有装配数据时，自动把第一件各槽位装备穿上（测试存档友好）
        _auto_equip_first(profile)

    return profile


def _equipment_id() -> str:
    """生成装备唯一 id。"""
    import secrets
    return secrets.token_urlsafe(12)


def _auto_equip_first(profile: dict) -> None:
    """把每个槽位第一件拥有的装备自动装配（用于旧存档迁移）。"""
    for slot in EQUIPMENT_SLOTS:
        if profile["equipment_loadout"].get(slot):
            continue
        for item in profile["equipment_inventory"]:
            if item["slot"] == slot:
                profile["equipment_loadout"][slot] = item["id"]
                break


def write(profile: dict) -> None:
    """原子写入，避免中途崩溃留下半截存档。"""
    path = save_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(profile, ensure_ascii=False, indent=2)
    handle, temporary = tempfile.mkstemp(dir=str(path.parent), prefix=".profile-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except OSError:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def load() -> dict:
    """读取存档；文件不存在或损坏时按默认值重建。"""
    with _LOCK:
        path = save_path()
        raw = None
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raw = None
        profile = _normalized(raw)
        if raw is None or not path.exists():
            try:
                write(profile)
            except OSError:
                pass
        return profile


def run_reward(wave, kills) -> int:
    return max(0, min(COINS_RUN_CAP, int(wave) * COINS_PER_WAVE + int(kills) * COINS_PER_KILL))


def settle_run(run_id: str, wave, kills) -> dict:
    """结算一局。

    同一 `run_id` 只发一次金币：阵亡结算与中途退出结算走同一个编号，
    退出时还会用 sendBeacon 兜底，重复请求会被忽略。
    """
    with _LOCK:
        profile = load()
        if run_id in profile["settled_runs"]:
            return {
                "gained": 0,
                "duplicate": True,
                "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"],
            }
        gained = run_reward(wave, kills)
        profile["coins"] += gained
        profile["settled_runs"] = (profile["settled_runs"] + [run_id])[-SETTLED_HISTORY:]
        write(profile)
        return {
            "gained": gained,
            "duplicate": False,
            "coins": profile["coins"],
            "infinite_coins": profile["infinite_coins"],
        }


def purchase(hero_id: str, price: int) -> dict:
    """购买英雄。测试存档（infinite_coins）不扣金币。"""
    with _LOCK:
        profile = load()
        price = max(0, int(price))
        if hero_id in profile["unlocked_heroes"]:
            return {
                "ok": False,
                "reason": "owned",
                "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"],
            }
        if price > 0 and not profile["infinite_coins"] and profile["coins"] < price:
            return {
                "ok": False,
                "reason": "poor",
                "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"],
            }
        if price > 0 and not profile["infinite_coins"]:
            profile["coins"] -= price
        profile["unlocked_heroes"].append(hero_id)
        write(profile)
        return {
            "ok": True,
            "reason": "",
            "coins": profile["coins"],
            "infinite_coins": profile["infinite_coins"],
        }


def reset() -> dict:
    """重置存档：清空金币、已解锁英雄、装备与无限金币标记。

    对局编号账本（settled_runs）会保留：它只是防止同一局重复发币的记账，
    清掉它反而可能让人重放旧对局刷金币。
    """
    with _LOCK:
        profile = load()
        fresh = default_profile()
        fresh["settled_runs"] = profile["settled_runs"]
        write(fresh)
        return fresh


def _weighted_quality() -> str:
    """按权重随机抽取一个装备品质。"""
    import random
    total = sum(EQUIPMENT_QUALITY_WEIGHTS.values())
    pick = random.randint(1, total)
    cumulative = 0
    for quality, weight in EQUIPMENT_QUALITY_WEIGHTS.items():
        cumulative += weight
        if pick <= cumulative:
            return quality
    return EQUIPMENT_QUALITIES[-1]


def draw_equipment() -> dict:
    """抽取一件随机装备并加入背包，返回该装备信息。"""
    quality = _weighted_quality()
    slot = EQUIPMENT_SLOTS[random.randint(0, len(EQUIPMENT_SLOTS) - 1)]
    base = EQUIPMENT_BASE_STATS[slot]
    multiplier = EQUIPMENT_QUALITY_MULTIPLIERS[quality]
    item = {
        "id": _equipment_id(),
        "slot": slot,
        "quality": quality,
        "stat": base["stat"],
        "value": int(round(base["value"] * multiplier)),
        "label": base["label"],
    }
    return item


def equipment_by_id(profile: dict, equip_id: str):
    """在存档背包中查找指定装备。"""
    for item in profile.get("equipment_inventory", []):
        if item["id"] == equip_id:
            return item
    return None


def purchase_draw() -> dict:
    """支付 EQUIPMENT_DRAW_PRICE 金币抽取一件装备。

    测试存档（infinite_coins）不扣金币。
    """
    with _LOCK:
        profile = load()
        if not profile["infinite_coins"] and profile["coins"] < EQUIPMENT_DRAW_PRICE:
            return {
                "ok": False,
                "reason": "poor",
                "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"],
            }
        if not profile["infinite_coins"]:
            profile["coins"] -= EQUIPMENT_DRAW_PRICE
        item = draw_equipment()
        profile["equipment_inventory"].append(item)
        write(profile)
        return {
            "ok": True,
            "item": item,
            "coins": profile["coins"],
            "infinite_coins": profile["infinite_coins"],
        }


def equip_item(equip_id: str) -> dict:
    """装配指定装备到对应槽位；同槽位旧装备会被替换卸下。"""
    with _LOCK:
        profile = load()
        item = equipment_by_id(profile, equip_id)
        if item is None:
            return {"ok": False, "reason": "not_found", "coins": profile["coins"],
                    "infinite_coins": profile["infinite_coins"]}
        profile["equipment_loadout"][item["slot"]] = item["id"]
        write(profile)
        return {"ok": True, "loadout": profile["equipment_loadout"], "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"]}


def unequip_slot(slot: str) -> dict:
    """卸下指定槽位的装备。"""
    with _LOCK:
        profile = load()
        if slot not in EQUIPMENT_SLOTS:
            return {"ok": False, "reason": "bad_slot", "coins": profile["coins"],
                    "infinite_coins": profile["infinite_coins"]}
        profile["equipment_loadout"][slot] = None
        write(profile)
        return {"ok": True, "loadout": profile["equipment_loadout"], "coins": profile["coins"],
                "infinite_coins": profile["infinite_coins"]}


def delete_equipment(equip_id: str) -> dict:
    """从背包中删除一件装备；若已装配则先卸下。"""
    with _LOCK:
        profile = load()
        item = equipment_by_id(profile, equip_id)
        if item is None:
            return {"ok": False, "reason": "not_found", "coins": profile["coins"],
                    "infinite_coins": profile["infinite_coins"]}
        profile["equipment_inventory"] = [i for i in profile["equipment_inventory"] if i["id"] != equip_id]
        for slot, equipped_id in list(profile["equipment_loadout"].items()):
            if equipped_id == equip_id:
                profile["equipment_loadout"][slot] = None
        write(profile)
        return {"ok": True, "coins": profile["coins"], "infinite_coins": profile["infinite_coins"]}


def calculate_equipment_bonuses(profile: dict | None = None) -> dict:
    """根据当前装配计算战斗属性加成。"""
    if profile is None:
        profile = load()
    bonuses = {"attack": 0, "defense": 0, "max_hp": 0, "speed": 0, "max_energy": 0}
    valid_ids = {item["id"]: item for item in profile.get("equipment_inventory", [])}
    for slot, equip_id in profile.get("equipment_loadout", {}).items():
        item = valid_ids.get(equip_id)
        if item and item["slot"] == slot:
            bonuses[item["stat"]] = bonuses.get(item["stat"], 0) + item["value"]
    return bonuses


def export_text() -> str:
    """导出存档文本（供下载备份）。"""
    with _LOCK:
        return json.dumps(load(), ensure_ascii=False, indent=2) + "\n"


def import_data(raw, allowed_heroes=None) -> dict:
    """导入存档：规范化后覆盖写入，返回新的存档。

    `allowed_heroes` 用于过滤文件里不认识的英雄 id。
    """
    if not isinstance(raw, dict):
        raise ValueError("存档文件内容必须是一个 JSON 对象。")
    profile = _normalized(raw)
    if allowed_heroes is not None:
        allowed = set(allowed_heroes)
        profile["unlocked_heroes"] = [hero for hero in profile["unlocked_heroes"] if hero in allowed]
    with _LOCK:
        write(profile)
        return profile


def import_text(text: str, allowed_heroes=None) -> dict:
    """导入存档文本（例如手动上传的备份文件）。"""
    try:
        raw = json.loads(text)
    except ValueError as error:
        raise ValueError("存档文件不是合法的 JSON。") from error
    return import_data(raw, allowed_heroes)
