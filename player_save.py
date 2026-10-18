"""玩家存档：金币、已解锁英雄与已结算的对局。

- 开发环境写入 `<仓库>/save/profile.json`（已 gitignore，方便随时维护测试存档）。
- PyInstaller 打包后写入 `%LOCALAPPDATA%/2d-da-jibai/save.json`：安装目录通常在
  Program Files 下不可写，写在那里会导致存档失败。
- 设置环境变量 `DAJIBAI_SAVE` 可指定存档路径（自动化测试用）。

存档结构：
    {
      "version": 1,
      "coins": 0,                 # 当前金币
      "infinite_coins": false,    # 测试存档：金币无限，购买不扣钱
      "unlocked_heroes": [],      # 额外解锁的英雄（免费英雄恒解锁，不入档）
      "settled_runs": []          # 已结算的对局编号（同一局只发一次金币）
    }
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
from pathlib import Path

SAVE_VERSION = 1
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
    return profile


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
    """重置存档：清空金币、已解锁英雄与无限金币标记。

    对局编号账本（settled_runs）会保留：它只是防止同一局重复发币的记账，
    清掉它反而可能让人重放旧对局刷金币。
    """
    with _LOCK:
        profile = load()
        fresh = default_profile()
        fresh["settled_runs"] = profile["settled_runs"]
        write(fresh)
        return fresh


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
