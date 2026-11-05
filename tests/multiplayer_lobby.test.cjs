/* 联机大厅 2.3.1：用 DOM stub 真跑 static/multiplayer.js，验证「创建/加入 → 房间 → 准备 → 进战斗」。
 * 跑法：npm run build（先出 multiplayer.js）之后 node tests/multiplayer_lobby.test.cjs
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

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._text = "";
    this._class = "";
    this._ev = {};
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.value = "";
    this.attributes = {};
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
  set innerHTML(v) { this._html = String(v); this._text = ""; }
  get innerHTML() { return this._html !== undefined ? this._html : this._text; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { this._ev[type] = fn; }
  click() { if (this._ev.click) this._ev.click({ preventDefault() {} }); }
  focus() {}
  setAttribute(k, v) { this.attributes[k] = String(v); }
}

const ids = {};
for (const id of [
  "player-name", "hero-select", "room-code", "join-row", "mp-entry", "waiting-room",
  "waiting-players", "waiting-message", "mp-prep", "prep-countdown", "ready-toggle",
  "start-game", "mp-toast", "lan-addresses", "create-room", "join-toggle", "join-room",
  "leave-room", "current-room-code", "mp-selected-mode", "room-mode-label",
]) {
  ids[id] = new El(id.includes("room-code") || id.includes("player-name") ? "input" : "div");
}
const modeButtons = ["ai", "duel", "rogue"].map((mode) => {
  const button = new El("button");
  button.dataset.lobbyMode = mode;
  return button;
});

const documentStub = {
  getElementById: (id) => ids[id] || null,
  querySelectorAll: (selector) => selector === "[data-lobby-mode]" ? modeButtons : [],
  createElement: (tag) => new El(tag),
  addEventListener() {},
  body: new El("body"),
};

const HEROES = [
  { id: "volt", name: "霓虹拳王", class_name: "格斗家", initial: "拳", accent: "pink", locked: false, palette: { main: "#ff4fa3", light: "#ffd3e8", dark: "#812354" } },
  { id: "moss", name: "苔藓守卫", class_name: "守护者", initial: "苔", accent: "green", locked: false, palette: { main: "#b7ef55", light: "#e9ffb7", dark: "#263b2d" } },
];

const LOBBY_LOCALE = {
  code: "zh",
  lobby: {
    messages: {
      "已准备": "已准备",
      "未准备": "未准备",
      "准备": "准备",
      "取消准备": "取消准备",
      "请输入房间码。": "请输入房间码。",
      "请先输入昵称。": "请先输入昵称。",
    },
    patterns: [],
    room_name: "{name} 的房间",
    player_separator: " · ",
    you: "（你）",
    host: "（房主）",
  },
};

let holdResponses = false;
const holdQueue = [];
function releaseHolds() {
  while (holdQueue.length) holdQueue.shift()({ ok: true, room: roomState });
}

const player = (id, name, heroId, ready) => ({
  player_id: id,
  name,
  hero_id: heroId,
  hero_name: heroId === "moss" ? "苔藓守卫" : "霓虹拳王",
  initial: "拳",
  accent: "pink",
  ready,
});

let roomState = null;
let requests = [];
let navigated = null;

async function fakeFetch(url, options) {
  const body = options && options.body ? JSON.parse(options.body) : null;
  requests.push({ url, method: (options && options.method) || "GET", body });
  const json = (data) => ({ ok: true, status: 200, json: async () => data });

  if (url === "/api/server-info") {
    return json({ ok: true, lan_urls: ["http://192.168.1.8:5000/multiplayer"] });
  }
  if (url === "/api/mp/rooms" && body) {
    return json({
      ok: true,
      player_id: "host-1",
      room: { room_id: "ABC123", host_id: "host-1", mode: body.mode, status: "waiting", prep_remaining: 0, capacity: body.mode === "duel" ? 2 : 8, players: [player("host-1", "房主", "volt", false)] },
    });
  }
  if (url === "/api/mp/rooms/join") {
    roomState = {
      room_id: "ABC123",
      host_id: "host-1",
      mode: body.mode,
      status: "preparing",
      prep_remaining: 25,
      capacity: 8,
      players: [player("host-1", "房主", "volt", true), player("guest-1", "队友", "volt", false)],
    };
    return json({ ok: true, player_id: "guest-1", room: roomState });
  }
  if (url.endsWith("/ready")) {
    roomState = { ...roomState, status: "playing", prep_remaining: 0, players: roomState.players.map((p) => ({ ...p, ready: true })) };
    return json({ ok: true, player_id: "guest-1", room: roomState });
  }
  if (url.endsWith("/hero")) {
    return json({ ok: true, player_id: "guest-1", room: roomState });
  }
  if (url.endsWith("/leave")) return json({ ok: true });
  if (url.startsWith("/api/mp/rooms/") && !body) {
    if (holdResponses) {
      return new Promise((resolve) => { holdQueue.push((payload) => resolve(json(payload))); });
    }
    return json({ ok: true, room: roomState });
  }
  return json({ ok: false, error: `unexpected ${url}` });
}

const code = fs.readFileSync(path.join("static", "multiplayer.js"), "utf8");

const store = {};
const sandbox = {
  console,
  document: documentStub,
  HTMLElement: El,
  HTMLInputElement: El,
  HTMLSelectElement: El,
  HTMLButtonElement: El,
  HTMLParagraphElement: El,
  HTMLDivElement: El,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  fetch: fakeFetch,
  setInterval: (fn) => { sandbox.__poll = fn; return 1; },
  clearInterval: () => { sandbox.__poll = null; },
  setTimeout: () => 1,
  clearTimeout: () => {},
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
  Date,
};
sandbox.window = {
  location: { replace: (u) => { navigated = u; }, href: "" },
  setTimeout: () => 1,
  clearTimeout: () => {},
  setInterval: (fn) => { sandbox.__poll = fn; return 1; },
  clearInterval: () => { sandbox.__poll = null; },
};
sandbox.window.document = documentStub;
sandbox.globalThis = sandbox;
sandbox.MP_HEROES = HEROES;
sandbox.MP_LOCALE = LOBBY_LOCALE;
sandbox.MP_STRINGS = { ai: "人机", duel: "联机对抗", rogue: "合作肉鸽", mismatch: "模式不匹配", roomMode: "房间模式" };
sandbox.MP_INITIAL_MODE = "rogue";

(async () => {
  // 模板里这两个面板带 hidden 属性，stub 需要手动还原初始状态
  ids["waiting-room"].hidden = true;
  ids["join-row"].hidden = true;
  ids["ready-toggle"].hidden = true;
  ids["start-game"].hidden = true;
  ids["mp-prep"].hidden = true;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  await new Promise((r) => setImmediate(r));

  check("开局没有残留房间面板", ids["waiting-room"].hidden === true);
  check("入口面板可见", ids["mp-entry"].hidden === false);
  modeButtons[1].click();
  check("联机对抗模式被选中", modeButtons[1].classList.contains("selected") && ids["mp-selected-mode"].textContent === "联机对抗");
  modeButtons[0].click();
  check("人机模式进入本地 1V1 选人页", sandbox.window.location.href === "/select?mode=duel");
  modeButtons[2].click();

  // 点「加入」应只展开房间码输入，不发请求
  ids["join-toggle"].click();
  check("点加入展开房间码输入", ids["join-row"].hidden === false);
  check("点加入没有发请求", requests.every((r) => r.url === "/api/server-info"));

  // 用房主身份创建房间
  ids["player-name"].value = "房主";
  ids["create-room"].click();
  await new Promise((r) => setImmediate(r));

  check("创建后进入房间面板", ids["waiting-room"].hidden === false && ids["mp-entry"].hidden === true);
  check("创建请求携带肉鸽房间模式", requests.some((r) => r.url === "/api/mp/rooms" && r.body.mode === "rogue"));
  check("房间码已写入", ids["current-room-code"].textContent === "ABC123");
  check("等待阶段不显示准备按钮", ids["ready-toggle"].hidden === true);
  check("房主能看到开始按钮", ids["start-game"].hidden === false);
  check("单人时开始按钮禁用", ids["start-game"].disabled === true);
  check("等待阶段显示凑人提示", ids["waiting-message"].textContent.includes("至少需要 2 名玩家"));

  // 以队友身份加入一个正在准备的房间
  ids["player-name"].value = "队友";
  ids["room-code"].value = "abc123";
  ids["join-room"].click();
  await new Promise((r) => setImmediate(r));

  check("加入请求把房间码转成大写", requests.some((r) => r.url === "/api/mp/rooms/join" && r.body.room_id === "ABC123"), JSON.stringify(requests.map((r) => r.body && r.body.room_id)));
  check("准备阶段显示准备按钮", ids["ready-toggle"].hidden === false);
  check("准备按钮初始文案是「准备」", ids["ready-toggle"].textContent === "准备");
  check("准备阶段显示倒计时", ids["mp-prep"].hidden === false && ids["prep-countdown"].textContent === "25");
  check("非房主看不到开始按钮", ids["start-game"].hidden === true);
  check("准备阶段提示先选英雄", ids["waiting-message"].textContent.includes("选好英雄后点准备"));

  const roster = ids["waiting-players"].innerHTML;
  check("玩家列表渲染两人", (roster.match(/class="waiting-player/g) || []).length === 2, roster.slice(0, 120));
  check("已准备的队友有 ready 标记", roster.includes("player-state ready") && roster.includes("已准备"));
  check("未准备的自己有等待标记", roster.includes("未准备") && roster.includes("（你）"));

  // 点准备 → 全员就绪 → 跳战斗
  ids["ready-toggle"].click();
  await new Promise((r) => setImmediate(r));

  check("准备请求带 ready=true", requests.some((r) => r.url.endsWith("/ready") && r.body.ready === true));
  check("全员就绪后跳转战斗", Boolean(navigated), String(navigated));
  check("跳转带上房间与玩家", Boolean(navigated && navigated.includes("room=ABC123") && navigated.includes("pid=guest-1")), String(navigated));
  check("跳转用 replace 以免返回重进", Boolean(navigated && navigated.startsWith("/battle?hero=volt")));

  ids["leave-room"].click();
  await new Promise((r) => setImmediate(r));
  modeButtons[1].click();
  ids["player-name"].value = "对抗房主";
  ids["create-room"].click();
  await new Promise((r) => setImmediate(r));
  check("联机对抗创建请求携带 duel 模式", requests.some((r) => r.url === "/api/mp/rooms" && r.body.mode === "duel"));
  check("对抗房间显示联机对抗模式", ids["room-mode-label"].textContent.includes("联机对抗"));

  // ---------- 回归：房间被服务端清理/自己被移出的场景 ----------
  // 重新加入一个正常房间
  ids["join-room"].click();
  await new Promise((r) => setImmediate(r));
  check("回归用例：重新加入成功", ids["waiting-room"].hidden === false);

  // A. 轮询拿到不含自己的房间（被服务端移出）→ 自动退出并提示
  holdResponses = true;
  sandbox.__poll();
  roomState = { ...roomState, players: [roomState.players[0]] };
  releaseHolds();
  await new Promise((r) => setImmediate(r));
  check("被移出房间后自动退出", ids["waiting-room"].hidden === true && ids["mp-entry"].hidden === false);
  check("被移出时有提示", ids["mp-toast"].textContent.includes("已离开房间或被移出"));

  // B. 点退出后，飞行中的轮询响应不再把房间画回来
  ids["join-room"].click();
  await new Promise((r) => setImmediate(r));
  check("回归用例：再次加入成功", ids["waiting-room"].hidden === false);
  holdResponses = true;
  sandbox.__poll();
  ids["leave-room"].click();
  await new Promise((r) => setImmediate(r));
  check("点退出后回到入口面板", ids["mp-entry"].hidden === false && ids["waiting-room"].hidden === true);
  roomState = {
    ...roomState,
    players: [player("host-1", "房主", "volt", false), player("guest-1", "队友", "volt", false)],
  };
  releaseHolds();
  await new Promise((r) => setImmediate(r));
  check("退出后过期响应不会重新渲染房间", ids["waiting-room"].hidden === true && ids["mp-entry"].hidden === false);

  console.log(`\n${passed} checks passed`);
})();
