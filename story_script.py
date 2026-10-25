"""剧情模式的数据层（结构与非文本配置；文本全在 locale/story/）。

概念
----
- **重现卡（card）**：玩家在游戏里读到的一个「剧本」，例如 `RC-001 城市之下`。
- **分区（section）**：一张卡拆成的若干段，每段是一份独立的「记忆核心」，
  有自己的节点图与存档。分区按 `order` 顺序**逐段解锁**：打完上一段才能进下一段。

数据与执行的边界
----------------
- 本文件只声明卡、分区、节点与跳转。文案一律走
  `locale/story/<卡编号>.<语言>.json`（`card` + `sections` 两段），
  由 `app.load_story_modules()` 合并进语言包，再由 `localized_chapter()` 对齐节点。
- 执行逻辑在 `frontend/story_engine.ts`（纯逻辑，可单测）。
- 战斗复用 `/battle`，通过 `battle.waves` 刷指定敌人，按 `target_waves` 判胜负并回传结果。
- 地图：`battle.map_theme` 写死就打那张；不写则用 1V1 竞技场（`arena`，1400×900）。

节点类型（全部已实现）
----------------------
`dialogue` / `choice` / `battle` / `objective` / `reward` / `chapter_end`
`objective` 目前是「手动勾选 + 可配置是否阻塞」，尚无击杀/到达的自动追踪。
"""

from copy import deepcopy

# 剧情存档结构版本：结构变了就 +1，旧档会被保守丢弃（详见 player_save）。
STORY_SAVE_VERSION = 1

# 剧情战斗可以锁地图：写 `battle.map_theme` 就用那张；不写则默认 1V1 竞技场。
STORY_ARENA_THEME = "arena"
STORY_MAP_THEMES = ("arena", "city", "hospital", "music", "gym", "airport", "station", "school")
# 地图 id → locale ui 的显示名键（arena 是剧情专属，跟 1V1 共用场地）
MAP_LABEL_KEYS = {
    "arena": "STORY_ARENA_MAP",
    "city": "MAP_CITY",
    "hospital": "MAP_HOSPITAL",
    "music": "MAP_MUSIC",
    "gym": "MAP_GYM",
    "airport": "MAP_AIRPORT",
    "station": "MAP_STATION",
    "school": "MAP_SCHOOL",
}

# 剧情分类：赛博世界剧情 / 英雄剧情
CATEGORIES = [
    {"id": "cyber", "order": 1},
    {"id": "hero", "order": 2},
]

