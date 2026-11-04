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
    this.hidden = false;
    this.attributes = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => this._classes.add(n)),
      remove: (...names) => names.forEach((n) => this._classes.delete(n)),
      contains: (n) => this._classes.has(n),
      toggle: (n, on) => (on === undefined ? (this._classes.has(n) ? this._classes.delete(n) : this._classes.add(n)) : on ? this._classes.add(n) : this._classes.delete(n)),
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
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
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
  enter: "进入章节", continue: "继续", replay: "重读", notStarted: "未开始",
  inProgress: "进行中", completed: "已完成", heroChapter: "英雄剧情",
  worldChapter: "赛博世界", empty: "暂无", locked: "未解锁",
  lockedHint: "先完成上一段", fixedHeroShort: "本场固定出战",
  fileCount: "{count} 个记忆分区", ejected: "已弹出",
};

fixture.cards.push({
  id: "RC-H04", code: "RC-H04", title: "失落的终章", category: "hero",
  sections: [
    { id: "hero-dualtone-01", order: 0, title: "第一段", summary: "开篇", locked: false, completed: false, started: false },
    { id: "hero-dualtone-02", order: 1, title: "第二段", summary: "推进", locked: true, completed: false, started: false },
    { id: "hero-dualtone-03", order: 2, title: "第三段", summary: "终章", locked: true, completed: false, started: false },
  ],
});

const ids = {
  "story-tabs": new El("nav"),
  "story-card-list": new El("div"),
  "story-chapters": new El("ol"),
  "story-loaded-card": new El("section"),
  "story-screen-empty": new El("div"),
  "story-sidebar": new El("aside"),
  "story-sidebar-toggle": new El("button"),
  "story-workspace": new El("main"),
  "story-eject": new El("button"),
  "story-drive-slot": new El("span"),
  "story-explorer-path": new El("small"),
  "story-screen-status": new El("span"),
  "story-loaded-code": new El("small"),
  "story-loaded-title": new El("h1"),
  "story-loaded-summary": new El("p"),
  "story-loaded-quote": new El("blockquote"),
  "story-loaded-progress": new El("span"),
};
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
const cardList = ids["story-card-list"];
const fail = [];
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " :: " + extra : ""}`);
  if (!cond) fail.push(label);
}

let cards = cardList.find((n) => n._classes && n._classes.has("story-disc-card"));
check("默认显示赛博世界页的重现卡", cards.length === 1, String(cards.length));

const tabs = ids["story-tabs"].find((n) => n._classes && n._classes.has("story-tab"));
tabs[1].click();
cards = cardList.find((n) => n._classes && n._classes.has("story-disc-card"));
check("英雄剧情页包含四张卡", cards.length === 4, String(cards.length));
check("新增双音琴师重现卡可见", cards.some((card) => card.textContent.includes("RC-H04")));

const newCard = cards.find((card) => card.dataset.cardId === "RC-H04");
newCard.click();
check("点击卡片将其插入主机", ids["story-drive-slot"]._classes.has("has-disc"));
check("屏幕加载卡片标题", ids["story-loaded-title"].textContent === "失落的终章");
check("屏幕显示该卡的三个分区", grid.find((n) => n._classes && n._classes.has("story-section")).length === 3);

const buttons = grid.find((n) => n._classes && n._classes.has("story-section-enter"));
check("锁定分区的按钮被禁用", buttons.filter((button) => button.disabled).length === 2);
const openButton = buttons.find((button) => !button.disabled);
openButton.click();
check("点击已解锁分区进入剧情", navigated.some((url) => url.includes("hero-dualtone-01")));

ids["story-sidebar-toggle"].click();
check("侧栏可折叠并扩展显示器区域", ids["story-sidebar"]._classes.has("collapsed") && ids["story-workspace"]._classes.has("sidebar-collapsed") && ids["story-sidebar-toggle"].attributes["aria-expanded"] === "false");
ids["story-sidebar-toggle"].click();
check("侧栏可重新展开", !ids["story-sidebar"]._classes.has("collapsed") && ids["story-sidebar-toggle"].attributes["aria-expanded"] === "true");

ids["story-eject"].click();
check("弹出按钮卸载重现卡", !ids["story-drive-slot"]._classes.has("has-disc") && ids["story-loaded-card"].hidden);

console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(" | ")}` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
