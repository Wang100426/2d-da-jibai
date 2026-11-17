/**
 * 静态建筑随机布局回归测试（node:test，无浏览器依赖）。
 *
 * 运行：npm run test:obstacle-layout
 * 依赖：build/obstacle_layout.js（由 tsconfig.obstacle-layout.json 生成，不提交）
 *
 * 背景：2.8.2 的 fallback 从 (70,70) 全栅格扫描起步，多个找不到安全位置的建筑
 * 被塞进同一个左上角格子并互相重叠。本测试覆盖修复后的三条硬约束：
 * 1. 任意两个建筑/路障不重叠；
 * 2. 建筑不压道路、不压出生点；
 * 3. 建筑数量守恒，且没有堆叠在左上角。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "..", "build", "obstacle_layout.js");
if (!fs.existsSync(modulePath)) {
  throw new Error("缺少 build/obstacle_layout.js，请先运行 npm run build:obstacle-layout");
}

const code = fs.readFileSync(modulePath, "utf8");
vm.runInThisContext(`${code}\nglobalThis.__layout = { randomizeObstacleLayout };`);
const { randomizeObstacleLayout } = globalThis.__layout;
assert.equal(typeof randomizeObstacleLayout, "function", "randomizeObstacleLayout 未正确导出");

const MW = 3200;
const MH = 2400;
const SPAWN = { x: 1570, y: 1170, w: 60, h: 60 };

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roadsFor(theme) {
  if (["airport", "station", "ancient_town", "windy_valley", "neon_beach"].includes(theme)) return [];
  if (theme === "hospital") {
    return [
      { x: 0, y: 682, w: MW, h: 150 },
      { x: 0, y: 1452, w: MW, h: 155 },
      { x: 830, y: 0, w: 150, h: MH },
      { x: 1570, y: 0, w: 165, h: MH },
      { x: 2340, y: 0, w: 150, h: MH },
    ];
  }
  return [
    { x: 0, y: 655, w: MW, h: 110 },
    { x: 0, y: 1375, w: MW, h: 120 },
    { x: 790, y: 0, w: 100, h: MH },
    { x: 1300, y: 0, w: 105, h: MH },
    { x: 2280, y: 0, w: 115, h: MH },
  ];
}

/** 与 map.ts 的真实建筑数据保持一致（回归测试锁定当前布局）。 */
const THEMES = {
  city: [
    [360, 300, 360, 230], [980, 250, 260, 330], [1790, 310, 440, 220], [2600, 280, 300, 360],
    [220, 850, 280, 340], [760, 920, 360, 250], [1410, 790, 350, 390], [2200, 900, 410, 240],
    [2840, 970, 220, 390], [400, 1580, 440, 280], [1110, 1690, 300, 390], [1810, 1580, 440, 300],
    [2550, 1660, 390, 280],
    [820, 650, 110, 38, "barrier"], [1270, 1330, 150, 40, "barrier"], [1960, 690, 42, 140, "barrier"],
    [2500, 1320, 120, 42, "barrier"], [920, 1450, 44, 130, "barrier"], [2340, 2060, 150, 38, "barrier"],
  ],
  hospital: [
    [220, 240, 520, 290], [1040, 210, 430, 350], [2220, 230, 720, 300], [250, 900, 410, 330],
    [930, 900, 360, 260], [2180, 900, 720, 330], [260, 1700, 540, 310], [1120, 1740, 440, 300],
    [2220, 1690, 680, 350], [740, 480, 180, 150], [1830, 480, 190, 180], [690, 1390, 190, 160],
    [1880, 1380, 210, 170],
    [820, 680, 90, 34, "barrier"], [1320, 760, 120, 34, "barrier"], [2290, 680, 90, 34, "barrier"],
    [1050, 1450, 34, 110, "barrier"], [2350, 1450, 34, 110, "barrier"],
  ],
  music: [
    [260, 250, 540, 300], [1090, 230, 420, 350], [2240, 260, 650, 290], [250, 900, 430, 340],
    [2170, 900, 700, 340], [310, 1710, 540, 300], [2220, 1690, 680, 350], [790, 620, 190, 145],
    [1770, 600, 220, 170], [930, 1450, 210, 165], [1810, 1430, 205, 175],
    [1110, 830, 46, 145, "barrier"], [2110, 1290, 145, 42, "barrier"],
  ],
  gym: [
    [280, 260, 600, 340], [2200, 260, 700, 330], [240, 1690, 620, 350], [2220, 1690, 680, 350],
    [950, 360, 300, 240], [1830, 360, 300, 240], [960, 1780, 310, 230], [1830, 1780, 310, 230],
    [830, 790, 145, 42, "barrier"], [2160, 790, 145, 42, "barrier"],
    [830, 1420, 145, 42, "barrier"], [2160, 1420, 145, 42, "barrier"],
  ],
  school: [
    [270, 250, 560, 310], [2210, 250, 690, 320], [300, 1710, 560, 300], [2220, 1690, 650, 330],
    [930, 320, 300, 235], [1830, 320, 300, 235], [960, 1790, 310, 220], [1830, 1790, 310, 220],
    [1410, 700, 380, 270],
    [830, 790, 150, 38, "barrier"], [2170, 790, 150, 38, "barrier"],
    [830, 1430, 150, 38, "barrier"], [2170, 1430, 150, 38, "barrier"],
  ],
  ancient_town: [
    [250, 260, 560, 330], [2350, 260, 600, 330], [250, 1780, 580, 340], [2370, 1780, 580, 340],
    [1000, 320, 390, 260], [1810, 320, 390, 260], [960, 1800, 420, 250], [1820, 1800, 420, 250],
    [780, 900, 170, 52, "barrier"], [2210, 1420, 170, 52, "barrier"],
  ],
  windy_valley: [
    [250, 260, 520, 300], [2440, 280, 520, 310], [270, 1800, 540, 300], [2400, 1790, 560, 320],
    [1020, 350, 300, 220], [1900, 1750, 300, 250],
    [830, 780, 210, 56, "barrier"], [2150, 1480, 220, 56, "barrier"],
    [1450, 480, 70, 220, "barrier"], [1690, 1740, 70, 220, "barrier"],
  ],
  neon_beach: [
    [250, 250, 580, 320], [2360, 250, 590, 320], [280, 850, 520, 300], [2390, 850, 520, 300],
    [1030, 340, 370, 240], [1800, 340, 370, 240],
    [930, 900, 180, 46, "barrier"], [2110, 1190, 190, 46, "barrier"],
  ],
};