# ── 重现卡 RC-001《城市之下》──────────────────────────────────────────────
# 四个分区，逐段解锁。每个分区是一份独立的记忆核心。
RC001_SECTIONS = [
    {
        "id": "rc001-p0",
        "card": "RC-001",
        "category": "cyber",
        "order": 0,
        "hero": None,
        "background": "home-background.png",
        "entry": "p0-intro",
        "nodes": [
            {"id": "p0-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "序", "accent": "narrator", "next": "p0-ai"},
            {"id": "p0-ai", "type": "dialogue", "speaker_key": "terminal", "initial": "穹", "accent": "terminal",
             "palette": {"main": "#7cd4ff", "light": "#dff3ff", "dark": "#1b4a66"}, "next": "p0-choice"},
            {"id": "p0-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "ask", "next": "p0-ai-ask"},
                {"id": "fix", "next": "p0-ai-fix"},
            ]},
            {"id": "p0-ai-ask", "type": "dialogue", "speaker_key": "terminal", "initial": "穹", "accent": "terminal",
             "palette": {"main": "#7cd4ff", "light": "#dff3ff", "dark": "#1b4a66"}, "next": "p0-battle"},
            {"id": "p0-ai-fix", "type": "dialogue", "speaker_key": "terminal", "initial": "穹", "accent": "terminal",
             "palette": {"main": "#7cd4ff", "light": "#dff3ff", "dark": "#1b4a66"}, "next": "p0-battle"},
            {"id": "p0-battle", "type": "battle",
             "battle": {"hero": None, "target_waves": 2, "map_theme": "school",
                        # 结构化波次：数值在这里，文案在 locale/*.json（按索引合并）
                        "waves": [
                            {"enemies": [{"hero": "tech", "count": 2, "hp_scale": 1.0}],
                             "skills": [{"damage": 16, "cooldown": 8, "effect": "击退",
                                         "effect_turns": 0.4, "radius": 150}]},
                            {"enemies": [{"hero": "tech", "count": 1, "hp_scale": 1.6},
                                         {"hero": "moss", "count": 1, "hp_scale": 1.25,
                                          "damage_scale": 0.9, "speed_scale": 0.85, "armor": 0.2}],
                             "skills": [{"damage": 26, "cooldown": 12, "effect": "眩晕",
                                         "effect_turns": 1, "radius": 170}],
                             "hazard": {"interval": 7, "damage": 8}},
                        ]},
             "on_win": "p0-reward", "on_lose": "p0-battle"},
            {"id": "p0-reward", "type": "reward", "reward_id": "rc001-p0-clear", "coins": 120, "next": "p0-end"},
            {"id": "p0-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "rc001-p1",
        "card": "RC-001",
        "category": "cyber",
        "order": 1,
        "hero": None,
        "background": "home-background.png",
        "entry": "p1-intro",
        "nodes": [
            {"id": "p1-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "一", "accent": "narrator", "next": "p1-station"},
            {"id": "p1-station", "type": "dialogue", "speaker_key": "narrator", "initial": "一", "accent": "narrator", "next": "p1-choice"},
            {"id": "p1-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "scan", "next": "p1-objective"},
                {"id": "down", "next": "p1-warn"},
            ]},
            {"id": "p1-warn", "type": "dialogue", "speaker_key": "narrator", "initial": "一", "accent": "narrator", "next": "p1-objective"},
            {"id": "p1-objective", "type": "objective", "goals": [
                {"id": "coords", "done_flag": "coords_confirmed"},
                {"id": "signal", "done_flag": "signal_located"},
            ], "allow_skip": False, "next": "p1-battle"},
            {"id": "p1-battle", "type": "battle",
             "battle": {"hero": None, "target_waves": 2, "map_theme": "station",
                        "waves": [
                            {"enemies": [{"hero": "tech", "count": 2, "hp_scale": 1.0}],
                             "skills": [{"damage": 14, "cooldown": 10, "effect": "禁锢",
                                         "effect_turns": 2, "radius": 220}]},
                            {"enemies": [{"hero": "tech", "count": 1, "hp_scale": 1.5},
                                         {"hero": "volt", "count": 1, "damage_scale": 1.25,
                                          "speed_scale": 1.05}],
                             "skills": [{"damage": 24, "cooldown": 9, "effect": "眩晕",
                                         "effect_turns": 1, "radius": 140}]},
                        ]},
             "on_win": "p1-archive", "on_lose": "p1-battle"},
            {"id": "p1-archive", "type": "dialogue", "speaker_key": "narrator", "initial": "档", "accent": "narrator", "next": "p1-reward"},
            {"id": "p1-reward", "type": "reward", "reward_id": "rc001-p1-clear", "coins": 150, "next": "p1-end"},
            {"id": "p1-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "rc001-p2",
        "card": "RC-001",
        "category": "cyber",
        "order": 2,
        "hero": None,
        "background": "home-background.png",
        "entry": "p2-intro",
        "nodes": [
            {"id": "p2-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "二", "accent": "narrator", "next": "p2-db"},
            {"id": "p2-db", "type": "dialogue", "speaker_key": "terminal", "initial": "穹", "accent": "terminal",
             "palette": {"main": "#7cd4ff", "light": "#dff3ff", "dark": "#1b4a66"}, "next": "p2-stranger"},
            {"id": "p2-stranger", "type": "dialogue", "speaker_key": "stranger", "initial": "？", "accent": "stranger",
             "palette": {"main": "#c9a0ff", "light": "#f0e4ff", "dark": "#4a2f6b"}, "next": "p2-choice"},
            {"id": "p2-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "trust", "next": "p2-battle"},
                {"id": "press", "next": "p2-press"},
            ]},
            {"id": "p2-press", "type": "dialogue", "speaker_key": "stranger", "initial": "？", "accent": "stranger",
             "palette": {"main": "#c9a0ff", "light": "#f0e4ff", "dark": "#4a2f6b"}, "next": "p2-battle"},
            {"id": "p2-battle", "type": "battle",
             "battle": {"hero": None, "target_waves": 2, "map_theme": "gym",
                        "waves": [
                            {"enemies": [{"hero": "moss", "count": 2, "hp_scale": 1.2, "speed_scale": 0.9}],
                             "skills": [{"damage": 20, "cooldown": 11, "effect": "击退",
                                         "effect_turns": 0.5, "radius": 150}],
                             "hazard": {"interval": 8, "damage": 6}},
                            {"enemies": [{"hero": "jianghu", "count": 1, "hp_scale": 1.8, "damage_scale": 1.3},
                                         {"hero": "moss", "count": 1, "hp_scale": 1.3, "armor": 0.25}],
                             "skills": [{"damage": 38, "cooldown": 14, "effect": "斩杀",
                                         "radius": 130}]},
                        ]},
             "on_win": "p2-after", "on_lose": "p2-battle"},
            {"id": "p2-after", "type": "dialogue", "speaker_key": "narrator", "initial": "二", "accent": "narrator", "next": "p2-reward"},
            {"id": "p2-reward", "type": "reward", "reward_id": "rc001-p2-clear", "coins": 180, "next": "p2-end"},
            {"id": "p2-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "rc001-p3",
        "card": "RC-001",
        "category": "cyber",
        "order": 3,
        "hero": None,
        "background": "home-background.png",
        "entry": "p3-intro",
        "nodes": [
            {"id": "p3-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "终", "accent": "narrator", "next": "p3-archive"},
            {"id": "p3-archive", "type": "dialogue", "speaker_key": "narrator", "initial": "档", "accent": "narrator", "next": "p3-battle"},
            {"id": "p3-battle", "type": "battle",
             "battle": {"hero": None, "target_waves": 3, "map_theme": "hospital",
                        "waves": [
                            {"enemies": [{"hero": "tech", "count": 2, "hp_scale": 1.4}],
                             "skills": [{"damage": 22, "cooldown": 9, "effect": "击退",
                                         "effect_turns": 0.5, "radius": 160}],
                             "hazard": {"interval": 9, "damage": 7}},
                            {"enemies": [{"hero": "volt2", "count": 1, "hp_scale": 1.6},
                                         {"hero": "tech", "count": 1, "damage_scale": 1.15}],
                             "skills": [{"damage": 28, "cooldown": 12, "effect": "减速",
                                         "effect_turns": 3, "radius": 200}]},
                            {"enemies": [{"hero": "luna", "count": 1, "hp_scale": 2.0, "damage_scale": 1.4},
                                         {"hero": "tech", "count": 1, "hp_scale": 1.2, "armor": 0.3}],
                             "skills": [{"damage": 52, "cooldown": 18, "effect": "击退",
                                         "effect_turns": 0.6, "radius": 240}],
                             "hazard": {"interval": 6, "damage": 10}},
                        ]},
             "on_win": "p3-reveal", "on_lose": "p3-battle"},
            {"id": "p3-reveal", "type": "dialogue", "speaker_key": "narrator", "initial": "终", "accent": "narrator", "next": "p3-truth"},
            {"id": "p3-truth", "type": "dialogue", "speaker_key": "stranger", "initial": "？", "accent": "stranger",
             "palette": {"main": "#c9a0ff", "light": "#f0e4ff", "dark": "#4a2f6b"}, "next": "p3-last"},
            {"id": "p3-last", "type": "dialogue", "speaker_key": "narrator", "initial": "终", "accent": "narrator", "next": "p3-choice"},
            {"id": "p3-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "keep", "next": "p3-reward-keep"},
                {"id": "burn", "next": "p3-reward-burn"},
            ]},
            {"id": "p3-reward-keep", "type": "reward", "reward_id": "rc001-p3-keep", "coins": 260, "next": "p3-end-keep"},
            {"id": "p3-end-keep", "type": "chapter_end", "next": None},
            {"id": "p3-reward-burn", "type": "reward", "reward_id": "rc001-p3-burn", "coins": 260, "next": "p3-end-burn"},
            {"id": "p3-end-burn", "type": "chapter_end", "next": None},
        ],
    },
]

# 英雄剧情：绑定英雄，暂为单段（不拆分区）
def _wave(enemies, skills, hazard=None):
    """英雄剧情的小工具：少写点重复的 dict 字面量。"""
    wave = {"enemies": enemies, "skills": skills}
    if hazard is not None:
        wave["hazard"] = hazard
    return wave


def _enemy(hero, count=1, hp=1.0, dmg=1.0, speed=1.0, armor=0.0):
    return {"hero": hero, "count": count, "hp_scale": hp,
            "damage_scale": dmg, "speed_scale": speed, "armor": armor}


def _skill(damage, cooldown, effect="", turns=0.0, radius=150):
    return {"damage": damage, "cooldown": cooldown, "effect": effect,
            "effect_turns": turns, "radius": radius}


def _battle_node(node_id, hero, map_theme, waves, on_win):
    return {"id": node_id, "type": "battle",
            "battle": {"hero": hero, "target_waves": len(waves),
                       "map_theme": map_theme, "waves": waves},
            "on_win": on_win, "on_lose": node_id}


HERO_SECTIONS = [
    # ── RC-H01 拳王的旧账（volt）────────────────────────────────────────────
    {
        "id": "hero-volt-01",
        "card": "RC-H01",
        "category": "hero",
        "order": 0,
        "hero": "volt",
        "background": "home-background.png",
        "entry": "h1-intro",
        "nodes": [
            {"id": "h1-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "雨", "accent": "narrator", "next": "h1-hero"},
            {"id": "h1-hero", "type": "dialogue", "speaker_key": "hero", "initial": "拳", "accent": "volt",
             "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"}, "next": "h1-choice"},
            {"id": "h1-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "listen", "next": "h1-talk"},
                {"id": "gloves", "next": "h1-glove"},
            ]},
            {"id": "h1-talk", "type": "dialogue", "speaker_key": "pipa", "initial": "琵", "accent": "pipa",
             "palette": {"main": "#f1b95b", "light": "#fff0b8", "dark": "#80552a"}, "next": "h1-battle"},
            {"id": "h1-glove", "type": "dialogue", "speaker_key": "hero", "initial": "拳", "accent": "volt",
             "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"}, "next": "h1-battle"},
            {"id": "h1-battle", "type": "battle",
             "battle": {"hero": "volt", "target_waves": 2, "map_theme": "gym",
                        "waves": [
                            {"enemies": [{"hero": "pipa", "count": 1, "speed_scale": 0.95}],
                             "skills": [{"damage": 16, "cooldown": 10, "effect": "禁锢",
                                         "effect_turns": 3, "radius": 220}]},
                            {"enemies": [{"hero": "jianghu", "count": 1, "hp_scale": 1.6, "damage_scale": 1.2}],
                             "skills": [{"damage": 40, "cooldown": 14, "effect": "斩杀",
                                         "radius": 130}]},
                        ]},
             "on_win": "h1-after", "on_lose": "h1-battle"},
            {"id": "h1-after", "type": "dialogue", "speaker_key": "narrator", "initial": "雨", "accent": "narrator", "next": "h1-reward"},
            {"id": "h1-reward", "type": "reward", "reward_id": "hero-volt-01-clear", "coins": 150, "next": "h1-end"},
            {"id": "h1-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-volt-02",
        "card": "RC-H01",
        "category": "hero",
        "order": 1,
        "hero": "volt",
        "background": "home-background.png",
        "entry": "h2-intro",
        "nodes": [
            {"id": "h2-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "账", "accent": "narrator", "next": "h2-hero"},
            {"id": "h2-hero", "type": "dialogue", "speaker_key": "hero", "initial": "拳", "accent": "volt",
             "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"}, "next": "h2-choice"},
            {"id": "h2-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "ledger", "next": "h2-ledger"},
                {"id": "boss", "next": "h2-battle"},
            ]},
            {"id": "h2-ledger", "type": "dialogue", "speaker_key": "narrator", "initial": "账", "accent": "narrator", "next": "h2-battle"},
            _battle_node("h2-battle", "volt", "gym", [
                _wave([_enemy("tech", 2, hp=1.2)], [_skill(20, 10, "眩晕", 1, 150)]),
                _wave([_enemy("volt2", 1, hp=1.7), _enemy("tech", 1, hp=1.1, armor=0.2)],
                      [_skill(26, 12, "减速", 3, 200)]),
            ], "h2-after"),
            {"id": "h2-after", "type": "dialogue", "speaker_key": "narrator", "initial": "账", "accent": "narrator", "next": "h2-reward"},
            {"id": "h2-reward", "type": "reward", "reward_id": "hero-volt-02-clear", "coins": 170, "next": "h2-end"},
            {"id": "h2-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-volt-03",
        "card": "RC-H01",
        "category": "hero",
        "order": 2,
        "hero": "volt",
        "background": "home-background.png",
        "entry": "h3-intro",
        "nodes": [
            {"id": "h3-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "影", "accent": "narrator", "next": "h3-hero"},
            {"id": "h3-hero", "type": "dialogue", "speaker_key": "hero", "initial": "拳", "accent": "volt",
             "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"}, "next": "h3-choice"},
            {"id": "h3-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "stage", "next": "h3-stage"},
                {"id": "flip", "next": "h3-battle"},
            ]},
            {"id": "h3-stage", "type": "dialogue", "speaker_key": "boss", "initial": "板", "accent": "boss",
             "palette": {"main": "#ff9f4a", "light": "#ffe0bd", "dark": "#7a3d12"}, "next": "h3-battle"},
            _battle_node("h3-battle", "volt", "gym", [
                _wave([_enemy("tech", 2, hp=1.3)], [_skill(22, 9, "击退", 0.4, 160)]),
                _wave([_enemy("volt", 1, hp=2.0, dmg=1.35)], [_skill(36, 13, "眩晕", 1, 130)]),
            ], "h3-after"),
            {"id": "h3-after", "type": "dialogue", "speaker_key": "narrator", "initial": "影", "accent": "narrator", "next": "h3-reward"},
            {"id": "h3-reward", "type": "reward", "reward_id": "hero-volt-03-clear", "coins": 200, "next": "h3-end"},
            {"id": "h3-end", "type": "chapter_end", "next": None},
        ],
    },
    # ── RC-H02 苔藓的根（moss）─────────────────────────────────────────────
    {
        "id": "hero-moss-01",
        "card": "RC-H02",
        "category": "hero",
        "order": 0,
        "hero": "moss",
        "background": "home-background.png",
        "entry": "m1-intro",
        "nodes": [
            {"id": "m1-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "藤", "accent": "narrator", "next": "m1-hero"},
            {"id": "m1-hero", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m1-choice"},
            {"id": "m1-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "seed", "next": "m1-seed"},
                {"id": "log", "next": "m1-log"},
            ]},
            {"id": "m1-seed", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m1-objective"},
            {"id": "m1-log", "type": "dialogue", "speaker_key": "terminal", "initial": "穹", "accent": "terminal",
             "palette": {"main": "#7cd4ff", "light": "#dff3ff", "dark": "#1b4a66"}, "next": "m1-objective"},
            {"id": "m1-objective", "type": "objective", "goals": [
                {"id": "seed", "done_flag": "seed_saved"},
                {"id": "pump", "done_flag": "pump_cut"},
            ], "allow_skip": False, "next": "m1-battle"},
            {"id": "m1-battle", "type": "battle",
             "battle": {"hero": "moss", "target_waves": 2, "map_theme": "hospital",
                        "waves": [
                            {"enemies": [{"hero": "tech", "count": 2, "hp_scale": 1.1}],
                             "skills": [{"damage": 18, "cooldown": 9, "effect": "击退",
                                         "effect_turns": 0.4, "radius": 160}]},
                            {"enemies": [{"hero": "moss", "count": 1, "hp_scale": 1.8, "armor": 0.3},
                                         {"hero": "tech", "count": 1, "damage_scale": 1.1}],
                             "skills": [{"damage": 22, "cooldown": 11, "effect": "禁锢",
                                         "effect_turns": 2, "radius": 180}],
                             "hazard": {"interval": 8, "damage": 6}},
                        ]},
             "on_win": "m1-after", "on_lose": "m1-battle"},
            {"id": "m1-after", "type": "dialogue", "speaker_key": "narrator", "initial": "藤", "accent": "narrator", "next": "m1-reward"},
            {"id": "m1-reward", "type": "reward", "reward_id": "hero-moss-01-clear", "coins": 160, "next": "m1-end"},
            {"id": "m1-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-moss-02",
        "card": "RC-H02",
        "category": "hero",
        "order": 1,
        "hero": "moss",
        "background": "home-background.png",
        "entry": "m2-intro",
        "nodes": [
            {"id": "m2-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "根", "accent": "narrator", "next": "m2-hero"},
            {"id": "m2-hero", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m2-choice"},
            {"id": "m2-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "root", "next": "m2-root"},
                {"id": "backup", "next": "m2-battle"},
            ]},
            {"id": "m2-root", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m2-battle"},
            _battle_node("m2-battle", "moss", "station", [
                _wave([_enemy("tech", 2, hp=1.2)], [_skill(22, 9, "击退", 0.5, 160)]),
                _wave([_enemy("moss", 1, hp=1.9, armor=0.35), _enemy("tech", 1, hp=1.1)],
                      [_skill(24, 11, "禁锢", 2, 180)], {"interval": 8, "damage": 6}),
            ], "m2-after"),
            {"id": "m2-after", "type": "dialogue", "speaker_key": "narrator", "initial": "根", "accent": "narrator", "next": "m2-reward"},
            {"id": "m2-reward", "type": "reward", "reward_id": "hero-moss-02-clear", "coins": 180, "next": "m2-end"},
            {"id": "m2-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-moss-03",
        "card": "RC-H02",
        "category": "hero",
        "order": 2,
        "hero": "moss",
        "background": "home-background.png",
        "entry": "m3-intro",
        "nodes": [
            {"id": "m3-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "芽", "accent": "narrator", "next": "m3-hero"},
            {"id": "m3-hero", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m3-choice"},
            {"id": "m3-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "open", "next": "m3-open"},
                {"id": "bury", "next": "m3-battle"},
            ]},
            {"id": "m3-open", "type": "dialogue", "speaker_key": "hero", "initial": "苔", "accent": "moss",
             "palette": {"main": "#b7ef55", "light": "#e9ffb7", "dark": "#426b2e"}, "next": "m3-battle"},
            _battle_node("m3-battle", "moss", "school", [
                _wave([_enemy("tech", 2, hp=1.4)], [_skill(24, 10, "减速", 2, 180)]),
                _wave([_enemy("moss", 1, hp=2.2, dmg=1.2, armor=0.4), _enemy("tech", 1, hp=1.2)],
                      [_skill(38, 14, "斩杀", 0, 130)], {"interval": 7, "damage": 8}),
            ], "m3-after"),
            {"id": "m3-after", "type": "dialogue", "speaker_key": "narrator", "initial": "芽", "accent": "narrator", "next": "m3-reward"},
            {"id": "m3-reward", "type": "reward", "reward_id": "hero-moss-03-clear", "coins": 220, "next": "m3-end"},
            {"id": "m3-end", "type": "chapter_end", "next": None},
        ],
    },
    # ── RC-H03 月蚀之夜（luna）─────────────────────────────────────────────
    {
        "id": "hero-luna-01",
        "card": "RC-H03",
        "category": "hero",
        "order": 0,
        "hero": "luna",
        "background": "home-background.png",
        "entry": "l1-intro",
        "nodes": [
            {"id": "l1-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "蚀", "accent": "narrator", "next": "l1-hero"},
            {"id": "l1-hero", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l1-choice"},
            {"id": "l1-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "shut", "next": "l1-shut"},
                {"id": "take", "next": "l1-take"},
            ]},
            {"id": "l1-shut", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l1-battle"},
            {"id": "l1-take", "type": "dialogue", "speaker_key": "stranger", "initial": "？", "accent": "stranger",
             "palette": {"main": "#c9a0ff", "light": "#f0e4ff", "dark": "#4a2f6b"}, "next": "l1-battle"},
            {"id": "l1-battle", "type": "battle",
             "battle": {"hero": "luna", "target_waves": 2, "map_theme": "arena",
                        "waves": [
                            {"enemies": [{"hero": "tech", "count": 2, "hp_scale": 1.2}],
                             "skills": [{"damage": 20, "cooldown": 9, "effect": "减速",
                                         "effect_turns": 2, "radius": 200}]},
                            {"enemies": [{"hero": "luna", "count": 1, "hp_scale": 1.8, "damage_scale": 1.3},
                                         {"hero": "tech", "count": 1, "hp_scale": 1.1, "armor": 0.2}],
                             "skills": [{"damage": 34, "cooldown": 13, "effect": "击退",
                                         "effect_turns": 0.5, "radius": 240}],
                             "hazard": {"interval": 7, "damage": 7}},
                        ]},
             "on_win": "l1-after", "on_lose": "l1-battle"},
            {"id": "l1-after", "type": "dialogue", "speaker_key": "narrator", "initial": "蚀", "accent": "narrator", "next": "l1-reward"},
            {"id": "l1-reward", "type": "reward", "reward_id": "hero-luna-01-clear", "coins": 180, "next": "l1-end"},
            {"id": "l1-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-luna-02",
        "card": "RC-H03",
        "category": "hero",
        "order": 1,
        "hero": "luna",
        "background": "home-background.png",
        "entry": "l2-intro",
        "nodes": [
            {"id": "l2-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "梦", "accent": "narrator", "next": "l2-hero"},
            {"id": "l2-hero", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l2-choice"},
            {"id": "l2-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "follow", "next": "l2-follow"},
                {"id": "save", "next": "l2-battle"},
            ]},
            {"id": "l2-follow", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l2-battle"},
            _battle_node("l2-battle", "luna", "music", [
                _wave([_enemy("pipa", 1, hp=1.5)], [_skill(18, 10, "禁锢", 3, 220)]),
                _wave([_enemy("volt2", 1, hp=1.8, dmg=1.2), _enemy("tech", 1, hp=1.2)],
                      [_skill(28, 12, "减速", 3, 200)]),
            ], "l2-after"),
            {"id": "l2-after", "type": "dialogue", "speaker_key": "narrator", "initial": "梦", "accent": "narrator", "next": "l2-reward"},
            {"id": "l2-reward", "type": "reward", "reward_id": "hero-luna-02-clear", "coins": 200, "next": "l2-end"},
            {"id": "l2-end", "type": "chapter_end", "next": None},
        ],
    },
    {
        "id": "hero-luna-03",
        "card": "RC-H03",
        "category": "hero",
        "order": 2,
        "hero": "luna",
        "background": "home-background.png",
        "entry": "l3-intro",
        "nodes": [
            {"id": "l3-intro", "type": "dialogue", "speaker_key": "narrator", "initial": "落", "accent": "narrator", "next": "l3-hero"},
            {"id": "l3-hero", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l3-choice"},
            {"id": "l3-choice", "type": "choice", "prompt_key": "prompt", "options": [
                {"id": "give", "next": "l3-give"},
                {"id": "burn", "next": "l3-battle"},
            ]},
            {"id": "l3-give", "type": "dialogue", "speaker_key": "hero", "initial": "月", "accent": "luna",
             "palette": {"main": "#8c9aff", "light": "#e0e4ff", "dark": "#414f9e"}, "next": "l3-battle"},
            _battle_node("l3-battle", "luna", "airport", [
                _wave([_enemy("tech", 2, hp=1.5)], [_skill(24, 9, "减速", 2, 200)]),
                _wave([_enemy("luna", 1, hp=2.2, dmg=1.4), _enemy("tech", 1, hp=1.3, armor=0.25)],
                      [_skill(42, 14, "击退", 0.6, 240)], {"interval": 6, "damage": 9}),
            ], "l3-after"),
            {"id": "l3-after", "type": "dialogue", "speaker_key": "narrator", "initial": "落", "accent": "narrator", "next": "l3-reward"},
            {"id": "l3-reward", "type": "reward", "reward_id": "hero-luna-03-clear", "coins": 240, "next": "l3-end"},
            {"id": "l3-end", "type": "chapter_end", "next": None},
        ],
    },
]

CHAPTERS = RC001_SECTIONS + HERO_SECTIONS

NODE_TYPES = ("dialogue", "choice", "battle", "objective", "reward", "chapter_end")


def chapters_of(category: str) -> list:
    return [chapter for chapter in CHAPTERS if chapter["category"] == category]


def chapter_by_id(chapter_id: str):
    for chapter in CHAPTERS:
        if chapter["id"] == chapter_id:
            return chapter
    return None


def chapter_cards() -> list:
    """按卡聚合，返回 [(card_id, [section...])]，分区已按 order 排序。"""
    grouped = {}
    for chapter in CHAPTERS:
        grouped.setdefault(chapter.get("card") or chapter["id"], []).append(chapter)
    cards = list(grouped.items())
    for _, sections in cards:
        sections.sort(key=lambda item: item.get("order", 0))
    cards.sort(key=lambda pair: (pair[1][0].get("category", ""), pair[0]))
    return cards


def section_locked(chapter_id: str, progress: dict) -> bool:
    """分区是否锁定：同一张卡里，前一个分区没完成就锁。

    `progress` 是 `player_save.story_state()["chapters"]`（chapter_id -> 进度）。
    """
    chapter = chapter_by_id(chapter_id)
    if chapter is None:
        return True
    card = chapter.get("card") or chapter["id"]
    card_sections = [item for item in CHAPTERS if (item.get("card") or item["id"]) == card]
    card_sections.sort(key=lambda item: item.get("order", 0))
    for section in card_sections:
        if section["id"] != chapter_id:
            continue
        if section.get("order", 0) == 0:
            return False
        previous = [item for item in card_sections if item.get("order", 0) < section.get("order", 0)]
        if not previous:
            return False
        latest = max(previous, key=lambda item: item.get("order", 0))
        return not bool((progress.get(latest["id"]) or {}).get("completed"))
    return True


def _validate_battle_waves(chapter_id, node_id, battle: dict) -> list:
    """结构化波次校验。没有 `waves` 的旧节点视为「只按目标波次判定」，不报错。"""
    problems = []
    waves = battle.get("waves")
    if waves is None:
        return problems
    if not isinstance(waves, list) or not waves:
        return [f"{chapter_id}/{node_id}: battle.waves 必须是非空数组"]
    if len(waves) != battle.get("target_waves"):
        problems.append(
            f"{chapter_id}/{node_id}: battle.waves 有 {len(waves)} 波，"
            f"但 target_waves 是 {battle.get('target_waves')}"
        )
    for index, wave in enumerate(waves):
        prefix = f"{chapter_id}/{node_id} 第 {index + 1} 波"
        if not isinstance(wave, dict):
            problems.append(f"{prefix}: 波次配置必须是对象")
            continue
        enemies = wave.get("enemies")
        if not isinstance(enemies, list) or not enemies:
            problems.append(f"{prefix}: 至少要有一个敌人配置")
        else:
            for enemy in enemies:
                if not isinstance(enemy, dict) or not enemy.get("hero"):
                    problems.append(f"{prefix}: 敌人缺少 hero")
                    continue
                count = enemy.get("count", 1)
                if not isinstance(count, int) or not 1 <= count <= 8:
                    problems.append(f"{prefix}: 敌人 {enemy.get('hero')} 的 count 必须是 1-8 的整数")
                for key in ("hp_scale", "damage_scale", "speed_scale", "armor"):
                    if key in enemy and not isinstance(enemy[key], (int, float)):
                        problems.append(f"{prefix}: 敌人 {enemy.get('hero')} 的 {key} 必须是数字")
        for skill in wave.get("skills") or []:
            if not isinstance(skill, dict):
                problems.append(f"{prefix}: 技能配置必须是对象")
                continue
            if not isinstance(skill.get("damage", 0), (int, float)) or skill.get("damage", 0) < 0:
                problems.append(f"{prefix}: 技能 damage 必须是非负数字")
            if not isinstance(skill.get("cooldown", 8), (int, float)) or skill.get("cooldown", 8) <= 0:
                problems.append(f"{prefix}: 技能 cooldown 必须是正数")
        hazard = wave.get("hazard")
        if hazard is not None:
            if not isinstance(hazard, dict):
                problems.append(f"{prefix}: hazard 必须是对象或 null")
            elif not isinstance(hazard.get("interval"), (int, float)) or hazard["interval"] <= 0:
                problems.append(f"{prefix}: hazard.interval 必须是正数")
            elif not isinstance(hazard.get("damage", 0), (int, float)) or hazard.get("damage", 0) < 0:
                problems.append(f"{prefix}: hazard.damage 必须是非负数字")
    return problems


def _merge_battle_waves(structured, text_waves) -> list:
    """把结构化波次（数值）与当前语言的文案按索引合并。

    数值只认 `story_script.py`，文案只认 `locale/*.json`；两边索引对齐，
    剧情页的预览与 `/battle` 实际刷怪因此永远同源。
    """
    text_waves = text_waves or []
    merged = []
    for index, wave in enumerate(structured or []):
        if not isinstance(wave, dict):
            continue
        text = text_waves[index] if index < len(text_waves) and isinstance(text_waves[index], dict) else {}
        text_enemies = text.get("enemies") or []
        text_skills = text.get("skills") or []
        enemies = []
        for enemy_index, enemy in enumerate(wave.get("enemies") or []):
            if not isinstance(enemy, dict):
                continue
            enemy_text = text_enemies[enemy_index] if enemy_index < len(text_enemies) else {}
            enemies.append({
                "hero": enemy.get("hero", ""),
                "count": int(enemy.get("count", 1)),
                "mod": enemy_text.get("mod", ""),
                "hp_scale": float(enemy.get("hp_scale", 1.0)),
                "damage_scale": float(enemy.get("damage_scale", 1.0)),
                "speed_scale": float(enemy.get("speed_scale", 1.0)),
                "armor": float(enemy.get("armor", 0.0)),
                "kind": enemy.get("kind"),
            })
        skills = []
        for skill_index, skill in enumerate(wave.get("skills") or []):
            if not isinstance(skill, dict):
                continue
            skill_text = text_skills[skill_index] if skill_index < len(text_skills) else {}
            skills.append({
                "name": skill_text.get("name", ""),
                "description": skill_text.get("description", ""),
                "damage": int(skill.get("damage", 0)),
                "cooldown": float(skill.get("cooldown", 8)),
                # effect 是给前端逻辑用的内部键（眩晕/禁锢/…），不能翻译
                "effect": skill.get("effect", ""),
                # effect_text 只用于展示，按语言取 locale 里的文案
                "effect_text": skill_text.get("effect", ""),
                "effect_turns": float(skill.get("effect_turns", 0)),
                "radius": float(skill.get("radius", 150)),
            })
        hazard = wave.get("hazard")
        merged.append({
            "label": text.get("label", ""),
            "note": text.get("note", ""),
            "event": text.get("event", ""),
            "enemies": enemies,
            "skills": skills,
            "hazard": hazard if isinstance(hazard, dict) else None,
        })
    return merged


def validate_chapter(chapter: dict) -> list:
    """结构与跳转校验，返回问题列表（空表示通过）。"""
    problems = []
    nodes = chapter.get("nodes") or []
    ids = [node.get("id") for node in nodes]
    if len(ids) != len(set(ids)):
        problems.append(f"{chapter.get('id')}: 节点 id 重复")
    known = {node["id"] for node in nodes if node.get("id")}
    entry = chapter.get("entry")
    if entry not in known:
        problems.append(f"{chapter.get('id')}: entry '{entry}' 不存在")

    for node in nodes:
        nid = node.get("id")
        ntype = node.get("type")
        if ntype not in NODE_TYPES:
            problems.append(f"{chapter.get('id')}/{nid}: 未知节点类型 '{ntype}'")
            continue
        targets = []
        if node.get("next"):
            targets.append(node["next"])
        if ntype == "choice":
            options = node.get("options") or []
            if not options:
                problems.append(f"{chapter.get('id')}/{nid}: choice 没有选项")
            targets.extend(option.get("next") for option in options)
        if ntype == "battle":
            if not node.get("on_win") or not node.get("on_lose"):
                problems.append(f"{chapter.get('id')}/{nid}: battle 缺少 on_win / on_lose")
            targets.extend([node.get("on_win"), node.get("on_lose")])
            battle = node.get("battle") or {}
            if not isinstance(battle.get("target_waves"), int) or battle["target_waves"] < 1:
                problems.append(f"{chapter.get('id')}/{nid}: battle.target_waves 必须是正整数")
            map_theme = battle.get("map_theme")
            if map_theme is not None and map_theme not in STORY_MAP_THEMES:
                problems.append(
                    f"{chapter.get('id')}/{nid}: battle.map_theme '{map_theme}' 不是可用地图"
                    f"（可选：{', '.join(STORY_MAP_THEMES)}）"
                )
            problems.extend(_validate_battle_waves(chapter.get("id"), nid, battle))
        if ntype == "reward":
            if not node.get("reward_id"):
                problems.append(f"{chapter.get('id')}/{nid}: reward 缺少 reward_id")
            if not isinstance(node.get("coins", 0), int):
                problems.append(f"{chapter.get('id')}/{nid}: reward.coins 必须是整数")
        for target in targets:
            if target and target not in known:
                problems.append(f"{chapter.get('id')}/{nid}: 跳转到不存在的节点 '{target}'")
    return problems


def resolve_battle_map(battle, *, story_battle: bool, game_mode: str = "rogue",
                       has_room: bool = False, chooser=None) -> dict:
    """决定这一场战斗用哪张地图（纯函数，无 Flask 依赖，可直接单测）。

    返回值：
        {"map_theme": str, "arena": bool, "locked": bool, "invalid": bool}

    - 剧情战斗：`battle.map_theme` 合法就锁那张；没写 / 写 `arena` / 写错 →
      1V1 竞技场（`arena=True`，配色仍用 city）。写错时 `invalid=True` 方便排查。
    - 非剧情战斗：保持原有随机逻辑；人机对抗固定 city。
    """
    themes = tuple(theme for theme in STORY_MAP_THEMES if theme != STORY_ARENA_THEME)
    map_theme = battle.get("map_theme") if isinstance(battle, dict) else None
    if story_battle:
        if map_theme in themes:
            return {"map_theme": map_theme, "arena": False, "locked": True, "invalid": False}
        return {
            "map_theme": "city",
            "arena": True,
            "locked": True,
            "invalid": bool(map_theme and map_theme != STORY_ARENA_THEME),
        }
    if map_theme in themes:
        return {"map_theme": map_theme, "arena": False, "locked": True, "invalid": False}
    if game_mode == "duel":
        return {"map_theme": "city", "arena": False, "locked": False, "invalid": False}
    options = themes[:-1] if has_room else themes
    picked = chooser(options) if chooser else options[0]
    if picked not in options:
        picked = options[0]
    return {"map_theme": picked, "arena": False, "locked": False, "invalid": False}


def localized_chapter(chapter_id: str, lang: str, locale_pack: dict):
    """把分区结构 + 当前语言的文案合并成前端可直接渲染的对象。"""
    chapter = chapter_by_id(chapter_id)
    if chapter is None:
        return None
    merged = deepcopy(chapter)
    pack = locale_pack.get("story") or {}
    section_text = ((pack.get("sections") or {}).get(chapter_id) or {})
    card_text = ((pack.get("cards") or {}).get(chapter.get("card") or chapter_id) or {})
    node_text = section_text.get("nodes") or {}

    merged["background"] = chapter.get("background", "home-background.png")
    merged["title"] = section_text.get("title", chapter_id)
    merged["summary"] = section_text.get("summary", "")
    merged["card_code"] = card_text.get("code", chapter.get("card") or "")
    merged["card_title"] = card_text.get("title", "")
    merged["category_name"] = (
        ((pack.get("categories") or {}).get(chapter["category"]) or {}).get("name", chapter["category"])
    )

    for node in merged["nodes"]:
        text = node_text.get(node["id"]) or {}
        node_type = node["type"]
        if node_type == "dialogue":
            node["speaker"] = text.get("speaker", node.get("speaker_key", ""))
            node["text"] = text.get("text", "")
        elif node_type == "choice":
            node["prompt"] = text.get("prompt", "")
            labels = text.get("options") or []
            for index, option in enumerate(node.get("options") or []):
                option["label"] = labels[index] if index < len(labels) else option.get("id", "")
        elif node_type == "battle":
            node["title"] = text.get("title", "")
            node["brief"] = text.get("brief", "")
            battle = node.setdefault("battle", {})
            # 地图锁：合法 id 原样保留；没写 / arena / 写错都归一到竞技场
            raw_map = battle.get("map_theme")
            map_key = raw_map if raw_map in STORY_MAP_THEMES else STORY_ARENA_THEME
            battle["map_theme"] = map_key
            node["map_theme"] = map_key
            node["map_label"] = (locale_pack.get("ui") or {}).get(MAP_LABEL_KEYS.get(map_key, ""), "")
            # 数值来自 Python、文案来自 locale；合并后预览与实战共用同一份波次
            node["waves"] = _merge_battle_waves(battle.get("waves"), text.get("waves"))
            if node["waves"]:
                battle["waves"] = node["waves"]
        elif node_type == "objective":
            node["title"] = text.get("title", "")
            node["description"] = text.get("description", "")
            labels = text.get("goals") or []
            for index, goal in enumerate(node.get("goals") or []):
                goal["label"] = labels[index] if index < len(labels) else goal.get("id", "")
        elif node_type == "reward":
            node["title"] = text.get("title", "")
            node["description"] = text.get("description", "")
        elif node_type == "chapter_end":
            node["title"] = text.get("title", "")
            node["text"] = text.get("text", "")
    return merged


def card_list(lang: str, locale_pack: dict, progress: dict = None) -> list:
    """选择页用的重现卡列表：每张卡带分区、解锁状态与完成状态。"""
    progress = progress or {}
    pack = locale_pack.get("story") or {}
    cards_text = pack.get("cards") or {}
    sections_text = pack.get("sections") or {}

    result = []
    for card_id, sections in chapter_cards():
        card_meta = cards_text.get(card_id) or {}
        previous_completed = True
        entries = []
        for section in sections:
            section_meta = sections_text.get(section["id"]) or {}
            state = progress.get(section["id"]) or {}
            completed = bool(state.get("completed"))
            entries.append({
                "id": section["id"],
                "order": section.get("order", 0),
                "title": section_meta.get("title", section["id"]),
                "summary": section_meta.get("summary", ""),
                "node_count": len(section.get("nodes") or []),
                "hero": section.get("hero"),
                "locked": not previous_completed,
                "completed": completed,
                "started": bool(state.get("node")),
                "entry": section.get("entry"),
            })
            previous_completed = completed
        result.append({
            "id": card_id,
            "code": card_meta.get("code", card_id),
            "title": card_meta.get("title", card_id),
            "summary": card_meta.get("summary", ""),
            "quote": card_meta.get("quote", ""),
            "category": sections[0].get("category", ""),
            "sections": entries,
        })
    return result


def category_list(lang: str, locale_pack: dict) -> list:
    pack = locale_pack.get("story") or {}
    categories_text = pack.get("categories") or {}
    return [
        {
            "id": category["id"],
            "order": category["order"],
            "name": (categories_text.get(category["id"]) or {}).get("name", category["id"]),
            "description": (categories_text.get(category["id"]) or {}).get("description", ""),
        }
        for category in CATEGORIES
    ]
