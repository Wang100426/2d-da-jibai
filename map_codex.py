"""地图图鉴的数据源。

几何与配色镜像 frontend/map.ts：障碍物取基础阵列（实机在 ±76 / ±48 像素内随机抖动，
出生于 (1600,1200) 附近的门面会被推开），配色取 drawMap 里的主题分支。
地图名、随机事件与地形文案全部走 locale 的 ui 段，这里只放数值。
"""

# 通用主干道（城区 / 音乐厅 / 拳馆 / 校园共用同一套基础布局）。
GENERIC_ROADS = (
    (0, 620, 3200, 110),
    (0, 1340, 3200, 120),
    (750, 0, 100, 2400),
    (1260, 0, 105, 2400),
    (2240, 0, 115, 2400),
)

# 医院走廊更长更宽，纵向道路的间距也不同。
HOSPITAL_ROADS = (
    (0, 660, 3200, 150),
    (0, 1430, 3200, 155),
    (810, 0, 150, 2400),
    (1550, 0, 165, 2400),
    (2320, 0, 150, 2400),
)

PALETTES = {
    "city": {
        "bg": "#111827", "grid": "#20303a", "road": "#1a2530",
        "fill": "#252d3c", "stroke": "#465365", "inner": "#313c4d", "accent": "#49e6e0",
    },
    "hospital": {
        "bg": "#17232e", "grid": "#29404a", "road": "#22333a",
        "fill": "#354651", "stroke": "#70a2a5", "inner": "#45616b", "accent": "#70a2a5",
    },
    "music": {
        "bg": "#191426", "grid": "#37294a", "road": "#292039",
        "fill": "#443653", "stroke": "#b47dcb", "inner": "#644b74", "accent": "#c47fe0",
    },
    "gym": {
        "bg": "#1d171b", "grid": "#443331", "road": "#302528",
        "fill": "#4a3839", "stroke": "#c26d58", "inner": "#654745", "accent": "#ff8a5c",
    },
    "airport": {
        "bg": "#15202a", "grid": "#263c50", "road": "#1a2530",
        "fill": "#3a4b5a", "stroke": "#93adbe", "inner": "#506579", "accent": "#7fc4ff",
    },
    "station": {
        "bg": "#0e1720", "grid": "#1d2f3d", "road": "#1a2530",
        "fill": "#2b3d4d", "stroke": "#7fa3bd", "inner": "#3d5468", "accent": "#7fd4ff",
    },
    "school": {
        "bg": "#172321", "grid": "#30463d", "road": "#263034",
        "fill": "#35463f", "stroke": "#a5c27d", "inner": "#4a5b4c", "accent": "#b6e07a",
    },
}

