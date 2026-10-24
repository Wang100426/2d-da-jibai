/**
 * 剧情执行页的 UI 层。
 *
 * 分工：所有状态机逻辑在 `story_engine.ts`（可单测），本文件只做三件事：
 * 1. 把节点画出来
 * 2. 把交互交给引擎
 * 3. 把进度/奖励同步到后端（进度写档、奖励幂等领取）
 */

interface StoryRosterEntry {
  id: string;
  name: string;
  initial: string;
  palette: StoryPalette;
}

interface StoryHeroEntry {
  id: string;
  name: string;
  initial: string;
  palette: StoryPalette;
  locked: boolean;
  price: number;
}

interface StoryStrings {
  [key: string]: string;
}

interface StoryRewardResponse {
  ok?: boolean;
  already_claimed?: boolean;
  gained?: number;
  coins?: number;
  infinite_coins?: boolean;
}

const storyWindow = window as unknown as {
  STORY_CHAPTER?: StoryChapter;
  STORY_PROGRESS?: unknown;
  STORY_ROSTER?: StoryRosterEntry[];
  STORY_HEROES?: StoryHeroEntry[];
  STORY_STRINGS?: StoryStrings;
};

const chapter = storyWindow.STORY_CHAPTER;
const roster = storyWindow.STORY_ROSTER || [];
const storyHeroes = storyWindow.STORY_HEROES || [];
const strings = storyWindow.STORY_STRINGS || {};

if (!chapter) throw new Error("剧情数据未由 Flask 页面注入。");

const engine = new StoryEngine(chapter, storyWindow.STORY_PROGRESS);

/** 赛博世界剧情：战斗前自选的英雄（英雄剧情固定用 chapter.hero，忽略这个）。 */
let pickedHero: string | null = null;

const stage = document.getElementById("story-stage");
if (!stage) throw new Error("缺少剧情舞台元素。");
const backdrop = document.getElementById("story-backdrop");
const skipButton = document.getElementById("story-skip");
const progressLabel = document.getElementById("story-progress");
const titleLabel = document.getElementById("story-title");
const chapterLabel = document.getElementById("story-chapter");

const params = new URLSearchParams(window.location.search);
let lastBattleResult: "win" | "lose" | null = null;

function str(key: string, fallback = ""): string {
  return strings[key] || fallback;
}

function heroOf(id: string | null | undefined): StoryRosterEntry | undefined {
  if (!id) return undefined;
  return roster.find((entry) => entry.id === id);
}

function applyPalette(element: HTMLElement, palette?: StoryPalette): void {
  if (!palette) return;
  element.style.setProperty("--hero-main", palette.main);
  element.style.setProperty("--hero-light", palette.light);
  element.style.setProperty("--hero-dark", palette.dark);
}

/* ---------- 打字机 ---------- */
let typingTimer = 0;
let typingTarget: HTMLElement | null = null;
let typingFull = "";
let typingIndex = 0;

function stopTyping(): void {
  if (typingTimer) window.clearInterval(typingTimer);
  typingTimer = 0;
}

function isTyping(): boolean {
  return typingTimer !== 0;
}

function finishTyping(): void {
  stopTyping();
  if (typingTarget) typingTarget.textContent = typingFull;
  typingIndex = typingFull.length;
}

function startTyping(target: HTMLElement, text: string): void {
  stopTyping();
  typingTarget = target;
  typingFull = text;
  typingIndex = 0;
  target.textContent = "";
  typingTimer = window.setInterval(() => {
    typingIndex += 1;
    target.textContent = text.slice(0, typingIndex);
    if (typingIndex >= text.length) stopTyping();
  }, 24);
}

/* ---------- 轻提示 ---------- */
function toast(message: string, kind: "info" | "warning" = "info"): void {
  const element = document.createElement("div");
  element.className = `story-toast${kind === "warning" ? " story-toast-warning" : ""}`;
  element.textContent = message;
  document.body.append(element);
  window.setTimeout(() => element.classList.add("story-toast-out"), 1700);
  window.setTimeout(() => element.remove(), 2200);
}

