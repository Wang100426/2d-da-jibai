/**
 * 飞索超人（2.8.0）：用 DOM stub 真跑 static/app.js，验证核心机制。
 *
 * 覆盖的关键行为：
 * 1. 站在建筑上方（屋顶识别 + 坐标对齐 + 屋顶移动）；
 * 2. 被动层数规则（每 2 秒 +1 层 / 落地保留 3 秒 / 回到建筑减半）；
 * 3. E「飞索·抓」是**拉拽**而不是瞬移；
 * 4. R「飞索·移」的充能计数与落地判定；
 * 5. Q「万重飞索」牵引范围内敌人；
 * 6. 建筑上普攻被禁用（3 阶除外）。
 *
 * 跑法：npm run test:grapple-hero
 */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

let passed = 0;
function check(name, ok, detail) {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
  console.log(`PASS  ${name}`);
}

/* ---------- DOM stub ---------- */

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this._text = "";
    this._html = undefined;
    this._class = "";
    this._ev = {};
    this.dataset = {};
    this.hidden = false;
    this.value = "";
    this.style = {};
    this.width = 800;
    this.height = 600;
    const set = new Set();
    this.classList = {
      add: (...n) => n.forEach((x) => set.add(x)),
      remove: (...n) => n.forEach((x) => set.delete(x)),
      contains: (n) => set.has(n),
      toggle: (n, on) => (on === undefined ? (set.has(n) ? set.delete(n) : set.add(n)) : on ? set.add(n) : set.delete(n)),
    };
    this._classes = set;
  }
  set className(v) {
    this._class = String(v);
    this._classes.clear();
    String(v).split(/\s+/).filter(Boolean).forEach((c) => this._classes.add(c));
  }
  get className() { return this._class; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set innerHTML(v) { this._html = String(v); this._text = ""; }
  get innerHTML() { return this._html !== undefined ? this._html : this._text; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._html = undefined; }
  remove() {}
  insertBefore(node) { this.children.unshift(node); }
  addEventListener(type, fn) { this._ev[type] = fn; }
  removeEventListener() {}
  click() { if (this._ev.click) this._ev.click({ preventDefault() {} }); }
  focus() {}
  blur() {}
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k]; }
  removeAttribute(k) { delete this[k]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === "canvas") return { width: 800, height: 600 };
    if (prop === "measureText") return () => ({ width: 10 });
    if (prop === "createLinearGradient" || prop === "createRadialGradient") {
      return () => ({ addColorStop() {} });
    }
    if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (prop === "setLineDash") return () => {};
    return () => {};
  },
  set() { return true; },
});

function makeCanvas() {
  const canvas = new El("canvas");
  canvas.getContext = () => ctxStub;
  return canvas;
}

const ids = {};
const ELEMENT_IDS = [
  "basic-attack", "combat-traits", "energy-bar", "energy-label", "final-wave", "hp-bar",
  "hp-label", "loot-count", "map-mode", "map-toast", "minimap", "peer-list",
  "pickup-key", "pickup-label", "pickup-prompt", "retry-run", "run-level", "run-over-overlay", "shield-bar",
  "skill-exp-bar", "skill-exp-label", "skill-upgrade-choices", "skill-upgrade-overlay",
  "skill-upgrade-subtitle", "skill-upgrade-title", "touch-mode-toggle", "upgrade-choices",
  "upgrade-overlay", "wave-subtitle", "wave-title",
];
ELEMENT_IDS.forEach((id) => { ids[id] = new El("div"); });
// 真实模板里这些浮层默认是隐藏的 —— 不藏起来技能会被 skillIsPaused 全部拦掉。
[
  "upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay",
  "pickup-prompt", "final-wave",
].forEach((id) => { ids[id].hidden = true; });
ids.world = makeCanvas();
ids.minimap = makeCanvas();


const documentStub = {
  hidden: false,
  getElementById: (id) => ids[id] || null,
  querySelector: (selector) => {
    if (selector === "#world") return ids.world;
    if (selector === "#minimap") return ids.minimap;
    const match = /^#([a-z-]+)$/.exec(selector);
    return match ? (ids[match[1]] || null) : null;
  },
  querySelectorAll: (selector) => {
    if (selector === ".map-skill[data-skill]") return skillButtons;
    if (selector === "canvas") return [ids.world, ids.minimap];
    return [];
  },
  createElement: (tag) => (tag === "canvas" ? makeCanvas() : new El(tag)),
  addEventListener() {},
  removeEventListener() {},
  body: new El("body"),
  documentElement: new El("html"),
};

