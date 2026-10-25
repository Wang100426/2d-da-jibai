/**
 * 剧情战斗地图选择测试。
 *
 * 分两层：
 * 1. `resolve_battle_map`（纯函数，只要 Python，不需要 Flask）
 * 2. `/battle` 路由注入（需要 Flask，找不到就跳过并提示设置 DAJIBAI_PYTHON）
 *
 * 运行：npm run test:story-map
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const CANDIDATES = [process.env.DAJIBAI_PYTHON, "python", "python3", "py"].filter(Boolean);

function findPython(probe) {
  for (const candidate of CANDIDATES) {
    const result = spawnSync(candidate, ["-c", probe], { cwd: ROOT, encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  return null;
}

function runPython(python, script) {
  const result = spawnSync(python, ["-c", script], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Python 执行失败：\n${result.stderr || result.stdout}`);
  }
  const text = (result.stdout || "").trim();
  const start = text.indexOf("{");
  if (start < 0) throw new Error(`Python 没有输出 JSON：${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start));
}

const plainPython = findPython("import story_script");
const flaskPython = findPython("import app");

const LOGIC_SCRIPT = `
import json
import story_script as s

cases = {}
cases["arena_default"] = s.resolve_battle_map({"target_waves": 1}, story_battle=True)
cases["arena_explicit"] = s.resolve_battle_map({"map_theme": "arena"}, story_battle=True)
for theme in ("school", "station", "gym", "hospital"):
    cases["lock_" + theme] = s.resolve_battle_map({"map_theme": theme}, story_battle=True)
cases["invalid"] = s.resolve_battle_map({"map_theme": "town"}, story_battle=True)
cases["rogue"] = s.resolve_battle_map({}, story_battle=False, chooser=lambda options: options[0])
cases["rogue_room"] = s.resolve_battle_map({}, story_battle=False, has_room=True, chooser=lambda options: options[-1])
cases["duel"] = s.resolve_battle_map({}, story_battle=False, game_mode="duel")
print(json.dumps(cases))
`;

test("剧情战斗没有 map_theme 时默认 1V1 竞技场", { skip: plainPython ? false : "没有可用的 Python" }, () => {
  const cases = runPython(plainPython, LOGIC_SCRIPT);
  assert.equal(cases.arena_default.arena, true);
  assert.equal(cases.arena_default.map_theme, "city", "竞技场地形用 city 配色，尺寸由 arena 开关控制");
  assert.equal(cases.arena_default.locked, true, "剧情战斗必须锁定地图");
  assert.equal(cases.arena_default.invalid, false);
  assert.equal(cases.arena_explicit.arena, true, "显式写 arena 也应走竞技场");
  assert.equal(cases.arena_explicit.invalid, false);
});

test("剧情战斗锁学校 / 火车站 / 体育馆 / 医院", { skip: plainPython ? false : "没有可用的 Python" }, () => {
  const cases = runPython(plainPython, LOGIC_SCRIPT);
  ["school", "station", "gym", "hospital"].forEach((theme) => {
    const entry = cases[`lock_${theme}`];
    assert.equal(entry.map_theme, theme, `${theme} 没被锁住`);
    assert.equal(entry.arena, false, `${theme} 不应触发竞技场`);
    assert.equal(entry.locked, true);
  });
});

test("写错的地图名回落到竞技场并标记 invalid", { skip: plainPython ? false : "没有可用的 Python" }, () => {
  const cases = runPython(plainPython, LOGIC_SCRIPT);
  assert.equal(cases.invalid.arena, true);
  assert.equal(cases.invalid.invalid, true, "写错的地图应被标记，方便排查");
});

test("普通肉鸽与人机对抗的选择不受剧情逻辑影响", { skip: plainPython ? false : "没有可用的 Python" }, () => {
  const cases = runPython(plainPython, LOGIC_SCRIPT);
  assert.equal(cases.rogue.arena, false);
  assert.equal(cases.rogue.locked, false);
  assert.ok(cases.rogue.map_theme, "肉鸽应随机到一张合法地图");
  assert.equal(cases.rogue_room.map_theme, "station", "联机房间排除最后一个主题（school）");
  assert.equal(cases.duel.map_theme, "city");
  assert.equal(cases.duel.arena, false);
  assert.equal(cases.duel.locked, false);
});

const ROUTE_SCRIPT = `
import json
import re
import app
import story_script

story_script.CHAPTERS.append({
    "id": "test-arena", "card": "RC-TEST", "category": "cyber", "order": 90,
    "hero": None, "background": "home-background.png", "entry": "t1",
    "nodes": [{"id": "t1", "type": "battle", "battle": {"hero": None, "target_waves": 1},
               "on_win": "t1", "on_lose": "t1"}],
})
story_script.CHAPTERS.append({
    "id": "test-empty", "card": "RC-TEST", "category": "cyber", "order": 91,
    "hero": None, "background": "home-background.png", "entry": "t9",
    "nodes": [{"id": "t9", "type": "battle", "battle": {}, "on_win": "t9", "on_lose": "t9"}],
})
story_script.CHAPTERS.append({
    "id": "test-badmap", "card": "RC-TEST", "category": "cyber", "order": 92,
    "hero": None, "background": "home-background.png", "entry": "t8",
    "nodes": [{"id": "t8", "type": "battle", "battle": {"target_waves": 1, "map_theme": "town"},
               "on_win": "t8", "on_lose": "t8"}],
})

client = app.app.test_client()

def fields(url):
    html = client.get(url).data.decode("utf-8")
    theme = re.search(r'mapTheme:\\s*"([^"]*)"', html)
    arena = re.search(r"arena:\\s*(true|false)", html)
    duel = re.search(r"duel:\\s*(true|false)", html)
    ctx = re.search(r"window\\.STORY_BATTLE = (\\{.*?\\}|null);", html, re.S)
    return {
        "theme": theme.group(1) if theme else None,
        "arena": (arena.group(1) == "true") if arena else None,
        "duel": (duel.group(1) == "true") if duel else None,
        "story_map": json.loads(ctx.group(1)).get("map_theme") if ctx and ctx.group(1) != "null" else None,
        "arena_name": "1V1 竞技场" in html,
        "arena_event": "无随机地图事件" in html,
    }
print(json.dumps({
    "arena": fields("/battle?hero=volt&story=test-arena&node=t1"),
    "empty": fields("/battle?hero=volt&story=test-empty&node=t9"),
    "badmap": fields("/battle?hero=volt&story=test-badmap&node=t8"),
    "school": fields("/battle?hero=volt&story=rc001-p0&node=p0-battle"),
    "station": fields("/battle?hero=volt&story=rc001-p1&node=p1-battle"),
    "gym": fields("/battle?hero=volt&story=rc001-p2&node=p2-battle"),
    "hospital": fields("/battle?hero=volt&story=rc001-p3&node=p3-battle"),
    "rogue": fields("/battle?hero=volt"),
    "duel": fields("/battle?hero=volt&mode=duel"),
}, ensure_ascii=False))
`;

test("/battle 路由：arena 开关与锁定地图真的注入到页面", { skip: flaskPython ? false : "需要带 Flask 的 Python（设置 DAJIBAI_PYTHON）" }, () => {
  const routes = runPython(flaskPython, ROUTE_SCRIPT);
  assert.equal(routes.arena.theme, "city");
  assert.equal(routes.arena.arena, true);
  assert.equal(routes.arena.duel, false);
  assert.equal(routes.arena.story_map, "arena");
  assert.equal(routes.arena.arena_name, true);
  assert.equal(routes.arena.arena_event, true, "竞技场不该挂 city 的随机事件文案");

  assert.equal(routes.empty.arena, true, "battle 配置为空也必须落竞技场，不能掉进随机地图");
  assert.equal(routes.badmap.arena, true);
  assert.equal(routes.badmap.arena_name, true);
  assert.equal(routes.badmap.story_map, "arena", "写错的地图在剧情数据里也应归一到 arena");

  const locked = { school: routes.school, station: routes.station, gym: routes.gym, hospital: routes.hospital };
  Object.entries(locked).forEach(([theme, entry]) => {
    assert.equal(entry.theme, theme, `路由把 ${theme} 覆盖成了 ${entry.theme}`);
    assert.equal(entry.arena, false);
    assert.equal(entry.story_map, theme);
    assert.equal(entry.arena_name, false, `锁定 ${theme} 时不该出现竞技场文案`);
    assert.equal(entry.arena_event, true, `锁定 ${theme} 时过场页不该挂该地图的随机事件文案`);
  });

  assert.equal(routes.rogue.arena, false);
  assert.equal(routes.rogue.duel, false);
  assert.equal(routes.rogue.arena_event, false, "普通肉鸽要保持原本的事件文案");
  assert.ok(["city", "hospital", "music", "gym", "airport", "station", "school"].includes(routes.rogue.theme));

  assert.equal(routes.duel.duel, true);
  assert.equal(routes.duel.arena, false);
  assert.equal(routes.duel.theme, "city");
});