/* ---------- 存档同步 ---------- */
function persist(): void {
  const snapshot = engine.snapshot();
  void fetch("/api/story/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter: chapter?.id, ...snapshot }),
  }).catch(() => {
    /* 存档失败不打断阅读，下次节点切换会重试 */
  });
}

/* ---------- 导航 ---------- */
function updateHeader(): void {
  if (!progressLabel || !chapter) return;
  const index = chapter.nodes.findIndex((node) => node.id === engine.progress.node);
  progressLabel.textContent = `${str("progress", "PROGRESS")} ${String(Math.max(0, index) + 1).padStart(2, "0")} / ${String(chapter.nodes.length).padStart(2, "0")}`;
}

function render(): void {
  stopTyping();
  updateHeader();
  const node = engine.currentNode();
  stage?.replaceChildren();
  if (!node) {
    renderBroken(str("broken", "章节数据异常"), engine.issues.map((issue) => issue.message));
    return;
  }
  switch (node.type) {
    case "dialogue":
      renderDialogue(node);
      break;
    case "choice":
      renderChoice(node);
      break;
    case "battle":
      renderBattle(node);
      break;
    case "objective":
      renderObjective(node);
      break;
    case "reward":
      renderReward(node);
      break;
    case "chapter_end":
      renderChapterEnd(node);
      break;
    default:
      renderBroken(str("unknown_node", "未知节点类型"), [`type=${String((node as { type?: string }).type)}`]);
      break;
  }
}

/** 统一的跳转入口：失败时给出可见错误，而不是白屏。 */
function move(step: StoryStep): void {
  if (!step.ok) {
    const message = step.error?.message || str("invalid_transition", "无法继续");
    toast(message, "warning");
    console.warn("[story] invalid transition", step.error);
    return;
  }
  persist();
  render();
}

/* ---------- 渲染：对话框 ---------- */
function renderDialogue(node: StoryDialogueNode): void {
  const section = document.createElement("section");
  section.className = "story-dialogue";

  const speaker = document.createElement("div");
  speaker.className = `story-speaker ${node.accent || ""}`;
  applyPalette(speaker, node.palette);

  const portrait = document.createElement("span");
  portrait.className = "story-portrait";
  portrait.textContent = node.initial || "?";

  const identity = document.createElement("div");
  const role = document.createElement("small");
  role.textContent = node.accent ? node.accent.toUpperCase() : "";
  const name = document.createElement("b");
  name.textContent = node.speaker || "";
  identity.append(role, name);
  speaker.append(portrait, identity);

  const box = document.createElement("button");
  box.type = "button";
  box.className = "story-box";
  const body = document.createElement("p");
  body.className = "story-text";
  const hint = document.createElement("span");
  hint.className = "story-hint";
  hint.textContent = `${str("clickHint", "CLICK")} ▸`;
  box.append(body, hint);
  box.addEventListener("click", () => {
    if (isTyping()) {
      finishTyping();
      return;
    }
    move(engine.goTo(node.next || ""));
  });

  section.append(speaker, box);
  stage?.append(section);
  startTyping(body, node.text || "");
}

/* ---------- 渲染：分支 ---------- */
function renderChoice(node: StoryChoiceNode): void {
  const section = document.createElement("section");
  section.className = "story-choice";

  const prompt = document.createElement("p");
  prompt.className = "story-prompt";
  prompt.textContent = node.prompt || str("choiceHint", "CHOOSE");
  section.append(prompt);

  const options = document.createElement("div");
  options.className = "story-options";
  (node.options || []).forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-option";
    const key = document.createElement("kbd");
    key.textContent = String(index + 1);
    const copy = document.createElement("div");
    const label = document.createElement("b");
    label.textContent = option.label || option.id;
    copy.append(label);
    const arrow = document.createElement("span");
    arrow.textContent = "›";
    button.append(key, copy, arrow);
    button.addEventListener("click", () => move(engine.choose(index)));
    options.append(button);
  });

  section.append(options);
  stage?.append(section);
}

