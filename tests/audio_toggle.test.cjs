/* 全局静音开关：DOM stub 真跑 static/audio.js，验证持久化、静音拦截、按钮同步与停播事件。 */
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
  constructor() {
    this._attrs = {};
    this._classes = new Set();
    this.classList = {
      add: (n) => this._classes.add(n),
      remove: (n) => this._classes.delete(n),
      contains: (n) => this._classes.has(n),
      toggle: (n, on) => (on ? this._classes.add(n) : this._classes.delete(n)),
    };
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; }
  closest(sel) {
    return sel === "[data-audio-toggle]" ? this : null;
  }
}

const toggleButton = new El();
toggleButton.setAttribute("data-label-audible", "语音开");
toggleButton.setAttribute("data-label-muted", "已静音");

const events = {};
const documentStub = {
  readyState: "complete",
  querySelectorAll: (sel) => (sel === "[data-audio-toggle]" ? [toggleButton] : []),
  addEventListener: (type, fn) => { (events[type] = events[type] || []).push(fn); },
  dispatchEvent: (evt) => { (events[evt.type] || []).forEach((fn) => fn(evt)); },
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

const store = {};
const sandbox = {
  console,
  document: documentStub,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  Audio: FakeAudio,
  CustomEvent: class {
    constructor(type) { this.type = type; }
  },
  Object, Array, Number, String, Boolean, Math, JSON, Promise, Date,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const code = fs.readFileSync(path.join("static", "audio.js"), "utf8");

(async () => {
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  await new Promise((r) => setImmediate(r));

  check("暴露 GameAudio 全局", typeof sandbox.GameAudio === "object");
  check("默认不静音", sandbox.GameAudio.isMuted() === false);
  check("按钮初始 aria-pressed=false", toggleButton.getAttribute("aria-pressed") === "false");
  check("按钮标题是「语音开」", toggleButton.getAttribute("title") === "语音开");

  // 正常播放
  const first = sandbox.GameAudio.play("/static/voices/tech.mp3");
  check("非静音时能播", first instanceof FakeAudio && first.paused === false);
  check("音源正确", first.src === "/static/voices/tech.mp3", first.src);

  // 再播一条 → 前一条自动停
  const second = sandbox.GameAudio.play("/static/voices/pipa.mp3");
  check("新播放会停掉上一条", first.paused === true);
  check("同一时间只留一条", second.paused === false);

  // 点按钮静音
  const clickHandler = events.click[0];
  clickHandler({ target: toggleButton, preventDefault() {} });
  check("点按钮后静音", sandbox.GameAudio.isMuted() === true);
  check("静音写入 localStorage", store["2d-da-jibai-muted"] === "1", store["2d-da-jibai-muted"]);
  check("静音时按钮 aria-pressed=true", toggleButton.getAttribute("aria-pressed") === "true");
  check("静音时按钮加 muted 类", toggleButton.classList.contains("muted"));
  check("静音时按钮标题变「已静音」", toggleButton.getAttribute("title") === "已静音");
  check("静音会立刻停掉正在播的", second.paused === true);

  // 静音期间 play 应该被拦
  const before = audios.length;
  const blocked = sandbox.GameAudio.play("/static/voices/luna.mp3");
  check("静音时 play 返回 null", blocked === null);
  check("静音时不会创建 Audio", audios.length === before, String(audios.length));

  // 取消静音
  clickHandler({ target: toggleButton, preventDefault() {} });
  check("再点一次取消静音", sandbox.GameAudio.isMuted() === false);
  check("取消静音写回 0", store["2d-da-jibai-muted"] === "0");
  check("按钮移除 muted 类", toggleButton.classList.contains("muted") === false);
  const resumed = sandbox.GameAudio.play("/static/voices/luna.mp3");
  check("取消静音后能播", resumed instanceof FakeAudio && resumed.paused === false);

  // 主动 stop 会派发 gameaudio:stop
  let stops = 0;
  documentStub.addEventListener("gameaudio:stop", () => { stops += 1; });
  sandbox.GameAudio.stop();
  check("stop() 派发 gameaudio:stop", stops === 1, String(stops));
  check("stop() 停掉音频", resumed.paused === true);
  sandbox.GameAudio.stop();
  check("没在播时 stop() 不重复派发", stops === 1, String(stops));

  // 静音时 play 也会派发一次 stop，方便页面复位按钮
  sandbox.GameAudio.setMuted(true);
  stops = 0;
  sandbox.GameAudio.play("/static/voices/tech.mp3");
  check("静音下 play 派发 stop 事件", stops === 1, String(stops));

  console.log(`\n${passed} checks passed`);
})();