/* ---------- 英雄配置 ---------- */

const BUILDING = { x: 360, y: 300, w: 360, h: 230, type: "building", name: "废弃商场" };

const SKILLS = [
  {
    id: "grapple-ult", name: "万重飞索", kind: "大招", target: "self", action: "grapple_myriad",
    cost: 65, cooldown: 22, damage: 46, radius: 400, effect: "眩晕", effect_turns: 1,
    myriad_pull_duration: 1, myriad_range_scale: 2,
  },
  {
    id: "grapple-hook", name: "飞索·抓", kind: "小技能", target: "self", action: "grapple_hook",
    cost: 25, cooldown: 8, damage: 22, radius: 130, effect: "", effect_turns: 0,
    hook_range: 620, hook_speed: 1150, hook_flight_speed: 720,
    hook_flight_damage: 9, hook_flight_damage_interval: 0.35,
  },
  {
    id: "grapple-leap", name: "飞索·移", kind: "小技能", target: "self", action: "grapple_leap",
    cost: 20, cooldown: 1, damage: 26, radius: 150, effect: "", effect_turns: 0,
    leap_charges: 5, leap_recharge: 3, leap_duration: 1,
    leap_slow_turns: 2, leap_slow_ratio: 0.5, leap_edge_refund: 0.7,
  },
];

// 技能按钮：castSkill 会按索引取按钮，缺了会报「技能配置缺失」。
const skillButtons = SKILLS.map((skill) => {
  const button = new El("button");
  button.dataset.skill = JSON.stringify(skill);
  button.querySelector = (selector) => {
    if (selector === ".skill-cooldown") return button._cooldown || (button._cooldown = new El("span"));
    if (selector === ".skill-rank") return button._rank || (button._rank = new El("span"));
    if (selector === ".skill-charges") return button._charges || (button._charges = new El("span"));
    return null;
  };
  return button;
});

const ROSTER = [{
  id: "grapple", accent: "grapple", initial: "飞", name: "飞索超人",
  palette: { main: "#ff8a3d", light: "#ffd9a8", dark: "#8a3a10" },
  defense: 58,
  combat: {
    speed: 245, basic_range: 200, basic_damage: 13, basic_effect: "",
    basic_effect_turns: 0, basic_beam: null, basic_restore_label: "RANGED_RESTORE",
    basic_hit_message: "命中，造成 {damage} 点伤害。",
    bot_skill_effect: "眩晕", bot_skill_effect_turns: 0.8, bot_skill_damage_scale: 2,
    thorns_damage: 0,
  },
  passive: { id: "grapple_perch", name: "高空充能", description: "d" },
  stats: { 攻击: 86, 防御: 58, 机动: 94 },
  skills: SKILLS,
  price: 0, locked: false,
}];

// locale 包：直接用真实的 zh.json，避免手搓最小包漏键
// （map.ts 会读 battle.templates / ui / upgrades 等很多段）。
const LOCALE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "locale", "zh.json"), "utf8"),
);

const MAP_CONFIG = {
  heroId: "grapple",
  name: "飞索超人",
  playerName: "测试",
  initial: "飞",
  accent: "grapple",
  roster: ROSTER,
  mapTheme: "city",
  skills: SKILLS,
  locale: LOCALE,
  duel: false,
  arena: false,
  defense: 58,
  equipmentBonuses: {},
  multiplayer: null,
};

/* ---------- 沙箱 ---------- */

const sandbox = {
  console,
  document: documentStub,
  window: {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    performance: { now: () => 0 },
    location: { href: "", replace() {}, search: "" },
  },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout: () => 1,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  performance: { now: () => 0 },
  Math,
  Date,
  JSON,
  Map,
  Set,
  WeakMap,
  Array,
  Object,
  Number,
  String,
  Boolean,
  isNaN,
  parseInt,
  parseFloat,
};
sandbox.window.document = documentStub;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
// 打开 map.ts 里的测试钩子（生产环境没有这个标志）。
sandbox.window.__GRAPPLE_TEST_HOOK__ = true;
// Flask 注入的战斗配置。
sandbox.window.MAP_CONFIG = MAP_CONFIG;