/* ---------- 渲染：战斗 ---------- */
interface StoryWave {
  index?: number;
  label?: string;
  note?: string;
  event?: string;
  enemies?: Array<{ hero: string; count: number; mod?: string }>;
  skills?: Array<{ name: string; description: string; cooldown: number; damage: number; effect?: string }>;
}

function renderBattle(node: StoryBattleNode): void {
  const section = document.createElement("section");
  section.className = "story-battle";

  const head = document.createElement("header");
  head.className = "story-battle-head";
  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = str("battleKicker", "BATTLE");
  const heading = document.createElement("h2");
  heading.textContent = node.title || "";
  head.append(kicker, heading);
  if (node.brief) {
    const brief = document.createElement("p");
    brief.className = "story-brief";
    brief.textContent = `${str("brief", "BRIEF")} · ${node.brief}`;
    head.append(brief);
  }
  section.append(head);

  // 英雄剧情：固定出战；赛博世界剧情：战斗前自选
  const lockedHero = chapter?.hero || node.battle?.hero || null;
  const meta = document.createElement("div");
  meta.className = "story-battle-meta";
  if (lockedHero) {
    const hero = heroOf(lockedHero);
    const heroChip = document.createElement("span");
    heroChip.className = "story-unit";
    applyPalette(heroChip, hero?.palette);
    const mark = document.createElement("i");
    mark.textContent = hero?.initial || "?";
    const heroName = document.createElement("b");
    heroName.textContent = hero?.name || lockedHero;
    heroChip.append(mark, heroName);
    const fixedTag = document.createElement("em");
    fixedTag.textContent = str("fixedHero", "FIXED");
    heroChip.append(fixedTag);
    meta.append(heroChip);
  }
  const wavesChip = document.createElement("span");
  wavesChip.className = "story-badge";
  wavesChip.textContent = `${str("targetWaves", "TARGET")} ${node.battle?.target_waves ?? 1}`;
  meta.append(wavesChip);
  section.append(meta);

  if (!lockedHero) {
    section.append(renderHeroPicker());
  }

  if (Array.isArray(node.waves) && node.waves.length) {
    const waves = document.createElement("div");
    waves.className = "story-waves";
    node.waves.forEach((raw) => {
      waves.append(renderWave(raw as StoryWave));
    });
    section.append(waves);
  }

  const footer = document.createElement("footer");
  footer.className = "story-battle-foot";
  if (lastBattleResult === "lose") {
    const failNote = document.createElement("p");
    failNote.className = "story-fail-note";
    failNote.textContent = str("battleLost", "战斗失败，可以重试。");
    footer.append(failNote);
  }
  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "enter-trapezoid story-start";
  startButton.innerHTML = `${lastBattleResult === "lose" ? str("retryBattle", "RETRY") : str("startBattle", "START")} <b>&gt;&gt;</b>`;
  startButton.addEventListener("click", () => startStoryBattle(node, lockedHero || pickedHero || "volt"));
  footer.append(startButton);

  // 失败后永远留一条退路，避免玩家卡在同一个战斗节点
  if (lastBattleResult === "lose") {
    const exitLink = document.createElement("a");
    exitLink.className = "button button-ghost";
    exitLink.href = "/story/choose";
    exitLink.textContent = str("backChoose", "BACK TO STORIES");
    footer.append(exitLink);
  }

  if (node.on_lose && node.on_lose !== node.id) {
    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "button button-ghost";
    backButton.textContent = str("backChapter", "返回");
    backButton.addEventListener("click", () => move(engine.goTo(node.on_lose || "")));
    footer.append(backButton);
  }
  section.append(footer);
  stage?.append(section);
}

