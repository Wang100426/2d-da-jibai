/* 临时脚本：DOM stub 跑 static/story.js，验证战斗节点的英雄选择分支。跑完删除。 */
const fs = require("node:fs");
const vm = require("node:vm");

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._text = "";
    this._class = "";
    this._ev = {};
    this.dataset = {};
    this.disabled = false;
    this.style = { setProperty() {}, backgroundImage: "" };
    const set = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => set.add(n)),
      remove: (...names) => names.forEach((n) => set.delete(n)),
      contains: (n) => set.has(n),
      toggle: (n, on) => (on ? set.add(n) : set.delete(n)),
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

const ids = {};
for (const id of ["story-stage", "story-backdrop", "story-skip", "story-progress", "story-title", "story-chapter"]) {
  ids[id] = new El("div");
}

const fetched = [];
const documentStub = {
  getElementById: (id) => ids[id] || null,
  createElement: (tag) => new El(tag),
  addEventListener() {},
  body: new El("body"),
};

function makeWindow(search, chapter, progress, heroes) {
  return {
    STORY_CHAPTER: chapter,
    STORY_PROGRESS: progress,
    STORY_CHAPTERS: [],
    STORY_ROSTER: heroes,
    STORY_HEROES: heroes,
    STORY_STRINGS: {
      progress: "进度", clickHint: "点击继续", choiceHint: "选择", wave: "波次",
      event: "战场事件", cooldown: "冷却", damage: "伤害", brief: "简报",
      startBattle: "开始战斗", retryBattle: "重试战斗", battleLost: "战斗失败，可以重试。",
      battleKicker: "剧情战斗", targetWaves: "目标波次", pickHero: "选择出战英雄",
      fixedHero: "本场固定出战", backChoose: "返回剧情选择", continue: "继续",
      objectiveKicker: "任务目标", goalDone: "标记完成", goalUndo: "取消",
      objectiveBlocked: "完成全部目标后才能继续。", rewardKicker: "奖励",
      rewardClaiming: "领取中…", rewardAlready: "已领取", rewardGained: "已获得 {coins}",
      rewardInfinite: "无限", rewardFailed: "失败", rewardInvalid: "缺失",
      chapterEndKicker: "章节完成", replay: "从头再看", skipFailed: "没有可跳过的战斗",
      broken: "异常", unknown_node: "未知", invalid_transition: "无法继续",
    },
    location: { search, pathname: "/story", href: "", replace(url) { this.href = url; } },
    history: { replaceState() {} },
    setInterval: (fn) => { fn(); return 0; },
    clearInterval() {},
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout() {},
    fetch: (url, options) => {
      fetched.push({ url, body: options && options.body });
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, gained: 0, already_claimed: true }) });
    },
  };
}

const code = fs.readFileSync("static/story.js", "utf8");
const fixture = JSON.parse(fs.readFileSync("tests/fixtures/chapters.zh.json", "utf8"));
const sections = fixture.sections;

function boot(win) {
  Object.keys(ids).forEach((k) => { ids[k].replaceChildren(); });
  const sandbox = {
    console,
    document: documentStub,
    window: win,
    fetch: win.fetch,
    URLSearchParams,
    Promise,
    Object,
    Array,
    Map,
    Set,
    Number,
    String,
    Boolean,
    Math,
    JSON,
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return ids["story-stage"];
}

const heroList = [
  { id: "volt", name: "霓虹拳王", initial: "拳", palette: { main: "#ff4fa3", light: "#ffd3e8", dark: "#812354" }, locked: false, price: 0 },
  { id: "moss", name: "苔藓守卫", initial: "苔", palette: { main: "#b7ef55", light: "#e9ffb7", dark: "#263b2d" }, locked: false, price: 0 },
  { id: "jianghu", name: "江湖客", initial: "江", palette: { main: "#ffd98e", light: "#fff6d8", dark: "#7a4a12" }, locked: true, price: 1000 },
];

const fail = [];
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " :: " + extra : ""}`);
  if (!cond) fail.push(label);
}

const cyber = sections.find((s) => s.id === "rc001-p0");
const heroChapter = sections.find((s) => s.id === "hero-volt-01");

// 1. 赛博世界剧情：战斗节点应出现英雄选择器
let stage = boot(makeWindow("?chapter=rc001-p0", cyber, { node: "p0-battle" }, heroList));
let picker = stage.find((n) => n.className === "story-hero-pick")[0];
check("赛博世界剧情渲染英雄选择器", Boolean(picker));
let options = stage.find((n) => n._classes && n._classes.has("story-hero-option"));
check("选择器列出全部英雄", options.length === 3, String(options.length));
check("未解锁英雄被禁用", options.filter((o) => o.disabled).length === 1);
check("默认选中第一个可用英雄", options[0]._classes.has("selected"), options[0].className);

// 2. 英雄剧情：不出现选择器，显示固定出战
stage = boot(makeWindow("?chapter=hero-volt-01", heroChapter, { node: "h1-battle" }, heroList));
picker = stage.find((n) => n.className === "story-hero-pick")[0];
check("英雄剧情不渲染英雄选择器", !picker);
const metaText = stage.find((n) => n.className === "story-battle-meta")[0].textContent;
check("英雄剧情显示固定出战", metaText.includes("本场固定出战") && metaText.includes("霓虹拳王"), metaText);

// 3. 失败结果：显示重试 + 退出
stage = boot(makeWindow("?chapter=rc001-p0&result=lose", cyber, { node: "p0-battle" }, heroList));
const note = stage.find((n) => n.className === "story-fail-note")[0];
check("失败时显示失败提示", Boolean(note), note && note.textContent);
const startBtn = stage.find((n) => n.className && n.className.includes("story-start"))[0];
// 按钮文案通过 innerHTML 写入，stub 里存在 _html 上
const startText = startBtn ? (startBtn._html || startBtn.textContent) : "";
check("失败时按钮变为重试", startText.includes("重试战斗"), startText);
const exitLink = stage.find((n) => n.tagName === "A" && n.href === "/story/choose")[0];
check("失败时提供返回剧情选择", Boolean(exitLink));

// 4. 胜利结果：推进到奖励节点并请求发奖
stage = boot(makeWindow("?chapter=rc001-p0&result=win", cyber, { node: "p0-battle" }, heroList));
const reward = stage.find((n) => n.className === "story-reward")[0];
check("胜利推进到奖励节点", Boolean(reward));
check("奖励节点请求 /api/story/reward", fetched.some((f) => f.url === "/api/story/reward"),
  JSON.stringify(fetched.map((f) => f.url)));

// 5. 已完成存档：直接进结束页
stage = boot(makeWindow("?chapter=rc001-p0", cyber, { node: "p0-end", completed: true }, heroList));
check("已完成章节直接显示结束页", Boolean(stage.find((n) => n.className === "story-end")[0]));

console.log(fail.length ? `\n${fail.length} FAILED: ${fail.join(" | ")}` : "\nALL PASS");
process.exit(fail.length ? 1 : 0);
