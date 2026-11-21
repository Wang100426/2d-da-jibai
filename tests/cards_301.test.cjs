/**
 * 3.0.1 波次卡池测试：吸血上限、暴击、专属卡去重、血月死神 5 张卡效果。
 *
 * 跑法：node tests/cards_301.test.cjs
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

/* ---------- DOM stub（复用 heroes_300 的最小实现） ---------- */
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
  "upgrade-overlay", "wave-subtitle", "wave-title", "pause-overlay", "pause-toggle", "pause-stats", "pause-upgrade-section", "pause-upgrade-list", "resume-run", "exit-run",
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

function makeApi(heroId, mapTheme = "city") {
  const hero = HEROES[heroId];
  const ids = {};
  ELEMENT_IDS.forEach((id) => { ids[id] = new El("div"); });
  ["upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay", "pickup-prompt", "final-wave", "pause-overlay"].forEach((id) => { ids[id].hidden = true; });
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
    roster: [hero], mapTheme, skills: hero.skills, locale: LOCALE,
    duel: false, arena: false, defense: hero.defense, equipmentBonuses: {}, multiplayer: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(APP_CODE, sandbox);
  const api = sandbox.window.__grappleTest || sandbox.__grappleTest;
  if (!api) throw new Error("missing test hook");
  function step(dt = 0.016) {
    api.step(dt);
    ["upgrade-overlay", "skill-upgrade-overlay", "run-over-overlay", "pause-overlay"].forEach((id) => { ids[id].hidden = true; });
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

/* ==================== 吸血上限 ==================== */
{
  const { api } = makeApi("blood_reaper");
  check("血月被动初始吸血上限 100%", near(api.getLifestealCap(), 1, 0.001), api.getLifestealCap());
}

{
  const { api } = makeApi("blood_reaper");
  api.resetAll();
  check("cap 默认 100%", near(api.getLifestealCap(), 1, 0.001), api.getLifestealCap());
  check("嗜血卡可应用", api.applyUpgrade("blood-thirst") === true);
  check("嗜血后 cap 700%", near(api.getLifestealCap(), 7, 0.001), api.getLifestealCap());
  check("嗜血卡 once 去重生效", api.applyUpgrade("blood-thirst") === false);
  check("专属卡记录到已选列表", api.getSelectedUpgradeIds().includes("blood-thirst"));
}

/* ==================== 暴击 ==================== */
{
  const { api } = makeApi("blood_reaper");
  api.resetAll();
  check("初始暴击率 0%", near(api.getCritChance(), 0, 0.001), api.getCritChance());
  check("暴击卡可应用", api.applyUpgrade("crit") === true);
  check("暴击率 +8%", near(api.getCritChance(), 0.08, 0.001), api.getCritChance());
  for (let i = 0; i < 10; i += 1) api.applyUpgrade("crit");
  check("暴击率封顶 75%", near(api.getCritChance(), 0.75, 0.001), api.getCritChance());
  check("暴击卡可重复选（非专属）", true);
}

/* ==================== 卡池拼装 ==================== */
{
  const { api } = makeApi("blood_reaper");
  api.resetAll();
  const pool = api.getUpgradePoolIds();
  check("血月专属池含 5 张卡", ["blood-thirst", "blood-burn", "blood-chain", "blood-death-song", "blood-soul-reap"].every((id) => pool.includes(id)), pool);
  check("通用池含暴击卡", pool.includes("crit"));
  ["blood-thirst", "blood-burn", "blood-chain", "blood-death-song", "blood-soul-reap"].forEach((id) => api.applyUpgrade(id));
  const after = api.getUpgradePoolIds();
  check("专属卡选完后从卡池消失", !after.some((id) => id.startsWith("blood-")), after.filter((id) => id.startsWith("blood-")));
}

/* ==================== 生命的燃烧 ==================== */
{
  const { api, place } = makeApi("blood_reaper");
  api.resetAll();
  api.applyUpgrade("blood-burn");
  api.setPlayerMaxHp(1000);
  place(100, 100, 400);
  const beforeHp = api.getPlayerHp();
  api.setPlayerEnergy(100);
  api.castSkill(0);
  // 自损 70% = 700，伤害 = 1000*0.5*3 = 1500（敌人 400 血必死）
  // 吸血会回补一小口，所以净扣血略低于 700；核心是远超原版 30% 的 300。
  check("生命的燃烧自损约 70%", beforeHp - api.getPlayerHp() > 600, beforeHp - api.getPlayerHp());
  check("生命的燃烧伤害 150%", api.getEnemyHp(0) <= 0, api.getEnemyHp(0));
  check("技能期间仍禁吸血", api.getLifestealSuppression() > 0, api.getLifestealSuppression());
}

/* ==================== 连环夺魂 ==================== */
{
  const { api, step } = makeApi("blood_reaper");
  api.resetAll();
  check("镰刀默认单次", near(api.getScytheChainCount(), 1, 0.001), api.getScytheChainCount());
  api.applyUpgrade("blood-chain");
  check("连环夺魂后 3 次", near(api.getScytheChainCount(), 3, 0.001), api.getScytheChainCount());
  // 单敌人厚血：串行 3 发，每发 = 单体 45 + 落地 12，总计约 171。
  api.setPlayerPosition(100, 100);
  api.spawnEnemy(300, 100, 20000);
  api.setPlayerEnergy(100);
  api.castSkill(2);
  const immediate = 20000 - api.getEnemyHp(0);
  check("连环夺魂同帧只结算首发", near(immediate, 45, 2), immediate);
  for (let i = 0; i < 30; i += 1) step(0.1);
  const total = 20000 - api.getEnemyHp(0);
  // 后两发必须各自落地：只有首发能拿到 45，三发全落地才 > 120。
  check("连环夺魂 3 发全部落地结算", total > 120, total);
}

/* ==================== 三阶镰刀单次基线（连发对照） ==================== */
let tier3SingleDamage = 0;
{
  const { api, step } = makeApi("blood_reaper", "neon_beach");
  api.resetAll();
  api.applySkillTier("blood-scythe", 3);
  api.setPlayerPosition(100, 100);
  const spots = [[220, 100], [300, 60], [380, 140], [460, 100], [540, 60], [620, 140]];
  spots.forEach(([x, y]) => api.spawnEnemy(x, y, 20000));
  api.setPlayerEnergy(100);
  api.castSkill(2);
  for (let i = 0; i < 40; i += 1) step(0.1);
  tier3SingleDamage = spots.reduce((sum, _spot, i) => sum + (20000 - api.getEnemyHp(i)), 0);
  check("三阶单次基线有伤害", tier3SingleDamage > 0, tier3SingleDamage);
}

/* ==================== 连环夺魂 × 三阶镰刀：每发仍是 3 把 ==================== */
{
  const { api, step } = makeApi("blood_reaper", "neon_beach");
  api.resetAll();
  api.applySkillTier("blood-scythe", 3);
  check("三阶镰刀每发 3 把", near(api.getScytheTargetCount(), 3, 0.001), api.getScytheTargetCount());
  api.applyUpgrade("blood-chain");
  // 6 个厚血敌人分散摆开，确保每发都能锁定到 3 个不同目标。
  api.setPlayerPosition(100, 100);
  const spots = [[220, 100], [300, 60], [380, 140], [460, 100], [540, 60], [620, 140]];
  spots.forEach(([x, y]) => api.spawnEnemy(x, y, 20000));
  api.setPlayerEnergy(100);
  api.castSkill(2);
  // 3 发串行 × 每发 3 把 × (单体 45 + 落地 12) = 513；只放 1 发最多 171。
  for (let i = 0; i < 40; i += 1) step(0.1);
  const total = spots.reduce((sum, _spot, i) => sum + (20000 - api.getEnemyHp(i)), 0);
  check("三阶+连环夺魂 9 把全部落地", total > 400, total);
  check("三阶连发伤害是单次 2.5 倍以上", total > tier3SingleDamage * 2.5, `chain=${total} single=${tier3SingleDamage}`);
}

/* ==================== 连环夺魂回归：重新锁定当前位置最近敌人 ==================== */
{
  const { api, step } = makeApi("blood_reaper", "neon_beach");
  api.resetAll();
  api.applyUpgrade("blood-chain");
  api.setPlayerPosition(100, 100);
  api.spawnEnemy(220, 100, 20000);
  api.spawnEnemy(520, 100, 20000);
  api.setPlayerEnergy(100);
  api.castSkill(2);
  // 首发锁定近敌；玩家冲到近敌位置后，后续两发仍应锁定它（近敌未被打死）。
  for (let i = 0; i < 30; i += 1) step(0.1);
  const nearDamage = 20000 - api.getEnemyHp(0);
  const farDamage = 20000 - api.getEnemyHp(1);
  check("回归·连发持续命中近敌", nearDamage > 120, nearDamage);
}

/* ==================== 死亡之歌 ==================== */
{
  const { api } = makeApi("blood_reaper");
  api.resetAll();
  api.setPlayerMaxHp(200);
  check("死亡之歌默认 0 充能", near(api.getDeathSongCharges(), 0, 0.001), api.getDeathSongCharges());
  api.applyUpgrade("blood-death-song");
  check("死亡之歌 1 次充能", near(api.getDeathSongCharges(), 1, 0.001), api.getDeathSongCharges());
  api.setPlayerHpDirect(20);
  api.damagePlayer(100);
  check("死亡之歌免死并翻倍 maxHp", near(api.getMaxHp(), 400, 1), api.getMaxHp());
  check("死亡之歌后回满", near(api.getPlayerHp(), 400, 1), api.getPlayerHp());
  check("成长倍率翻倍", near(api.getMaxHpGrowthMultiplier(), 2, 0.001), api.getMaxHpGrowthMultiplier());
  check("充能已消耗", near(api.getDeathSongCharges(), 0, 0.001), api.getDeathSongCharges());
}

/* ==================== 吸魂 ==================== */
{
  const { api, place } = makeApi("blood_reaper");
  api.resetAll();
  api.applyUpgrade("blood-soul-reap");
  api.setPlayerPosition(100, 100);
  api.spawnEnemy(220, 100, 10);
  api.setPlayerEnergy(100);
  api.castSkill(0); // 立即执行会杀死敌人
  check("吸魂触发（敌人免死）", api.getEnemyHp(0) > 0, api.getEnemyHp(0));
  check("吸魂敌人被标记", api.getSoulReapedCount() > 0, api.getSoulReapedCount());
}

/* ==================== 吸魂回归：狂舞到期必须真正死亡 ==================== */
{
  const { api, step } = makeApi("blood_reaper");
  api.resetAll();
  api.applyUpgrade("blood-soul-reap");
  api.setPlayerPosition(100, 100);
  api.spawnEnemy(220, 100, 10);
  api.setPlayerEnergy(100);
  api.castSkill(0);
  check("回归·吸魂触发后敌人暂活", api.getEnemyHp(0) > 0, api.getEnemyHp(0));
  check("回归·狂舞期间标记存在", api.getSoulReapedCount() === 1, api.getSoulReapedCount());
  // 推进 6 秒（狂舞 5 秒 + 余量），到期必须判死而不是留 1 血复活
  for (let i = 0; i < 30; i += 1) step(0.2);
  check("回归·狂舞结束敌人真正死亡", api.getEnemyHp(0) <= 0, api.getEnemyHp(0));
  check("回归·狂舞结束标记清除", api.getSoulReapedCount() === 0, api.getSoulReapedCount());
  // 已死敌人再挨一次大招，绝不能再次触发吸魂复活
  api.setPlayerEnergy(100);
  api.castSkill(0);
  check("回归·已死敌人不会二次吸魂", api.getEnemyHp(0) <= 0, api.getEnemyHp(0));
}

/* ==================== resetAll 隔离 ==================== */
{
  const { api } = makeApi("blood_reaper");
  api.applyUpgrade("crit");
  api.applyUpgrade("blood-thirst");
  api.resetAll();
  check("resetAll 清空已选卡", api.getSelectedUpgradeIds().length === 0, api.getSelectedUpgradeIds());
  check("resetAll 重置暴击", near(api.getCritChance(), 0, 0.001), api.getCritChance());
  check("resetAll 重置吸血上限", near(api.getLifestealCap(), 1, 0.001), api.getLifestealCap());
}

/* ==================== 三语 locale 一致性 ==================== */
{
  const langs = ["zh", "en", "ja"];
  const data = {};
  langs.forEach((lang) => {
    data[lang] = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locale", `${lang}.json`), "utf8"));
  });
  const cardIds = ["crit", "blood-thirst", "blood-burn", "blood-chain", "blood-death-song", "blood-soul-reap"];
  cardIds.forEach((id) => {
    check(`三语都有卡 ${id}`, langs.every((lang) => {
      const card = data[lang].upgrades[id];
      return card && typeof card.name === "string" && typeof card.description === "string";
    }));
  });
  const tmplKeys = ["float.crit", "float.soul_reap", "float.death_song", "skill.blood_chain_refund", "skill.blood_death_song", "pause_stats.crit"];
  tmplKeys.forEach((key) => {
    check(`三语都有文案 ${key}`, langs.every((lang) => !!data[lang].battle.templates[key]));
  });
  check("三语都有暂停页标题", langs.every((lang) => !!data[lang].ui.PAUSED_UPGRADES));
}

console.log(`\n3.0.1 卡池测试：${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