/** 赛博世界剧情：战斗前选择出战英雄（未解锁的不可选）。 */
function renderHeroPicker(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "story-hero-pick";

  const label = document.createElement("small");
  label.textContent = str("pickHero", "PICK YOUR FIGHTER");
  wrap.append(label);

  const grid = document.createElement("div");
  grid.className = "story-hero-grid";
  const buttons: HTMLButtonElement[] = [];
  const unlocked = storyHeroes.filter((hero) => !hero.locked);
  if (!pickedHero || !unlocked.some((hero) => hero.id === pickedHero)) {
    pickedHero = unlocked[0]?.id || "volt";
  }

  storyHeroes.forEach((hero) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-hero-option";
    button.disabled = hero.locked;
    if (hero.id === pickedHero) button.classList.add("selected");
    if (hero.locked) button.classList.add("locked");
    applyPalette(button, hero.palette);

    const mark = document.createElement("i");
    mark.textContent = hero.initial;
    const name = document.createElement("b");
    name.textContent = hero.name;
    button.append(mark, name);
    if (hero.locked) {
      const lock = document.createElement("em");
      lock.textContent = `◈ ${hero.price}`;
      button.append(lock);
    }
    if (!hero.locked) {
      button.addEventListener("click", () => {
        pickedHero = hero.id;
        buttons.forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      });
    }
    buttons.push(button);
    grid.append(button);
  });

  wrap.append(grid);
  return wrap;
}

function renderWave(wave: StoryWave): HTMLElement {
  const card = document.createElement("article");
  card.className = "story-wave";

  const head = document.createElement("header");
  const label = document.createElement("b");
  label.textContent = wave.label || `${str("wave", "WAVE")} ${wave.index ?? ""}`;
  head.append(label);
  if (wave.note) {
    const note = document.createElement("small");
    note.textContent = wave.note;
    head.append(note);
  }
  card.append(head);

  if (wave.event) {
    const event = document.createElement("p");
    event.className = "story-event";
    event.textContent = `${str("event", "EVENT")}：${wave.event}`;
    card.append(event);
  }

  if (wave.enemies?.length) {
    const units = document.createElement("div");
    units.className = "story-units";
    wave.enemies.forEach((enemy) => {
      const heroEntry = heroOf(enemy.hero);
      const chip = document.createElement("span");
      chip.className = "story-unit";
      applyPalette(chip, heroEntry?.palette);
      const mark = document.createElement("i");
      mark.textContent = heroEntry?.initial || "?";
      const text = document.createElement("b");
      text.textContent = `${heroEntry?.name || enemy.hero} ×${enemy.count}`;
      chip.append(mark, text);
      if (enemy.mod) {
        const mod = document.createElement("em");
        mod.textContent = enemy.mod;
        chip.append(mod);
      }
      units.append(chip);
    });
    card.append(units);
  }

  if (wave.skills?.length) {
    const list = document.createElement("ul");
    list.className = "story-skills";
    wave.skills.forEach((skill) => {
      const item = document.createElement("li");
      const name = document.createElement("b");
      name.textContent = skill.name;
      const desc = document.createElement("small");
      desc.textContent = skill.description;
      const metaInfo = document.createElement("em");
      const parts = [`${str("cooldown", "CD")} ${skill.cooldown}s`];
      if (skill.damage) parts.push(`${str("damage", "DMG")} ${skill.damage}`);
      if (skill.effect) parts.push(skill.effect);
      metaInfo.textContent = parts.join(" · ");
      item.append(name, desc, metaInfo);
      list.append(item);
    });
    card.append(list);
  }

  return card;
}

/** 复用现有 /battle：只传英雄、章节、节点，战斗本身不在这里实现。 */
function startStoryBattle(node: StoryBattleNode, heroId: string): void {
  persist();
  const query = new URLSearchParams({
    hero: heroId,
    story: chapter?.id || "",
    node: node.id,
  });
  window.location.href = `/battle?${query.toString()}`;
}

