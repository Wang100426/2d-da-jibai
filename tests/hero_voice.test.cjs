/* 英雄展示语音：DOM stub 真跑 static/select.js，验证按钮显隐、播放/停止、切英雄掐断。 */
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

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._text = "";
    this._class = "";
    this._ev = {};
    this.dataset = {};
    this.hidden = false;
    this.href = "";
    this.style = { setProperty() {}, width: "" };
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
    this._class = v;
    this._classes.clear();
    String(v).split(/\s+/).filter(Boolean).forEach((c) => this._classes.add(c));
  }
  get className() { return this._class; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html !== undefined ? this._html : this._text; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { this._ev[type] = fn; }
  click() { if (this._ev.click) this._ev.click({ preventDefault() {} }); }
  setAttribute(k, v) { this.dataset[k] = v; }
}

const ids = {};
for (const id of [
  "detail-portrait", "detail-initial", "detail-class", "detail-name", "detail-tagline",
  "detail-stats", "detail-skill-list", "detail-passive", "detail-passive-name",
  "detail-passive-desc", "detail-index", "selected-name", "enter-battle", "enter-shop",
  "detail-locked", "detail-locked-price", "voice-play", "voice-label",
]) {
  ids[id] = new El("div");
}
// 按钮上的多语言文案走 dataset（模板里就写在这里）
ids["voice-play"].dataset.playLabel = "试听语音";
ids["voice-play"].dataset.stopLabel = "停止播放";

const techBtn = new El("button");
techBtn.dataset.heroId = "tech";
const pipaBtn = new El("button");
pipaBtn.dataset.heroId = "pipa";
const lunaBtn = new El("button");
lunaBtn.dataset.heroId = "luna";
const voltBtn = new El("button");
voltBtn.dataset.heroId = "volt";

const documentStub = {
  hidden: false,
  getElementById: (id) => ids[id] || null,
  querySelectorAll: (sel) => (sel === "[data-hero-id]" ? [techBtn, pipaBtn, lunaBtn, voltBtn] : []),
  createElement: (tag) => new El(tag),
  addEventListener(type, fn) { this._ev = this._ev || {}; this._ev[type] = fn; },
  body: new El("body"),
};

const audios = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this._handlers = {};
    audios.push(this);
  }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  emit(type) { (this._handlers[type] || []).forEach((fn) => fn()); }
}

const hero = (id, voice) => ({
  id,
  name: id,
  class_name: "class",
  tagline: "tagline",
  initial: "X",
  accent: id,
  palette: { main: "#111", light: "#222", dark: "#333" },
  passive: { name: "p", description: "pd" },
  stats: { 攻击: 50, 防御: 50, 机动: 50 },
  skills: [{ id: `${id}-s`, name: "s", description: "d", kind: "大招", cooldown: 10 }],
  price: 0,
  locked: false,
  voice,
});

/** 全局静音开关（static/audio.js）的替身：静音时 play 返回 null。 */
let audioMuted = false;
let audioStopCalls = 0;

const code = fs.readFileSync(path.join("static", "select.js"), "utf8");
const sandbox = {
  console,
  document: documentStub,
  HTMLElement: El,
  HTMLDivElement: El,
  HTMLAnchorElement: El,
  HTMLButtonElement: El,
  Audio: FakeAudio,
  Object, Array, Map, Set, Number, String, Boolean, Math, JSON, Promise, Date, encodeURIComponent,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};
sandbox.window = {
  HERO_SELECTION: [
    hero("tech", "tech.mp3"),
    hero("pipa", "pipa.mp3"),
    hero("luna", "luna.mp3"),
    hero("volt", ""),
  ],
  GAME_MODE: "rogue",
  SELECT_TIER_LABELS: {},
  document: documentStub,
  GameAudio: {
    play(src) {
      if (audioMuted) return null;
      const audio = new FakeAudio(src);
      audio.play();
      return audio;
    },
    stop() { audioStopCalls += 1; },
    isMuted() { return audioMuted; },
  },
};
sandbox.globalThis = sandbox;