/* ---------- 加载 app.js ---------- */

const appCode = fs.readFileSync(path.join(__dirname, "..", "static", "app.js"), "utf8");
// app.js 末尾会调用 scheduleFrame()，这里把 requestAnimationFrame 换成空转，
// 让主循环不自动跑，我们手动驱动。
let frameCallback = null;
sandbox.requestAnimationFrame = (fn) => { frameCallback = fn; return 1; };
sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;

try {
  vm.createContext(sandbox);
  vm.runInContext(appCode, sandbox);
} catch (error) {
  console.error("加载 app.js 失败：", error.message);
  process.exit(1);
}

/* ---------- 测试辅助 ---------- */

// map.ts 里的关键状态不在全局作用域（module: None 编译后仍在同一作用域，
// 但被 vm 的 context 隔离）。我们通过在 app.js 末尾追加导出钩子来拿到它们。
const api = sandbox.window.__grappleTest || sandbox.__grappleTest;
if (!api) {
  console.error("找不到测试钩子 —— app.js 需要追加 __grappleTest 导出");
  process.exit(1);
}

/**
 * 推进一帧。
 *
 * 战斗里波次清空会弹「升级」浮层，一旦弹出来 `skillIsPaused()` 就会拦掉
 * 后续所有逻辑（技能推进、被动计时全停）。这里每次推进后把浮层藏回去，
 * 让测试能连续驱动战斗逻辑。
 */
function step(dt = 0.016) {
  api.step(dt);
  ["upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay"].forEach((id) => {
    ids[id].hidden = true;
  });
}

function jumpToRoof(x, y, directionX = 0, directionY = 0) {
  api.setMovementInput(directionX, directionY);
  api.setPlayerPosition(x, y);
  api.castSkill(2);
  for (let i = 0; i < 80; i += 1) step(0.016);
  api.setMovementInput(0, 0);
}

console.log("\n=== 飞索超人 2.8.0 行为验证 ===\n");

// 城市地图的建筑是随机抖动的，这里换成确定的布局，屋顶判定才可测。
api.setTestObstacles([
  { x: BUILDING.x, y: BUILDING.y, w: BUILDING.w, h: BUILDING.h, type: "building" },
  { x: 980, y: 250, w: 260, h: 330, type: "building" },
]);

/* ---------- 1. 站在建筑上方 ---------- */

