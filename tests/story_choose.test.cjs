/* 重现卡库渲染测试：DOM stub 跑 static/choose_story.js，验证分区列表与锁定禁用。 */
const fs = require("node:fs");
const vm = require("node:vm");

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._text = "";
    this._class = "";
    this._ev = {};
    this.disabled = false;
    this.dataset = {};
    this.style = { setProperty() {} };
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => this._classes.add(n)),
      remove: (...names) => names.forEach((n) => this._classes.delete(n)),
      contains: (n) => this._classes.has(n),
      toggle: (n, on) => (on ? this._classes.add(n) : this._classes.delete(n)),
    };
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
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  remove() {}
  addEventListener(type, fn) { this._ev[type] = fn; }
  click() { if (this._ev.click) this._ev.click({ preventDefault() {} }); }
  find(pred, out = []) {
    for (const c of this.children) {
      if (pred(c)) out.push(c);
      if (c.find) c.find(pred, out);
    }
    return out;
  }
}

const fixture = JSON.parse(fs.readFileSync("tests/fixtures/chapters.zh.json", "utf8"));
const strings = {
  all: "全部", enter: "进入章节", continue: "继续", replay: "重读", notStarted: "未开始",
  inProgress: "进行中", completed: "已完成", nodes: "节点", heroChapter: "英雄剧情",
  worldChapter: "赛博世界", empty: "暂无", cleared: "已通关", locked: "未解锁",
  lockedHint: "先完成上一段", fixedHeroShort: "本场固定出战",
};

const ids = { "story-tabs": new El("nav"), "story-chapters": new El("section") };
const navigated = [];

const sandbox = {
  console,
  document: {
    getElementById: (id) => ids[id] || null,
    createElement: (tag) => new El(tag),
    addEventListener() {},
    body: new El("body"),
  },
  window: {
    STORY_CATEGORIES: [
      { id: "cyber", order: 1, name: "赛博世界剧情", description: "" },
      { id: "hero", order: 2, name: "英雄剧情", description: "" },
    ],
    STORY_CARDS: fixture.cards,
    STORY_PROGRESS: { version: 1, chapters: {} },
    STORY_ROSTER: [
      { id: "volt", name: "霓虹拳王", initial: "拳", palette: { main: "#f4f", light: "#fdf", dark: "#333" } },
    ],
    STORY_STRINGS: strings,
    location: { href: "" },
  },
};
sandbox.window.window = sandbox.window;
Object.defineProperty(sandbox.window.location, "href", {
  get: () => "",
  set: (value) => navigated.push(value),
});

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("static/choose_story.js", "utf8"), sandbox);

const grid = ids["story-chapters"];
const fail = [];
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " :: " + extra : ""}`);
  if (!cond) fail.push(label);
}

let cards = grid.find((n) => n._classes && n._classes.has("story-card"));
check("默认只显示第一个分类的卡", cards.length === 1, String(cards.length));

let rows = grid.find((n) => n._classes && n._classes.has("story-section"));
check("RC-001 渲染出四个分区", rows.length === 4, String(rows.length));

// 切到「全部」应显示两张卡
const tabs = ids["story-tabs"].find((n) => n._classes && n._classes.has("story-tab"));
tabs[0].click();
cards = grid.find((n) => n._classes && n._classes.has("story-card"));
rows = grid.find((n) => n._classes && n._classes.has("story-section"));
check("切到全部后有两张卡", cards.length === 2, String(cards.length));
check("全部视图共五行分区", rows.length === 5, String(rows.length));

const lockedRows = rows.filter((r) => r._classes.has("locked"));
check("RC-001 的后三段是锁定态", lockedRows.length === 3, String(lockedRows.length));

const buttons = grid.find((n) => n._classes && n._classes.has("story-section-enter"));
const disabled = buttons.filter((b) => b.disabled);
check("锁定分区的按钮被禁用", disabled.length === 3, String(disabled.length));

const openButton = buttons.find((b) => !b.disabled);
check("解锁分区有可用按钮", Boolean(openButton));
if (openButton) {
  openButton.click();
  check("点击跳转到对应分区", navigated.some((u) => u.includes("/story?chapter=")), JSON.stringify(navigated));
}

const firstCard = cards[0];
check("卡上显示编号 RC-001", firstCard.textContent.includes("RC-001"), firstCard.textContent.slice(0, 30));
check("卡上显示通关进度", firstCard.textContent.includes("已通关"), firstCard.textContent.slice(0, 60));

console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(" | ")}` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