(async () => {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  await new Promise((r) => setImmediate(r));

  // 首屏：默认选中 tech，但**不应该**自动出声（没有用户手势）
  check("首屏不自动播放", audios.length === 0, String(audios.length));
  check("默认英雄有语音时按钮可见", ids["voice-play"].hidden === false);
  check("初始文案是「试听语音」", ids["voice-label"].textContent === "试听语音");

  // 点侧栏的英雄 → 自动播放
  pipaBtn.click();
  await new Promise((r) => setImmediate(r));
  check("点击英雄自动播放", audios.length === 1 && audios[0].paused === false, String(audios.length));
  check("自动播放音源正确", audios[0].src === "/static/voices/pipa.mp3", audios[0].src);
  check("自动播放进入播放态", ids["voice-play"].classList.contains("playing"));
  check("自动播放文案切成「停止播放」", ids["voice-label"].textContent === "停止播放");

  // 播放中切到另一个有语音的英雄 → 掐断上一条并播新的
  const first = audios[0];
  lunaBtn.click();
  await new Promise((r) => setImmediate(r));
  check("切英雄掐断上一条", first.paused === true);
  check("切过去后播新的", audios.length === 2 && audios[1].src === "/static/voices/luna.mp3", String(audios.length));

  // 再点当前英雄 → 重播（先停再播）
  lunaBtn.click();
  await new Promise((r) => setImmediate(r));
  check("重复点同一英雄会重播", audios.length === 3 && audios[2].src === "/static/voices/luna.mp3", String(audios.length));
  check("重播时上一条已停", audios[1].paused === true);

  // 按钮：播放中点一次 = 停止
  ids["voice-play"].click();
  check("播放中点按钮暂停", audios[2].paused === true);
  check("按钮退出播放态", ids["voice-play"].classList.contains("playing") === false);
  check("文案切回「试听语音」", ids["voice-label"].textContent === "试听语音");

  // 按钮：静止时点一次 = 重新播放当前英雄
  ids["voice-play"].click();
  await new Promise((r) => setImmediate(r));
  check("静止时点按钮重播", audios.length === 4 && audios[3].src === "/static/voices/luna.mp3", String(audios.length));

  // 播完自动复位
  audios[3].emit("ended");
  check("播放结束自动复位文案", ids["voice-label"].textContent === "试听语音");
  check("播放结束移除播放态", ids["voice-play"].classList.contains("playing") === false);

  // 点击无语音英雄 → 不产生音频，按钮隐藏
  voltBtn.click();
  await new Promise((r) => setImmediate(r));
  check("无语音英雄不播放", audios.length === 4, String(audios.length));
  check("无语音英雄隐藏按钮", ids["voice-play"].hidden === true);

  // 页面隐藏就停
  techBtn.click();
  await new Promise((r) => setImmediate(r));
  const last = audios[audios.length - 1];
  check("重新点有语音英雄会播", last.paused === false);
  documentStub.hidden = true;
  documentStub._ev["visibilitychange"]();
  check("切到后台会停止播放", last.paused === true);

  // 全局静音：点英雄不出声，按钮也不进播放态
  audioMuted = true;
  const beforeMute = audios.length;
  pipaBtn.click();
  await new Promise((r) => setImmediate(r));
  check("静音时点英雄不产生音频", audios.length === beforeMute, String(audios.length));
  check("静音时按钮不进播放态", ids["voice-play"].classList.contains("playing") === false);
  check("静音时文案保持「试听语音」", ids["voice-label"].textContent === "试听语音");
  check("静音时按钮仍然可见（还能取消静音后再听）", ids["voice-play"].hidden === false);
  check("静音时也调用了全局 stop", audioStopCalls > 0, String(audioStopCalls));

  // 取消静音后恢复
  audioMuted = false;
  lunaBtn.click();
  await new Promise((r) => setImmediate(r));
  check("取消静音后又能播", audios.length === beforeMute + 1 && audios[audios.length - 1].paused === false);

  console.log(`\n${passed} checks passed`);
})();