api.setPlayerPosition(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
check("未使用二技能：不能直接进入屋顶状态", api.getOnRooftop() === false);
jumpToRoof(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
check("站在建筑上：屋顶识别成功", api.getOnRooftop() === true);
check("站在建筑上：二技能落点保留在屋顶区域",
  api.getPlayerY() + 19 >= BUILDING.y &&
  api.getPlayerY() + 19 <= BUILDING.y + BUILDING.h,
  `脚部 y=${api.getPlayerY() + 19}`);

// 屋顶是俯视角平台，WASD 四向都要能走。
// 回归：旧实现锁死垂直、水平还过地面碰撞，实机上屋顶后几乎动不了。
const beforeY = api.getPlayerY();
api.movePlayer(0, 60);
check("站在建筑上：垂直移动可用", api.getPlayerY() > beforeY + 40,
  `y ${beforeY} -> ${api.getPlayerY()}`);

const beforeX = api.getPlayerX();
api.movePlayer(50, 0);
check("站在建筑上：水平移动可用", api.getPlayerX() > beforeX);

/* ---------- 1b. 实机回归：屋顶状态必须稳定 ---------- */

api.resetAll();
api.setPlayerPosition(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
step(0.016);
check("走到建筑区域不能自动上屋顶", api.getOnRooftop() === false);
jumpToRoof(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
check("上屋顶后状态生效", api.getOnRooftop() === true);
const rooftopHp = api.getPlayerHp();
check("屋顶状态免疫地图事件伤害",
  api.damagePlayerFromEvent(80) === false && api.getPlayerHp() === rooftopHp,
  `血量 ${rooftopHp} -> ${api.getPlayerHp()}`);
// 连续移动多帧，状态不能被逐帧 findRooftopUnder 判掉。
for (let i = 0; i < 120; i += 1) {
  api.movePlayer(i % 4 < 2 ? 6 : -6, i % 3 === 0 ? 5 : -5);
  step(0.016);
}
check("连续移动 120 帧后仍在屋顶", api.getOnRooftop() === true,
  `位置 ${api.getPlayerX().toFixed(0)},${api.getPlayerY().toFixed(0)}`);
check("屋顶状态下普攻仍然被禁用", api.basicAttack() === false);
check("玩家没有被瞬移出屋顶",
  api.getPlayerX() >= BUILDING.x && api.getPlayerX() <= BUILDING.x + BUILDING.w &&
  api.getPlayerY() >= BUILDING.y - 20 && api.getPlayerY() <= BUILDING.y + BUILDING.h,
  `位置 ${api.getPlayerX().toFixed(0)},${api.getPlayerY().toFixed(0)}`);

/* ---------- 2. 被动层数 ---------- */

api.setPlayerPosition(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
api.resetPassive();
step(0.016);
// 站 4.2 秒 → 2 层
for (let i = 0; i < 262; i += 1) step(0.016);
check("被动：在建筑上每 2 秒 +1 层", api.getStacks() === 2, `实际 ${api.getStacks()} 层`);
check("被动：能量恢复倍率随层数上升",
  Math.abs(api.getEnergyRegenScale() - 1.2) < 0.001,
  `实际 ${api.getEnergyRegenScale()}`);

/* ---------- 3. 落到地面 → 保留 3 秒 ---------- */

api.setPlayerPosition(BUILDING.x - 120, BUILDING.y + 400);
step(0.016);
check("落到地面后离开屋顶状态", api.getOnRooftop() === false);
check("落到地面：层数暂时保留", api.getStacks() === 2, `实际 ${api.getStacks()}`);
// 宽限期内回到建筑 → 减半
api.setPlayerPosition(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
api.castSkill(2);
for (let i = 0; i < 80; i += 1) step(0.016);
check("宽限期内回到建筑：层数减半", api.getStacks() === 1, `实际 ${api.getStacks()}`);

/* ---------- 4. E「飞索·抓」是拉拽不是瞬移 ---------- */

api.setPlayerPosition(100, 1000);
api.resetAll();
api.castSkill(1); // E = 飞索·抓
const afterCast = { x: api.getPlayerX(), y: api.getPlayerY() };
check("E 施放瞬间玩家没有瞬移",
  Math.abs(afterCast.x - 100) < 0.5 && Math.abs(afterCast.y - 1000) < 0.5,
  `位置 ${afterCast.x},${afterCast.y}`);

// 施放后玩家原地不动（飞索还在空中飞）。
step(0.016);
check("E 施放后第一帧：飞索还在空中，玩家未移动",
  api.getHookPhase() === "cast" && Math.hypot(api.getPlayerX() - 100, api.getPlayerY() - 1000) < 1,
  `phase=${api.getHookPhase()}`);

// 推进到拉拽阶段：玩家必须**逐帧移动**（不是瞬移）。
let observedMoving = false;
let observedPositions = [];
for (let i = 0; i < 400; i += 1) {
  step(0.016);
  const x = api.getPlayerX();
  const y = api.getPlayerY();
  if (api.getHookPhase() === "reel") {
    observedPositions.push({ x, y });
    if (observedPositions.length > 1) {
      const prev = observedPositions[observedPositions.length - 2];
      if (Math.hypot(x - prev.x, y - prev.y) > 0.5) observedMoving = true;
    }
  }
  if (!api.getHookActive()) break;
}
check("E 拉拽阶段：玩家逐帧移动（不是瞬移）", observedMoving,
  `记录了 ${observedPositions.length} 个拉拽帧`);
check("E 拉拽阶段：玩家确实被拉走了",
  Math.hypot(api.getPlayerX() - 100, api.getPlayerY() - 1000) > 100,
  `最终位移 ${Math.hypot(api.getPlayerX() - 100, api.getPlayerY() - 1000).toFixed(1)}`);

// 一直推进到落地
for (let i = 0; i < 400; i += 1) step(0.016);
check("E 结束后飞索状态清空", api.getHookActive() === false);

/* ---------- 5. R「飞索·移」充能 ---------- */

api.resetAll();
check("R 初始充能为满", api.getLeapCharges() === 5, `实际 ${api.getLeapCharges()}`);
api.castSkill(2);
check("R 使用后充能 -1", api.getLeapCharges() === 4, `实际 ${api.getLeapCharges()}`);

// 跳 1 秒后落地
for (let i = 0; i < 80; i += 1) step(0.016);
check("R 落地后空中状态清空", api.getLeapActive() === false);

// 3 秒后恢复 1 次
for (let i = 0; i < 200; i += 1) step(0.016);
check("R 每 3 秒恢复 1 次充能", api.getLeapCharges() === 5, `实际 ${api.getLeapCharges()}`);

/* ---------- 5b. 跳到屋顶内部：不触发地面范围伤害且仍可移动 ---------- */

api.resetAll();
api.setTestObstacles([BUILDING]);
api.setPlayerPosition(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
api.spawnEnemy(api.getPlayerX() + 60, api.getPlayerY(), 100);
api.castSkill(2);
for (let i = 0; i < 80; i += 1) step(0.016);
check("R 落在屋顶内部：正确识别为屋顶", api.getOnRooftop() === true);
check("R 落在屋顶内部：不会触发地面范围伤害", api.getEnemyHp() === 100,
  `敌人血量 ${api.getEnemyHp()}`);
const interiorX = api.getPlayerX();
const interiorY = api.getPlayerY();
api.movePlayer(24, 24);
check("R 落在屋顶内部：不被建筑碰撞卡住",
  api.getPlayerX() > interiorX && api.getPlayerY() > interiorY,
  `位置 (${interiorX}, ${interiorY}) -> (${api.getPlayerX()}, ${api.getPlayerY()})`);
check("R 落在屋顶内部：普攻被禁用", api.basicAttack() === false);
const roofEdgeY = api.getPlayerY();
api.movePlayer(240, 0);
check("不使用二技能：不能步行离开屋顶", api.getOnRooftop() === true);
check("屋顶步行被限制在平台内", api.getPlayerX() >= BUILDING.x && api.getPlayerX() <= BUILDING.x + BUILDING.w);
api.setMovementInput(1, 0);
api.castSkill(2);
for (let i = 0; i < 80; i += 1) step(0.016);
api.setMovementInput(0, 0);
check("使用二技能：可以从屋顶跳回地面", api.getOnRooftop() === false);
check("二技能落在建筑外侧", api.getPlayerX() > BUILDING.x + BUILDING.w,
  `x=${api.getPlayerX()}，建筑右边缘=${BUILDING.x + BUILDING.w}`);
const groundX = api.getPlayerX();
api.movePlayer(-20, 0);
check("下楼后可以继续在地面移动", api.getPlayerX() < groundX);
check("下楼操作没有意外改变高度", api.getPlayerY() === roofEdgeY,
  `y=${api.getPlayerY()}，下楼前 y=${roofEdgeY}`);

/* ---------- 5c. 二技能可以跨建筑跳跃，一技能只连接其他建筑 ---------- */

api.resetAll();
api.setTestObstacles([
  BUILDING,
  { x: 980, y: 250, w: 260, h: 330, type: "building" },
]);
jumpToRoof(BUILDING.x + BUILDING.w - 20, BUILDING.y + BUILDING.h / 2 - 19);
api.setMovementInput(1, 0);
api.castSkill(2);
for (let i = 0; i < 80; i += 1) step(0.016);
api.setMovementInput(0, 0);
check("二技能：可以从一栋建筑跳到另一栋", api.getOnRooftop() === true);
check("二技能跨建筑落点在目标平台上", api.getPlayerX() >= 980 && api.getPlayerX() <= 1240,
  `x=${api.getPlayerX()}`);

api.resetAll();
api.setTestObstacles([BUILDING]);
jumpToRoof(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
const energyBeforeInvalidHook = api.getEnergy();
api.castSkill(1);
check("屋顶一技能没有其他建筑时不启动", api.getHookActive() === false);
check("无有效建筑目标时不消耗能量", api.getEnergy() === energyBeforeInvalidHook);
check("屋顶一技能提示需要其他建筑", ids["map-toast"].textContent.includes("其他建筑"));

api.resetAll();
api.setTestObstacles([
  BUILDING,
  { x: 980, y: 250, w: 260, h: 330, type: "building" },
]);
jumpToRoof(BUILDING.x + 40, BUILDING.y + BUILDING.h / 2 - 19);
api.spawnEnemy(650, api.getPlayerY(), 500);
api.spawnEnemy(690, api.getPlayerY(), 500);
api.setTier("grapple-hook", 2);
api.castSkill(1);
check("屋顶一技能只锁定另一栋建筑", api.getHookTargetKind() === "building");
let rooftopDamageDuringReel = false;
for (let i = 0; i < 200 && api.getHookActive(); i += 1) {
  // 模拟持续按住与飞索方向相反的移动键，不能被旧屋顶平台边界夹回起点。
  api.movePlayer(-10000, 0);
  step(0.016);
  if (api.getHookPhase() === "reel" && (api.getEnemyHp(0) < 500 || api.getEnemyHp(1) < 500)) {
    rooftopDamageDuringReel = true;
  }
}
check("屋顶一技能转移到目标建筑", api.getOnRooftop() === true &&
  api.getPlayerX() >= 980 && api.getPlayerX() <= 1240,
  `位置 (${api.getPlayerX()}, ${api.getPlayerY()})`);
check("屋顶一技能转移途中对范围内敌人造成伤害",
  api.getEnemyHp(0) < 500 && api.getEnemyHp(1) < 500,
  `敌人血量 ${api.getEnemyHp(0)}, ${api.getEnemyHp(1)}`);
check("二阶全图眩晕时屋顶范围伤害仍即时结算", rooftopDamageDuringReel);

/* ---------- 6. Q「万重飞索」牵引 ---------- */

api.resetAll();
api.setPlayerPosition(100, 1000);
api.spawnEnemy(200, 1000, 100);
api.castSkill(0); // Q = 万重飞索
check("Q 施放后牵引状态激活", api.getMyriadActive() === true);
const enemyBefore = api.getEnemyPosition();
for (let i = 0; i < 80; i += 1) step(0.016);
const enemyAfter = api.getEnemyPosition();
check("Q 把敌人拉向自己",
  Math.hypot(enemyAfter.x - enemyBefore.x, enemyAfter.y - enemyBefore.y) > 20,
  `位移 ${Math.hypot(enemyAfter.x - enemyBefore.x, enemyAfter.y - enemyBefore.y).toFixed(1)}`);

/* ---------- 7. 建筑上禁用普攻 ---------- */

api.resetAll();
jumpToRoof(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
check("站在建筑上：普攻被禁用", api.basicAttack() === false);
check("站在建筑上：普攻被禁用提示已给出", ids["map-toast"].textContent.includes("建筑"));

// 地面上普攻正常
api.setPlayerPosition(BUILDING.x - 200, BUILDING.y + 500);
step(0.016);
api.spawnEnemy(api.getPlayerX() + 60, api.getPlayerY(), 100);
check("地面上：普攻可用", api.basicAttack() === true);

/* ---------- 8. 升阶行为 ---------- */

// 2 阶：命中瞬间对全场敌人施加眩晕（世界不再冻结），伤害延迟到落点结算。
api.resetAll();
api.setTier("grapple-hook", 2);
check("2 阶：升阶进度写入", api.getTier("grapple-hook") === 2);
api.spawnEnemy(600, 1000, 100);
api.spawnEnemy(1100, 300, 100); // 远处的敌人也要被晕 —— 全图，不是沿途
api.setPlayerPosition(100, 1000);
api.castSkill(1);
check("2 阶：全图眩晕时长已记录", api.getGlobalStun() >= 1.2,
  `眩晕 ${api.getGlobalStun().toFixed(2)}s`);
check("2 阶：近处敌人被眩晕", api.getEnemyEffects(0)["眩晕"] > 0);
check("2 阶：远处敌人同样被眩晕（全图）", api.getEnemyEffects(1)["眩晕"] > 0);
check("2 阶：时间停滞已彻底移除",
  api.getTimeStopped === undefined && api.getHookTimeStop === undefined);
const stunAtCast = api.getEnemyEffects(0)["眩晕"];
let driftWhileStunned = 0;
let hpWhileReel = 100;
const stunOrigin = api.getEnemyPosition();
for (let i = 0; i < 200 && api.getHookActive(); i += 1) {
  step(0.016);
  if (api.getHookPhase() === "reel") {
    const now = api.getEnemyPosition();
    driftWhileStunned = Math.max(driftWhileStunned,
      Math.hypot(now.x - stunOrigin.x, now.y - stunOrigin.y));
    hpWhileReel = Math.min(hpWhileReel, api.getEnemyHp());
  }
}
check("2 阶：眩晕期间敌人不动", driftWhileStunned < 1,
  `位移 ${driftWhileStunned.toFixed(2)}`);
check("2 阶：眩晕计时正常递减（世界没被冻结）",
  (api.getEnemyEffects(0)["眩晕"] || 0) < stunAtCast,
  `${stunAtCast.toFixed(2)} -> ${(api.getEnemyEffects(0)["眩晕"] || 0).toFixed(2)}`);
check("2 阶：拉拽期间伤害不结算", hpWhileReel === 100,
  `最低血量 ${hpWhileReel}`);
check("2 阶：落点后延迟伤害已结算", api.getEnemyHp() < 100,
  `当前血量 ${api.getEnemyHp()}`);

// 3 阶：只锁定建筑或地图边缘，穿透敌方；自身经过时眩晕（也会延迟结算）。
api.resetAll();
api.setTestObstacles([{ x: 400, y: 900, w: 120, h: 200, type: "building" }]);
api.setTier("grapple-hook", 3);
api.spawnEnemy(300, 1000, 100);
api.setPlayerPosition(100, 1000);
api.castSkill(1);
check("3 阶：飞索穿透敌人只锁定建筑",
  api.getHookTargetKind() === "building",
  `命中类型 ${api.getHookTargetKind()}`);
check("3 阶：继承 2 阶的全图眩晕", api.getGlobalStun() >= 1.2,
  `眩晕 ${api.getGlobalStun().toFixed(2)}s`);
for (let i = 0; i < 200 && api.getHookActive(); i += 1) step(0.016);
check("3 阶：穿透经过的敌人延迟结算伤害",
  api.getEnemyHp() < 100 && api.getEnemyEffects()["眩晕"] > 0,
  `血量 ${api.getEnemyHp()}，眩晕 ${api.getEnemyEffects()["眩晕"] || 0}`);

// 3 阶：建筑上可以普攻，但伤害减半 —— 用真实数值对比地面普攻。
const CITY_BLOCKS = [
  { x: BUILDING.x, y: BUILDING.y, w: BUILDING.w, h: BUILDING.h, type: "building" },
  { x: 980, y: 250, w: 260, h: 330, type: "building" },
];
api.resetAll();
api.setTestObstacles(CITY_BLOCKS);
api.setPlayerPosition(BUILDING.x - 200, BUILDING.y + 500);
step(0.016);
api.spawnEnemy(api.getPlayerX() + 60, api.getPlayerY(), 500);
const hpGroundBefore = api.getEnemyHp();
check("地面普攻命中", api.basicAttack() === true);
const groundDamage = hpGroundBefore - api.getEnemyHp();

api.resetAll();
api.setTestObstacles(CITY_BLOCKS);
api.setTier("grapple-leap", 3);
jumpToRoof(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2 - 19);
api.spawnEnemy(api.getPlayerX() + 60, api.getPlayerY(), 500);
const hpRoofBefore = api.getEnemyHp();
check("3 阶：站在建筑上可以普攻", api.basicAttack() === true);
const roofDamage = hpRoofBefore - api.getEnemyHp();
check("3 阶：屋顶普攻伤害为地面的一半",
  groundDamage > 0 && roofDamage === Math.round(groundDamage * 0.5),
  `地面 ${groundDamage} / 屋顶 ${roofDamage}`);

console.log(`\n${passed} checks passed`);
