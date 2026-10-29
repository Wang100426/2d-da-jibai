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
const voltBtn = new El("button");
voltBtn.dataset.heroId = "volt";

const documentStub = {
  hidden: false,
  getElementById: (id) => ids[id] || null,
  querySelectorAll: (sel) => (sel === "[data-hero-id]" ? [techBtn, pipaBtn, voltBtn] : []),
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
  HERO_SELECTION: [hero("tech", "tech.mp3"), hero("pipa", "pipa.mp3"), hero("volt", "")],
  GAME_MODE: "rogue",
  SELECT_TIER_LABELS: {},
  document: documentStub,
};
sandbox.globalThis = sandbox;

(async () => {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  await new Promise((r) => setImmediate(r));

  // 默认选中第一个（tech，有语音）
  check("默认英雄有语音时按钮可见", ids["voice-play"].hidden === false);
  check("初始文案是「试听语音」", ids["voice-label"].textContent === "试听语音");

  // 播放
  ids["voice-play"].click();
  await new Promise((r) => setImmediate(r));
  check("点击后创建了 Audio", audios.length === 1, String(audios.length));
  check("音源指向 static/voices", audios[0].src === "/static/voices/tech.mp3", audios[0].src);
  check("开始播放", audios[0].paused === false);
  check("按钮进入播放态", ids["voice-play"].classList.contains("playing"));
  check("文案切成「停止播放」", ids["voice-label"].textContent === "停止播放");

  // 再点一次 → 停止
  ids["voice-play"].click();
  check("再点一次暂停", audios[0].paused === true);
  check("按钮退出播放态", ids["voice-play"].classList.contains("playing") === false);
  check("文案切回「试听语音」", ids["voice-label"].textContent === "试听语音");

  // 播放中切英雄 → 掐断
  ids["voice-play"].click();
  await new Promise((r) => setImmediate(r));
  const playing = audios[audios.length - 1];
  pipaBtn.click();
  check("切到另一个有语音的英雄会先停掉上一条", playing.paused === true);
  check("切到 pipa 后按钮仍然可见", ids["voice-play"].hidden === false);

  // 播放 pipa
  ids["voice-play"].click();
  await new Promise((r) => setImmediate(r));
  const pipaAudio = audios[audios.length - 1];
  check("pipa 音源正确", pipaAudio.src === "/static/voices/pipa.mp3", pipaAudio.src);

  // 播完自动复位
  pipaAudio.emit("ended");
  check("播放结束自动复位文案", ids["voice-label"].textContent === "试听语音");
  check("播放结束移除播放态", ids["voice-play"].classList.contains("playing") === false);

  // 无语音英雄 → 按钮隐藏
  voltBtn.click();
  check("无语音英雄隐藏按钮", ids["voice-play"].hidden === true);

  // 页面隐藏就停
  techBtn.click();
  ids["voice-play"].click();
  await new Promise((r) => setImmediate(r));
  const last = audios[audios.length - 1];
  documentStub.hidden = true;
  documentStub._ev["visibilitychange"]();
  check("切到后台会停止播放", last.paused === true);

  console.log(`\n${passed} checks passed`);
})();