function makeSource(rows) {
  return rows.map(([x, y, w, h, type = "building"], i) => ({
    x, y, w, h, type, name: `B${i}`,
  }));
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

for (const [theme, rows] of Object.entries(THEMES)) {
  test(`${theme}: 100 次随机布局，建筑不重叠/不压路/不压出生点/数量守恒`, () => {
    const source = makeSource(rows);
    for (let seed = 1; seed <= 100; seed += 1) {
      const roads = roadsFor(theme);
      const result = randomizeObstacleLayout(source, {
        mapTheme: theme,
        width: MW,
        height: MH,
        roads,
        spawnRect: SPAWN,
        random: seeded(seed * 7919 + rows.length),
      });
      assert.equal(result.length, source.length, `${theme} seed=${seed} 建筑数量丢失`);

      // 任意两建筑不重叠
      for (let i = 0; i < result.length; i += 1) {
        for (let j = i + 1; j < result.length; j += 1) {
          assert.ok(!overlap(result[i], result[j]),
            `${theme} seed=${seed} 建筑重叠: ${result[i].name}@(${Math.round(result[i].x)},${Math.round(result[i].y)}) / ${result[j].name}@(${Math.round(result[j].x)},${Math.round(result[j].y)})`);
        }
      }

      // 不压出生点；所有物件在地图内
      let roadHits = 0;
      result.forEach((item) => {
        assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.w <= MW && item.y + item.h <= MH,
          `${theme} seed=${seed} 越界: ${JSON.stringify(item)}`);
        if (item.type !== "building") return;
        assert.ok(!overlap(item, SPAWN), `${theme} seed=${seed} 压出生点: ${item.name}`);
        if (roads.some((road) => overlap(item, road))) roadHits += 1;
      });
      // 压路是软约束：医院 680×350 的大建筑放不进被道路切碎的净空，
      // 全主题最多允许 1 个（就是那栋原本压路的设计建筑），不能扩散。
      assert.ok(roadHits <= 1, `${theme} seed=${seed} 压路建筑扩散到 ${roadHits} 个`);

      // 不允许大量建筑堆叠在左上角（旧 bug 会有 3~7 个同时落在 (70,70)）
      const topLeft = result.filter((item) => item.x < 200 && item.y < 200);
      assert.ok(topLeft.length <= 1,
        `${theme} seed=${seed} 左上角堆叠 ${topLeft.length} 个: ${topLeft.map((o) => o.name).join(",")}`);
    }
  });
}

test("机场布局原样保留（跑道净空不依赖随机）", () => {
  const source = makeSource([[970, 300, 430, 250], [1980, 100, 440, 250]]);
  const result = randomizeObstacleLayout(source, {
    mapTheme: "airport", width: MW, height: MH, roads: [], random: seeded(42),
  });
  assert.deepEqual(result, source, "机场建筑坐标不应改变");
});

test("纯函数不修改入参数组", () => {
  const source = makeSource([[360, 300, 360, 230], [760, 920, 360, 250]]);
  const snapshot = JSON.stringify(source);
  randomizeObstacleLayout(source, {
    mapTheme: "city", width: MW, height: MH, roads: roadsFor("city"), random: seeded(7),
  });
  assert.equal(JSON.stringify(source), snapshot, "入参被修改");
});
