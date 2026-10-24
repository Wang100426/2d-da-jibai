"""剧情模式的数据层（只放结构与非文本配置，文本全部在 locale/*.json）。

设计要点
--------
- **数据与执行分离**：本文件只声明章节与节点；执行逻辑在 `frontend/story_engine.ts`。
- **多语言**：节点文案不写在这里，全部走 `locale/<lang>.json` 的 `story.*`，
  由 `localized_chapter()` 在渲染前合并，执行逻辑永远不碰文本。
- **可扩展章节**：往 `CHAPTERS` 追加一条即可，前端不需要改代码。
- **战斗复用**：`battle` 节点只声明 `target_waves` / `hero` 等配置，
  实际战斗由现有 `/battle` 页面执行，结果经 URL 回传。

节点类型（全部已实现）
----------------------
| type          | 作用                                             |
|---------------|--------------------------------------------------|
| `dialogue`    | 对话框                                           |
| `choice`      | 分支选择                                         |
| `battle`      | 剧情战斗（复用 /battle，按目标波次判胜负）        |
| `objective`   | 任务目标清单（展示 + flags 判定是否可继续）       |
| `reward`      | 奖励发放（服务端幂等，按 rewardId 防重复）        |
| `chapter_end` | 章节结束                                         |

`objective` 说明：本阶段为「展示 + 条件判定」——`goals[].done_flag` 为真才允许继续；
需要真实任务追踪（击杀计数等）的部分尚未接入，属于**部分实现**。
"""

from copy import deepcopy

# 剧情存档结构版本：结构变了就 +1，旧档会被保守丢弃（详见 player_save）。
STORY_SAVE_VERSION = 1

# 剧情分类：赛博世界剧情 / 英雄剧情
CATEGORIES = [
    {"id": "cyber", "order": 1},
    {"id": "hero", "order": 2},
]

# 章节列表。文本字段（title/summary/节点文案）都从 locale 取，这里只留 id 与配置。
CHAPTERS = [
    {
        "id": "cyber-01",
        "category": "cyber",
        "order": 1,
        # hero 为 None 表示玩家可自选英雄
        "hero": None,
        "background": "home-background.png",
        "entry": "c1-intro",
        "nodes": [
            {
                "id": "c1-intro",
                "type": "dialogue",
                "speaker_key": "narrator",
                "initial": "旁",
                "accent": "narrator",
                "next": "c1-pick",
            },
            {
                "id": "c1-pick",
                "type": "choice",
                "prompt_key": "prompt",
                "options": [
                    {"id": "direct", "next": "c1-battle"},
                    {"id": "careful", "next": "c1-objective"},
                ],
            },
            {
                "id": "c1-objective",
                "type": "objective",
                "goals": [
                    {"id": "scout", "done_flag": "scouted"},
                    {"id": "reach", "done_flag": "reached_street"},
                ],
                # 展示型目标：允许玩家直接继续，不阻塞（真实追踪未接入）
                "allow_skip": True,
                "next": "c1-battle",
            },
            {
                "id": "c1-battle",
                "type": "battle",
                "battle": {
                    "hero": None,
                    "target_waves": 2,
                    "map_theme": "city",
                },
                "on_win": "c1-reward",
                "on_lose": "c1-battle",
            },
            {
                "id": "c1-reward",
                "type": "reward",
                # rewardId 全局唯一：服务端按它去重，重复进节点不会重复发
                "reward_id": "cyber-01-clear",
                "coins": 120,
                "next": "c1-end",
            },
            {
                "id": "c1-end",
                "type": "chapter_end",
                "next": None,
            },
        ],
    },
    {
        "id": "hero-volt-01",
        "category": "hero",
        "order": 1,
        # 英雄剧情绑定英雄，进入战斗时固定用这个英雄
        "hero": "volt",
        "background": "home-background.png",
        "entry": "h1-intro",
        "nodes": [
            {
                "id": "h1-intro",
                "type": "dialogue",
                "speaker_key": "hero",
                "initial": "拳",
                "accent": "volt",
                "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
                "next": "h1-battle",
            },
            {
                "id": "h1-battle",
                "type": "battle",
                "battle": {"hero": "volt", "target_waves": 2, "map_theme": "gym"},
                "on_win": "h1-reward",
                "on_lose": "h1-battle",
            },
            {
                "id": "h1-reward",
                "type": "reward",
                "reward_id": "hero-volt-01-clear",
                "coins": 150,
                "next": "h1-end",
            },
            {
                "id": "h1-end",
                "type": "chapter_end",
                "next": None,
            },
        ],
    },
]

NODE_TYPES = ("dialogue", "choice", "battle", "objective", "reward", "chapter_end")


def chapters_of(category: str) -> list:
    return [chapter for chapter in CHAPTERS if chapter["category"] == category]


def chapter_by_id(chapter_id: str):
    for chapter in CHAPTERS:
        if chapter["id"] == chapter_id:
            return chapter
    return None


def validate_chapter(chapter: dict) -> list:
    """结构与跳转校验，返回问题列表（空表示通过）。

    前端也有同类校验；这里先拦一遍，避免把坏数据送到浏览器。
    """
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
        if ntype == "reward":
            if not node.get("reward_id"):
                problems.append(f"{chapter.get('id')}/{nid}: reward 缺少 reward_id")
            if not isinstance(node.get("coins", 0), int):
                problems.append(f"{chapter.get('id')}/{nid}: reward.coins 必须是整数")
        for target in targets:
            if target and target not in known:
                problems.append(f"{chapter.get('id')}/{nid}: 跳转到不存在的节点 '{target}'")
    return problems


def localized_chapter(chapter_id: str, lang: str, locale_pack: dict):
    """把章节结构 + 当前语言的文案合并成前端可直接渲染的对象。

    文案缺失时回落到 key，绝不抛错——剧情文本永远不该让页面崩掉。
    """
    chapter = chapter_by_id(chapter_id)
    if chapter is None:
        return None
    merged = deepcopy(chapter)
    pack = (locale_pack.get("story") or {})
    chapter_text = ((pack.get("chapters") or {}).get(chapter_id) or {})
    node_text = chapter_text.get("nodes") or {}

    merged["background"] = chapter.get("background", "home-background.png")
    merged["title"] = chapter_text.get("title", chapter_id)
    merged["summary"] = chapter_text.get("summary", "")
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
            node["waves"] = text.get("waves") or []
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


def chapter_list(lang: str, locale_pack: dict) -> list:
    """剧情选择页用的章节摘要（含分类、标题、是否绑定英雄）。"""
    pack = locale_pack.get("story") or {}
    chapters_text = pack.get("chapters") or {}
    result = []
    for chapter in CHAPTERS:
        text = chapters_text.get(chapter["id"]) or {}
        result.append({
            "id": chapter["id"],
            "category": chapter["category"],
            "order": chapter.get("order", 0),
            "title": text.get("title", chapter["id"]),
            "summary": text.get("summary", ""),
            "hero": chapter.get("hero"),
            "node_count": len(chapter.get("nodes") or []),
            "entry": chapter.get("entry"),
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
