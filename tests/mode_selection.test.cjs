const fs = require("node:fs");
const vm = require("node:vm");

class El {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.children = [];
    this.attributes = {};
    this.style = { setProperty() {} };
    this._classes = new Set();
    this.classList = {
      add: (name) => this._classes.add(name),
      remove: (name) => this._classes.delete(name),
      contains: (name) => this._classes.has(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !this._classes.has(name) : force;
        if (enabled) this._classes.add(name);
        else this._classes.delete(name);
        return enabled;
      },
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  addEventListener(type, handler) { this[`on${type}`] = handler; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text || ""; }
}

const modes = [
  { id: "rogue", name: "Roguelike", kicker: "Single player", tagline: "Solo · Waves", description: "Fight alone.", icon: "R", accent: "rogue", palette: { main: "#f0a", light: "#fff", dark: "#500" } },
  { id: "lan", name: "LAN", kicker: "Multiplayer", tagline: "Co-op · PvP", description: "Play together.", icon: "L", accent: "lan", palette: { main: "#0ff", light: "#fff", dark: "#055" } },
  { id: "story", name: "Story", kicker: "Narrative", tagline: "Explore · Read", description: "Play a story.", icon: "S", accent: "story", palette: { main: "#aaf", light: "#fff", dark: "#55a" } },
];

function run(initialStoredMode) {
  const elements = Object.fromEntries([
    "mode-detail-portrait", "mode-detail-initial", "mode-detail-kicker",
    "mode-detail-name", "mode-detail-tagline", "mode-detail-description",
    "mode-detail-features", "mode-detail-index", "mode-selected-name", "mode-confirm",
  ].map((id) => [id, new El()]));
  const choices = modes.map((mode) => {
    const choice = new El({ modeId: mode.id });
    if (mode.id === "rogue") choice.classList.add("selected");
    return choice;
  });
  const storage = { selectedMode: initialStoredMode };
  const sandbox = {
    console,
    HTMLElement: El,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (selector) => selector === "[data-mode-id]" ? choices : [],
      createElement: () => new El(),
    },
    window: { MODE_SELECTION: modes, location: { href: "" } },
    localStorage: {
      getItem: (key) => storage[key] || null,
      setItem: (key, value) => { storage[key] = String(value); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("static/mode.js", "utf8"), sandbox);
  return { elements, choices, storage, sandbox };
}

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`);
  console.log(`PASS ${name}`);
}

const restored = run("story");
assert("restores previously selected story mode", restored.choices[2].classList.contains("selected"));
assert("updates detail view to restored mode", restored.elements["mode-detail-name"].textContent === "Story");
restored.elements["mode-confirm"].onclick();
assert("confirmation keeps restored mode", restored.storage.selectedMode === "story" && restored.sandbox.window.location.href === "/");

const legacy = run("duel");
assert("falls back when saved mode has been removed", legacy.choices[0].classList.contains("selected"));

console.log("ALL PASS");
