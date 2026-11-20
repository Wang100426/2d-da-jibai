/**
 * 3.0.0 新英雄战斗测试：血月死神 / 零号壁垒。
 *
 * 用 DOM stub 真跑 static/app.js，通过 __grappleTest 钩子驱动战斗并断言状态。
 * 覆盖：击杀成长、吸血抑制、周期血月波与禁锢层数、多镰刀、献祭斩杀、
 *       绝对装甲充能护盾、钢铁领域减伤与冲击波、磁轨冲锋、最后防线反弹。
 *
 * 跑法：node tests/heroes_300.test.cjs
 */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail !== undefined ? ` — ${detail}` : ""}`);
  }
}

const LOCALE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locale", "zh.json"), "utf8"));
const APP_CODE = fs.readFileSync(path.join(__dirname, "..", "static", "app.js"), "utf8");

/* ---------- 最小 DOM stub ---------- */
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
  set className(v) { this._class = String(v); this._classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this._classes.add(c)); }
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
    if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
    if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (prop === "setLineDash") return () => {};
    return () => {};
  },
  set() { return true; },
});
function makeCanvas() { const c = new El("canvas"); c.getContext = () => ctxStub; return c; }

const ELEMENT_IDS = [
  "basic-attack", "combat-traits", "energy-bar", "energy-label", "final-wave", "hp-bar",
  "hp-label", "loot-count", "map-mode", "map-toast", "minimap", "peer-list",
  "pickup-key", "pickup-label", "pickup-prompt", "retry-run", "run-level", "run-over-overlay", "shield-bar",
  "skill-exp-bar", "skill-exp-label", "skill-upgrade-choices", "skill-upgrade-overlay",
  "skill-upgrade-subtitle", "skill-upgrade-title", "touch-mode-toggle", "upgrade-choices",
  "upgrade-overlay", "wave-subtitle", "wave-title",
];

/* ---------- 英雄配置（与 app.py HEROES 保持一致的关键字段） ---------- */
const BLOOD_SKILLS = [
  {
    id: "blood-ult", name: "立即执行", kind: "大招", target: "self", action: "blood_execute",
    cost: 65, cooldown: 20, damage: 0, radius: 0, effect: "眩晕", effect_turns: 1,
    self_hp_ratio: 0.3, enemy_hp_ratio: 0.5, stun_turns: 1, suppress_lifesteal: 1,
    tier_effects: {
      2: { label: "执行伤害 70%", patch: { enemy_hp_ratio: { set: 0.7 } } },
      3: { label: "眩晕 3 秒", patch: { stun_turns: { set: 3 } } },
    },
  },
  {
    id: "blood-moonrise", name: "血月升起", kind: "小技能", target: "self", action: "blood_moon_rise",
    cost: 30, cooldown: 10, damage: 6, radius: 200, effect: "禁锢", effect_turns: 1.5,
    moon_duration: 3, wave_interval: 0.5, wave_damage: 10, slow_ratio: 0.33, root_hits: 3, root_duration: 1.5,
    tier_effects: {
      2: { label: "持续 5 秒", patch: { moon_duration: { set: 5 } } },
      3: { label: "减速 50% / 2 次禁锢", patch: { slow_ratio: { set: 0.5 }, root_hits: { set: 2 }, root_duration: { set: 2.5 } } },
    },
  },
  {
    id: "blood-scythe", name: "带血镰刀", kind: "小技能", target: "enemy", action: "blood_scythe",
    cost: 35, cooldown: 12, damage: 45, radius: 200, effect: "眩晕", effect_turns: 1.5,
    impact_damage: 12, scythe_bonus_damage: 0, invuln_duration: 0.5, target_count: 1, dash_count: 1,
    tier_effects: {
      2: { label: "落点巨量", patch: { impact_damage: { set: 45 }, scythe_bonus_damage: { set: 45 } } },
      3: { label: "3 把镰刀", patch: { target_count: { set: 3 } } },
    },
  },
];
const BASTION_SKILLS = [
  {
    id: "void-ult", name: "最后防线", kind: "大招", target: "self", action: "last_stand",
    cost: 65, cooldown: 22, damage: 0, radius: 300, effect: "", effect_turns: 0,
    stand_duration: 5, self_reduction: 0.8, ally_reduction: 0.5, enemy_attack_speed_reduction: 0.3, reflect_ratio: 0,
    tier_effects: {
      2: { label: "7 秒 / 90%", patch: { stand_duration: { set: 7 }, self_reduction: { set: 0.9 } } },
      3: { label: "反弹 30%", patch: { reflect_ratio: { set: 0.3 } } },
    },
  },
  {
    id: "void-domain", name: "钢铁领域", kind: "小技能", target: "self", action: "steel_domain",
    cost: 30, cooldown: 11, damage: 5, radius: 200, effect: "", effect_turns: 0,
    domain_duration: 4, self_reduction: 0.4, enemy_slow_ratio: 0.2, tick_interval: 0.5, end_burst_damage: 0, end_knockback: 0,
    tier_effects: {
      2: { label: "6 秒 / 50%", patch: { domain_duration: { set: 6 }, self_reduction: { set: 0.5 } } },
      3: { label: "65% + 冲击波", patch: { self_reduction: { set: 0.65 }, end_burst_damage: { set: 60 }, end_knockback: { set: 160 } } },
    },
  },
  {
    id: "void-charge", name: "磁轨冲锋", kind: "小技能", target: "enemy", action: "mag_rail_charge",
    cost: 35, cooldown: 12, damage: 42, radius: 90, dash_range: 320, effect: "", effect_turns: 0,
    charge_reduction: 0.5, shield_ratio: 0.1, shield_duration: 5, knockback: 120, stun_turns: 0,
    pierce: 0, extra_hit_damage: 0, end_explosion_damage: 0,
    tier_effects: {
      2: { label: "距离 +50% / 眩晕", patch: { dash_range: { scale: 1.5 }, stun_turns: { set: 1 } } },
      3: { label: "穿敌 + 爆炸", patch: { pierce: { set: 1 }, extra_hit_damage: { set: 24 }, end_explosion_damage: { set: 70 } } },
    },
  },
];

const HEROES = {
  blood_reaper: {
    id: "blood_reaper", name: "血月死神", initial: "血", accent: "blood",
    palette: { main: "#d92e4f", light: "#ffb3c1", dark: "#4a0818" }, defense: 62,
    combat: {
      speed: 230, basic_range: 200, basic_damage: 14, basic_effect: "",
      basic_effect_turns: 0, basic_beam: { color: "#ff4d6d", duration: 0.16 },
      basic_restore_label: "RANGED_RESTORE", basic_hit_message: "命中，造成 {damage} 点伤害。",
      bot_skill_effect: "眩晕", bot_skill_effect_turns: 0.8, bot_skill_damage_scale: 2, thorns_damage: 0,
    },
    passive: {
      id: "blood_reaper_passive", name: "以血养血", description: "d",
      on_kill: { lifesteal: 0.02, max_hp: 10 }, uncapped: ["max_hp"], lifesteal_cap: 1,
    },
    stats: { 攻击: 88, 防御: 62, 机动: 80 }, skills: BLOOD_SKILLS, price: 0, locked: false,
  },
  void_bastion: {
    id: "void_bastion", name: "零号壁垒", initial: "盾", accent: "bastion",
    palette: { main: "#4f9dff", light: "#cfe4ff", dark: "#133a70" }, defense: 0,
    combat: {
      speed: 195, basic_range: 150, basic_damage: 14, basic_effect: "",
      basic_effect_turns: 0, basic_beam: null,
      basic_restore_label: "MELEE_RESTORE", basic_hit_message: "命中，造成 {damage} 点伤害。",
      bot_skill_effect: "眩晕", bot_skill_effect_turns: 0.8, bot_skill_damage_scale: 2, thorns_damage: 0,
    },
    passive: {
      id: "absolute_armor", name: "绝对装甲", description: "d",
      armor_per_hit: 0.01, armor_max_stacks: 10, armor_shield_ratio: 0.15, armor_shield_duration: 5,
    },
    stats: { 攻击: 58, 防御: 98, 机动: 42 }, skills: BASTION_SKILLS, price: 0, locked: false,
  },
};

function makeApi(heroId) {
  const hero = HEROES[heroId];
  const ids = {};
  ELEMENT_IDS.forEach((id) => { ids[id] = new El("div"); });
  ["upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay", "pickup-prompt", "final-wave"].forEach((id) => { ids[id].hidden = true; });
  ids.world = makeCanvas();
  ids.minimap = makeCanvas();
  const skillButtons = hero.skills.map((skill) => {
    const button = new El("button");
    button.dataset.skill = JSON.stringify(skill);
    button.querySelector = (s) => {
      if (s === ".skill-cooldown") return button._cd || (button._cd = new El("span"));
      if (s === ".skill-rank") return button._rank || (button._rank = new El("span"));
      if (s === ".skill-charges") return button._charges || (button._charges = new El("span"));
      return null;
    };
    return button;
  });
  const documentStub = {
    hidden: false,
    getElementById: (id) => ids[id] || null,
    querySelector: (s) => {
      if (s === "#world") return ids.world;
      if (s === "#minimap") return ids.minimap;
      const m = /^#([a-z-]+)$/.exec(s);
      return m ? (ids[m[1]] || null) : null;
    },
    querySelectorAll: (s) => {
      if (s === ".map-skill[data-skill]") return skillButtons;
      if (s === "canvas") return [ids.world, ids.minimap];
      return [];
    },
    createElement: (tag) => (tag === "canvas" ? makeCanvas() : new El(tag)),
    addEventListener() {}, removeEventListener() {},
    body: new El("body"), documentElement: new El("html"),
  };
  const sandbox = {
    console, document: documentStub,
    window: {
      innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
      addEventListener() {}, removeEventListener() {},
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
      setTimeout: () => 1, clearTimeout: () => {},
      setInterval: () => 1, clearInterval: () => {},
      performance: { now: () => 0 },
      location: { href: "", replace() {}, search: "" },
    },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setTimeout: () => 1, clearTimeout: () => {},
    setInterval: () => 1, clearInterval: () => {},
    performance: { now: () => 0 },
    Math, Date, JSON, Map, Set, WeakMap, Array, Object, Number, String, Boolean,
    isNaN, parseInt, parseFloat,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  };
  sandbox.window.document = documentStub;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.__GRAPPLE_TEST_HOOK__ = true;
  sandbox.window.MAP_CONFIG = {
    heroId, name: hero.name, playerName: "测试", initial: hero.initial, accent: hero.accent,
    roster: [hero], mapTheme: "city", skills: hero.skills, locale: LOCALE,
    duel: false, arena: false, defense: hero.defense, equipmentBonuses: {}, multiplayer: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(APP_CODE, sandbox);
  const api = sandbox.window.__grappleTest || sandbox.__grappleTest;
  if (!api) throw new Error("missing test hook");
  function step(dt = 0.016) {
    api.step(dt);
    ["upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay"].forEach((id) => { ids[id].hidden = true; });
  }
  function place(x, y, hp = 500) {
    api.setPlayerPosition(x, y);
    api.spawnEnemy(x + 120, y, hp);
  }
  return { api, step, place };
}

function near(actual, expected, tolerance = 1) {
  return Math.abs(actual - expected) <= tolerance;
}

/* ==================== 血月死神 ==================== */
{
  const { api, step, place } = makeApi("blood_reaper");
  api.resetAll();
  api.setPlayerMaxHp(200);
  place(100, 100, 500);
  const beforeHp = api.getPlayerHp();
  api.castSkill(0); // 立即执行
  check("血月·立即执行 献祭 30% 最大生命", near(beforeHp - api.getPlayerHp(), 60, 1), `${beforeHp} -> ${api.getPlayerHp()}`);
  check("血月·立即执行 敌人按 50% 最大生命失血", near(api.getEnemyHp(0), 500 - 100, 2), api.getEnemyHp(0));
  check("血月·立即执行 全场眩晕", !!(api.getEnemyEffects(0)["眩晕"] > 0), JSON.stringify(api.getEnemyEffects(0)));
  check("血月·立即执行 吸血被抑制", api.getLifestealSuppression() > 0, api.getLifestealSuppression());
}

{
  const { api, step, place } = makeApi("blood_reaper");
  api.resetAll();
  api.setPlayerMaxHp(200);
  place(100, 100, 1);
  api.castSkill(0); // 献祭同时击杀
  check("血月·被动 击杀 +10 最大生命", near(api.getMaxHp(), 210, 1), api.getMaxHp());
  check("血月·被动 击杀 +2% 吸血", near(api.getLifesteal(), 0.02, 0.001), api.getLifesteal());
}

{
  const { api, step, place } = makeApi("blood_reaper");
  api.resetAll();
  api.setPlayerMaxHp(100);
  api.setPlayerHp(20); // 低于 30%
  api.castSkill(0);
  step(0.016);
  check("血月·生命低于 30% 施放立即执行会死亡", api.getPlayerHp() === 0, api.getPlayerHp());
}

{
  const { api, step, place } = makeApi("blood_reaper");
  api.resetAll();
  place(100, 100, 500);
  api.applySkillTier("blood-moonrise", 3);
  api.castSkill(1); // 血月升起 3 阶
  step(0.51);
  step(0.51);
  const eff = api.getEnemyEffects(0);
  check("血月·3 阶 2 次命中即禁锢", !!(eff["禁锢"] > 0), JSON.stringify(eff));
  check("血月·3 阶 减速 50%", !!(eff["比例减速50"] > 0), JSON.stringify(eff));
  check("血月·持续伤害与波伤害生效", api.getEnemyHp(0) < 500, api.getEnemyHp(0));
}

{
  const { api, step, place } = makeApi("blood_reaper");
  api.resetAll();
  place(100, 100, 500);
  api.applySkillTier("blood-scythe", 3);
  api.castSkill(2); // 3 把镰刀
  check("血月·带血镰刀 命中眩晕", !!(api.getEnemyEffects(0)["眩晕"] > 0), JSON.stringify(api.getEnemyEffects(0)));
  check("血月·带血镰刀 进入无敌", near(api.getScytheDashRemaining(), 0.5, 0.01), api.getScytheDashRemaining());
  step(0.6);
  check("血月·带血镰刀 无敌后突进并结算落点伤害", api.getEnemyHp(0) < 500, api.getEnemyHp(0));
  check("血月·带血镰刀 突进状态结束", api.getScytheDashRemaining() === 0, api.getScytheDashRemaining());
}

/* ==================== 零号壁垒 ==================== */
{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  api.setPlayerMaxHp(1000);
  for (let i = 0; i < 10; i += 1) api.damagePlayer(1);
  check("壁垒·绝对装甲 每次受击 +1 层", api.getArmorCharges() === 10, api.getArmorCharges());
  api.damagePlayer(1); // 第 11 次满层触发
  check("壁垒·满层消耗全部层数", api.getArmorCharges() === 0, api.getArmorCharges());
  check("壁垒·满层获得 15% 最大生命护盾", near(api.getShield(), 150, 1), api.getShield());
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  api.setPlayerMaxHp(1000);
  const hp0 = api.getPlayerHp();
  api.damagePlayer(100);
  const raw = hp0 - api.getPlayerHp();
  api.resetAll();
  api.setPlayerMaxHp(1000);
  api.castSkill(1); // 钢铁领域
  const hp1 = api.getPlayerHp();
  api.damagePlayer(100);
  const reduced = hp1 - api.getPlayerHp();
  check("壁垒·钢铁领域 自身减伤 40%", near(reduced, raw * 0.6, 2), `raw=${raw} reduced=${reduced}`);
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  place(100, 100, 500);
  api.castSkill(1); // 钢铁领域 1 阶
  step(0.51);
  const eff = api.getEnemyEffects(0);
  check("壁垒·钢铁领域 敌人减速 20%", !!(eff["比例减速20"] > 0), JSON.stringify(eff));
  check("壁垒·钢铁领域 周期伤害", api.getEnemyHp(0) < 500, api.getEnemyHp(0));
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  place(100, 100, 500);
  api.applySkillTier("void-domain", 3);
  api.castSkill(1);
  for (let i = 0; i < 14; i += 1) step(0.5);
  check("壁垒·3 阶 钢铁领域结束冲击波巨量伤害", api.getEnemyHp(0) <= 440, api.getEnemyHp(0));
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  api.setPlayerMaxHp(1000);
  place(100, 100, 500);
  api.castSkill(2); // 磁轨冲锋
  step(0.25);
  check("壁垒·磁轨冲锋 撞击伤害", api.getEnemyHp(0) < 500, api.getEnemyHp(0));
  step(0.5);
  check("壁垒·磁轨冲锋 获得 10% 护盾", near(api.getShield(), 100, 2), api.getShield());
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  api.setPlayerMaxHp(1000);
  place(100, 100, 500);
  api.castSkill(0); // 最后防线
  check("壁垒·最后防线 敌人攻速削弱", !!(api.getEnemyEffects(0)["防线攻速削弱"] > 0), JSON.stringify(api.getEnemyEffects(0)));
  check("壁垒·最后防线 友方减伤光环已就绪", near(api.getAllyReduction(), 0.5, 0.001), api.getAllyReduction());
  const hp0 = api.getPlayerHp();
  api.damagePlayer(100);
  check("壁垒·最后防线 自身减伤 80%", near(hp0 - api.getPlayerHp(), 20, 2), hp0 - api.getPlayerHp());
}

{
  const { api, step, place } = makeApi("void_bastion");
  api.resetAll();
  api.setPlayerMaxHp(1000);
  place(100, 100, 500);
  api.applySkillTier("void-ult", 3);
  api.castSkill(0);
  api.damagePlayer(100); // 记录 20 点承伤
  for (let i = 0; i < 16; i += 1) step(0.5);
  check("壁垒·3 阶 最后防线结束反弹伤害", api.getEnemyHp(0) < 500, api.getEnemyHp(0));
  check("壁垒·最后防线 结束后光环清空", api.getAllyReduction() === 0, api.getAllyReduction());
}

console.log(`\n3.0.0 新英雄测试：${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