# obstacles 里的第 5 位是类型：building 会阻挡移动，barrier 是低矮路障。
MAP_CODEX = (
    {
        "id": "city",
        "name_key": "MAP_CITY",
        "event_key": "MAP_EVENT_CITY",
        "terrain_key": "MAP_TERRAIN_CITY",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": GENERIC_ROADS,
        "motif": "",
        "obstacles": (
            (360, 300, 360, 230, "building"),
            (980, 250, 260, 330, "building"),
            (1790, 310, 440, 220, "building"),
            (2600, 280, 300, 360, "building"),
            (220, 850, 280, 340, "building"),
            (760, 920, 360, 250, "building"),
            (1410, 790, 350, 390, "building"),
            (2200, 900, 410, 240, "building"),
            (2840, 970, 220, 390, "building"),
            (400, 1580, 440, 280, "building"),
            (1110, 1690, 300, 390, "building"),
            (1810, 1580, 440, 300, "building"),
            (2550, 1660, 390, 280, "building"),
            (820, 650, 110, 38, "barrier"),
            (1270, 1330, 150, 40, "barrier"),
            (1960, 690, 42, 140, "barrier"),
            (2500, 1320, 120, 42, "barrier"),
            (920, 1450, 44, 130, "barrier"),
            (2340, 2060, 150, 38, "barrier"),
        ),
    },
    {
        "id": "hospital",
        "name_key": "MAP_HOSPITAL",
        "event_key": "MAP_EVENT_HOSPITAL",
        "terrain_key": "MAP_TERRAIN_HOSPITAL",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": HOSPITAL_ROADS,
        "motif": "",
        "obstacles": (
            (220, 240, 520, 290, "building"),
            (1040, 210, 430, 350, "building"),
            (2220, 230, 720, 300, "building"),
            (250, 900, 410, 330, "building"),
            (930, 900, 360, 260, "building"),
            (2180, 900, 720, 330, "building"),
            (260, 1700, 540, 310, "building"),
            (1120, 1740, 440, 300, "building"),
            (2220, 1690, 680, 350, "building"),
            (740, 480, 180, 150, "building"),
            (1830, 480, 190, 180, "building"),
            (690, 1390, 190, 160, "building"),
            (1880, 1380, 210, 170, "building"),
            (820, 680, 90, 34, "barrier"),
            (1320, 760, 120, 34, "barrier"),
            (2290, 680, 90, 34, "barrier"),
            (1050, 1450, 34, 110, "barrier"),
            (2350, 1450, 34, 110, "barrier"),
        ),
    },
    {
        "id": "music",
        "name_key": "MAP_MUSIC",
        "event_key": "MAP_EVENT_MUSIC",
        "terrain_key": "MAP_TERRAIN_MUSIC",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": GENERIC_ROADS,
        "motif": "",
        "obstacles": (
            (260, 250, 540, 300, "building"),
            (1090, 230, 420, 350, "building"),
            (2240, 260, 650, 290, "building"),
            (250, 900, 430, 340, "building"),
            (2170, 900, 700, 340, "building"),
            (310, 1710, 540, 300, "building"),
            (2220, 1690, 680, 350, "building"),
            (790, 620, 190, 145, "building"),
            (1770, 600, 220, 170, "building"),
            (930, 1450, 210, 165, "building"),
            (1810, 1430, 205, 175, "building"),
            (1110, 830, 46, 145, "barrier"),
            (2110, 1290, 145, 42, "barrier"),
        ),
    },
    {
        "id": "gym",
        "name_key": "MAP_GYM",
        "event_key": "MAP_EVENT_GYM",
        "terrain_key": "MAP_TERRAIN_GYM",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": GENERIC_ROADS,
        "motif": "",
        "obstacles": (
            (280, 260, 600, 340, "building"),
            (2200, 260, 700, 330, "building"),
            (240, 1690, 620, 350, "building"),
            (2220, 1690, 680, 350, "building"),
            (950, 360, 300, 240, "building"),
            (1830, 360, 300, 240, "building"),
            (960, 1780, 310, 230, "building"),
            (1830, 1780, 310, 230, "building"),
            (830, 790, 145, 42, "barrier"),
            (2160, 790, 145, 42, "barrier"),
            (830, 1420, 145, 42, "barrier"),
            (2160, 1420, 145, 42, "barrier"),
        ),
    },
    {
        "id": "airport",
        "name_key": "MAP_AIRPORT",
        "event_key": "MAP_EVENT_AIRPORT",
        "terrain_key": "MAP_TERRAIN_AIRPORT",
        "size": (3200, 2400),
        "spawn": (1840, 1300),
        "roads": (),
        "motif": "runways",
        "obstacles": (
            (970, 300, 430, 250, "building"),
            (260, 310, 410, 250, "building"),
            (2070, 310, 440, 250, "building"),
            (260, 1810, 420, 250, "building"),
            (2230, 1810, 430, 250, "building"),
            (2040, 790, 300, 210, "building"),
            (870, 1800, 360, 230, "building"),
            (1750, 330, 175, 130, "building"),
        ),
    },
    {
        "id": "station",
        "name_key": "MAP_STATION",
        "event_key": "MAP_EVENT_STATION",
        "terrain_key": "MAP_TERRAIN_STATION",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": (),
        "motif": "station",
        "obstacles": (
            (0, 0, 3200, 300, "building"),
            (210, 2292, 340, 96, "building"),
            (2650, 2292, 340, 96, "building"),
        ),
    },
    {
        "id": "school",
        "name_key": "MAP_SCHOOL",
        "event_key": "MAP_EVENT_SCHOOL",
        "terrain_key": "MAP_TERRAIN_SCHOOL",
        "size": (3200, 2400),
        "spawn": (1600, 1200),
        "roads": GENERIC_ROADS,
        "motif": "",
        "obstacles": (
            (270, 250, 560, 310, "building"),
            (2210, 250, 690, 320, "building"),
            (300, 1710, 560, 300, "building"),
            (2220, 1690, 650, 330, "building"),
            (930, 320, 300, 235, "building"),
            (1830, 320, 300, 235, "building"),
            (960, 1790, 310, 220, "building"),
            (1830, 1790, 310, 220, "building"),
            (1410, 700, 380, 270, "building"),
            (830, 790, 150, 38, "barrier"),
            (2170, 790, 150, 38, "barrier"),
            (830, 1430, 150, 38, "barrier"),
            (2170, 1430, 150, 38, "barrier"),
        ),
    },
)


def codex_entries():
    """把配置表整理成模板 / canvas 都直接可用的结构。"""
    entries = []
    for item in MAP_CODEX:
        obstacles = [
            {"x": x, "y": y, "w": w, "h": h, "kind": kind}
            for (x, y, w, h, kind) in item["obstacles"]
        ]
        entries.append(
            {
                "id": item["id"],
                "name_key": item["name_key"],
                "event_key": item["event_key"],
                "terrain_key": item["terrain_key"],
                "size": list(item["size"]),
                "buildings": sum(1 for o in obstacles if o["kind"] == "building"),
                "barriers": sum(1 for o in obstacles if o["kind"] == "barrier"),
                "preview": {
                    "id": item["id"],
                    "size": list(item["size"]),
                    "spawn": list(item["spawn"]),
                    "motif": item["motif"],
                    "palette": PALETTES[item["id"]],
                    "roads": [{"x": x, "y": y, "w": w, "h": h} for (x, y, w, h) in item["roads"]],
                    "obstacles": obstacles,
                },
            }
        )
    return entries