/* ---------- 渲染：任务目标 ---------- */
function renderObjective(node: StoryObjectiveNode): void {
  const section = document.createElement("section");
  section.className = "story-objective";

  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = str("objectiveKicker", "OBJECTIVE");
  const heading = document.createElement("h2");
  heading.textContent = node.title || "";
  section.append(kicker, heading);

  if (node.description) {
    const desc = document.createElement("p");
    desc.className = "story-brief";
    desc.textContent = node.description;
    section.append(desc);
  }

  const list = document.createElement("ul");
  list.className = "story-goals";
  (node.goals || []).forEach((goal) => {
    const done = Boolean(engine.progress.objectives[goal.id]);
    const item = document.createElement("li");
    item.className = `story-goal${done ? " done" : ""}`;
    const check = document.createElement("i");
    check.textContent = done ? "✓" : "";
    const text = document.createElement("span");
    text.textContent = goal.label || goal.id;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = done ? str("goalUndo", "取消") : str("goalDone", "标记完成");
    toggle.addEventListener("click", () => {
      engine.setObjective(goal.id, !done);
      persist();
      render();
    });
    item.append(check, text, toggle);
    list.append(item);
  });
  section.append(list);

  const footer = document.createElement("footer");
  footer.className = "story-battle-foot";
  if (!engine.canLeaveObjective()) {
    const note = document.createElement("p");
    note.className = "story-fail-note";
    note.textContent = str("objectiveBlocked", "完成全部目标后才能继续。");
    footer.append(note);
  } else {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "enter-trapezoid story-start";
    next.innerHTML = `${str("continue", "CONTINUE")} <b>&gt;&gt;</b>`;
    next.addEventListener("click", () => move(engine.goTo(node.next || "")));
    footer.append(next);
  }
  section.append(footer);
  stage?.append(section);
}

/* ---------- 渲染：奖励 ---------- */
function renderReward(node: StoryRewardNode): void {
  const section = document.createElement("section");
  section.className = "story-reward";

  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = str("rewardKicker", "REWARD");
  const heading = document.createElement("h2");
  heading.textContent = node.title || "";
  section.append(kicker, heading);

  if (node.description) {
    const desc = document.createElement("p");
    desc.className = "story-brief";
    desc.textContent = node.description;
    section.append(desc);
  }

  const amount = document.createElement("p");
  amount.className = "story-reward-amount";
  amount.textContent = `◈ +${node.coins || 0}`;
  section.append(amount);

  const status = document.createElement("p");
  status.className = "story-reward-status";
  status.textContent = str("rewardClaiming", "领取中…");
  section.append(status);

  const footer = document.createElement("footer");
  footer.className = "story-battle-foot";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "enter-trapezoid story-start";
  next.innerHTML = `${str("continue", "CONTINUE")} <b>&gt;&gt;</b>`;
  next.disabled = true;
  next.addEventListener("click", () => move(engine.goTo(node.next || "")));
  footer.append(next);
  section.append(footer);
  stage?.append(section);

  void claimReward(node, status, next);
}

async function claimReward(node: StoryRewardNode, status: HTMLElement, next: HTMLButtonElement): Promise<void> {
  const rewardId = node.reward_id;
  if (!rewardId) {
    status.textContent = str("rewardInvalid", "奖励配置缺失");
    next.disabled = false;
    return;
  }
  try {
    const response = await fetch("/api/story/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter: chapter?.id, reward_id: rewardId, coins: node.coins || 0 }),
    });
    const data: StoryRewardResponse = await response.json();
    engine.markRewardClaimed(rewardId);
    if (data.already_claimed) {
      status.textContent = str("rewardAlready", "该奖励已领取过，不会重复发放。");
    } else {
      status.textContent = data.infinite_coins
        ? str("rewardInfinite", "金币无限，奖励已记录。")
        : str("rewardGained", "已获得金币：{coins}").replace("{coins}", String(data.gained ?? node.coins ?? 0));
    }
  } catch {
    status.textContent = str("rewardFailed", "领取失败，可稍后重试。");
  } finally {
    next.disabled = false;
    persist();
  }
}

