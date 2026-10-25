/**
 * 战斗场地几何测试（node:test，无第三方依赖）。
 *
 * 运行：npm run test:battle-space
 * 依赖：build/battle_space.js（由 tsconfig.battle-space.json 生成，不提交）
 *
 * 覆盖 1400×900 竞技场的尺寸、出生点、补给位置、建筑/道路开关，
 * 以及普通地图与机场/火车站的差异。敌人出生点带随机性，不在这里测。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "..", "build", "battle_space.js");
if (!fs.existsSync(modulePath)) {
  throw new Error("缺少 build/battle_space.js，请先运行 npm run build:battle-space");
}

const code = fs.readFileSync(modulePath, "utf8");
vm.runInThisContext(`${code}\nglobalThis.__resolveBattleSpace = resolveBattleSpace;`);
const resolveBattleSpace = globalThis.__resolveBattleSpace;
assert.equal(typeof resolveBattleSpace, "function", "resolveBattleSpace 未正确导出");

const MARGIN = 35;

function inside(space, point) {
  return point.x >= MARGIN
    && point.y >= MARGIN
    && point.x <= space.width - MARGIN
    && point.y <= space.height - MARGIN;
}

test("剧情竞技场：1400×900，出生点 (430,450)，无建筑无道路", () => {
  const space = resolveBattleSpace({ arena: true, mapTheme: "city" });
  assert.equal(space.arenaMode, true);
  assert.equal(space.width, 1400);
  assert.equal(space.height, 900);
  assert.equal(space.spawnX, 430);
  assert.equal(space.spawnY, 450);
  assert.equal(space.staticObstacles, false, "竞技场不应有建筑掩体");
  assert.equal(space.roads, false, "竞技场不应有道路");
});

test("剧情竞技场：两个补给，位置在边界内且不压出生点", () => {
  const space = resolveBattleSpace({ arena: true });
  assert.equal(space.supplies.length, 2);
  space.supplies.forEach((supply) => {
    assert.ok(inside(space, supply), `补给越界：${JSON.stringify(supply)}`);
    const distance = Math.hypot(supply.x - space.spawnX, supply.y - space.spawnY);
    assert.ok(distance > 120, `补给离出生点太近（${Math.round(distance)}）`);
  });
  assert.deepEqual(space.supplies.map((item) => item.type).sort(), ["energy", "health"]);
});

test("人机对抗：竞技场尺寸一致，但不刷补给", () => {
  const space = resolveBattleSpace({ duel: true });
  assert.equal(space.arenaMode, true);
  assert.equal(space.width, 1400);
  assert.equal(space.height, 900);
  assert.equal(space.spawnX, 430);
  assert.equal(space.supplies.length, 0);
});

test("普通地图：3200×2400，出生点 (1600,1200)，补给全部在边界内", () => {
  const space = resolveBattleSpace({ mapTheme: "city" });
  assert.equal(space.arenaMode, false);
  assert.equal(space.width, 3200);
  assert.equal(space.height, 2400);
  assert.equal(space.spawnX, 1600);
  assert.equal(space.spawnY, 1200);
  assert.equal(space.staticObstacles, true);
  assert.equal(space.roads, true);
  assert.equal(space.supplies.length, 6);
  space.supplies.forEach((supply) => {
    assert.ok(inside(space, supply), `补给越界：${JSON.stringify(supply)}`);
  });
});

test("机场出生点与道路规则", () => {
  const space = resolveBattleSpace({ mapTheme: "airport" });
  assert.equal(space.spawnX, 1840);
  assert.equal(space.spawnY, 1300);
  assert.equal(space.roads, false, "机场不画地面道路");
  assert.equal(space.staticObstacles, true);
});

test("火车站：保留建筑，但不画道路", () => {
  const space = resolveBattleSpace({ mapTheme: "station" });
  assert.equal(space.width, 3200);
  assert.equal(space.staticObstacles, true);
  assert.equal(space.roads, false);
});

test("返回值是副本，改一处不会污染下一次调用", () => {
  const first = resolveBattleSpace({ arena: true });
  first.supplies[0].x = -999;
  first.supplies.length = 0;
  const second = resolveBattleSpace({ arena: true });
  assert.equal(second.supplies.length, 2);
  assert.equal(second.supplies[0].x, 1120);
});

test("arena 优先级高于地图主题（剧情里即使传了 city 也应按竞技场处理）", () => {
  const space = resolveBattleSpace({ arena: true, mapTheme: "school" });
  assert.equal(space.arenaMode, true);
  assert.equal(space.width, 1400);
  assert.equal(space.staticObstacles, false);
});