/* ---------- 渲染：章节结束 ---------- */
function renderChapterEnd(node: StoryChapterEndNode): void {
  engine.finishChapter();
  persist();

  const section = document.createElement("section");
  section.className = "story-end";

  const kicker = document.createElement("p");
  kicker.className = "eyebrow";
  kicker.textContent = str("chapterEndKicker", "CHAPTER COMPLETE");
  const heading = document.createElement("h2");
  heading.textContent = node.title || "";
  const text = document.createElement("p");
  text.className = "story-end-text";
  text.textContent = node.text || "";
  section.append(kicker, heading, text);

  const actions = document.createElement("div");
  actions.className = "story-end-actions";
  const back = document.createElement("a");
  back.className = "enter-trapezoid";
  back.href = "/story/choose";
  back.textContent = str("backChoose", "返回剧情选择");
  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "button button-ghost";
  replay.textContent = str("replay", "从头再看");
  replay.addEventListener("click", () => {
    const step = engine.goTo(chapter?.entry || "");
    if (step.ok) {
      engine.progress.completed = false;
      persist();
      render();
    }
  });
  actions.append(back, replay);
  section.append(actions);
  stage?.append(section);
}

/* ---------- 渲染：异常 ---------- */
function renderBroken(title: string, details: string[]): void {
  const section = document.createElement("section");
  section.className = "story-end";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const list = document.createElement("ul");
  list.className = "story-goals";
  details.forEach((detail) => {
    const item = document.createElement("li");
    item.className = "story-goal";
    const text = document.createElement("span");
    text.textContent = detail;
    item.append(text);
    list.append(item);
  });
  const back = document.createElement("a");
  back.className = "enter-trapezoid";
  back.href = "/story/choose";
  back.textContent = str("backChoose", "返回剧情选择");
  const actions = document.createElement("div");
  actions.className = "story-end-actions";
  actions.append(back);
  section.append(heading, list, actions);
  stage?.append(section);
}

/* ---------- 跳过 ---------- */
function skipToBattle(): void {
  let cursor: string | null = engine.progress.node;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = engine.getNode(cursor);
    if (!node) break;
    if (node.type === "battle" || node.type === "chapter_end") {
      move(engine.goTo(node.id));
      return;
    }
    if (node.type === "choice") {
      cursor = node.options?.[0]?.next || null;
      continue;
    }
    cursor = node.next || null;
  }
  toast(str("skipFailed", "这条线没有可跳过的战斗。"), "warning");
}

/* ---------- 初始化 ---------- */
function boot(): void {
  if (engine.issues.length) {
    console.warn("[story] chapter has problems", engine.issues);
  }
  if (titleLabel) titleLabel.textContent = chapter?.title || "";
  if (chapterLabel) chapterLabel.textContent = chapter?.category_name || "";
  if (backdrop && chapter?.background) {
    backdrop.style.backgroundImage = `url("/static/${chapter.background}")`;
  }

  const rawResult = params.get("result");
  if (rawResult === "win" || rawResult === "lose") {
    lastBattleResult = rawResult;
    const step = engine.applyBattleResult(rawResult);
    if (!step.ok && step.error) {
      toast(step.error.message, "warning");
    }
    // 清掉 URL 上的战斗结果，避免刷新时重复应用
    const clean = new URLSearchParams(window.location.search);
    clean.delete("result");
    clean.delete("waves");
    window.history.replaceState({}, "", `${window.location.pathname}?${clean.toString()}`);
  } else {
    engine.start();
  }

  skipButton?.addEventListener("click", skipToBattle);
  document.addEventListener("keydown", (event) => {
    const node = engine.currentNode();
    if (!node) return;
    if ((event.key === " " || event.key === "Enter") && node.type === "dialogue") {
      event.preventDefault();
      if (isTyping()) {
        finishTyping();
      } else {
        move(engine.goTo(node.next || ""));
      }
      return;
    }
    if (node.type === "choice" && /^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (node.options?.[index]) {
        event.preventDefault();
        move(engine.choose(index));
      }
    }
  });

  render();
  persist();
}

boot();
