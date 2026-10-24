/**
 * 重现卡库：按分类列出「重现卡」，每张卡里是逐段解锁的分区。
 *
 * 只负责展示与跳转（`/story?chapter=<sectionId>`）；解锁规则由后端算好
 * （`section_locked`），前端只渲染 `locked`，不做二次判断。
 */

interface StoryPalette {
  main: string;
  light: string;
  dark: string;
}

interface RosterEntry {
  id: string;
  name: string;
  initial: string;
  palette: StoryPalette;
}

interface StoryCategory {
  id: string;
  order: number;
  name: string;
  description: string;
}

interface StorySection {
  id: string;
  order: number;
  title: string;
  summary: string;
  node_count: number;
  hero: string | null;
  locked: boolean;
  completed: boolean;
  started: boolean;
}

interface StoryCard {
  id: string;
  code: string;
  title: string;
  summary: string;
  quote: string;
  category: string;
  sections: StorySection[];
}

interface ChooseStrings {
  [key: string]: string;
}

const chooseWindow = window as unknown as {
  STORY_CATEGORIES?: StoryCategory[];
  STORY_CARDS?: StoryCard[];
  STORY_ROSTER?: RosterEntry[];
  STORY_STRINGS?: ChooseStrings;
};

const categories = (chooseWindow.STORY_CATEGORIES || []).slice().sort((a, b) => a.order - b.order);
const cards = chooseWindow.STORY_CARDS || [];
const roster = chooseWindow.STORY_ROSTER || [];
const strings = chooseWindow.STORY_STRINGS || {};

const tabsRoot = document.getElementById("story-tabs");
const gridRoot = document.getElementById("story-chapters");

function str(key: string, fallback = ""): string {
  return strings[key] || fallback;
}

function heroOf(id: string | null): RosterEntry | undefined {
  if (!id) return undefined;
  return roster.find((entry) => entry.id === id);
}

function renderTabs(active: string): void {
  if (!tabsRoot) return;
  tabsRoot.replaceChildren();

  const all = document.createElement("button");
  all.type = "button";
  all.className = `story-tab${active === "all" ? " active" : ""}`;
  all.textContent = str("all", "ALL");
  all.addEventListener("click", () => renderGrid("all"));
  tabsRoot.append(all);

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `story-tab${active === category.id ? " active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => renderGrid(category.id));
    tabsRoot.append(button);
  });
}

function renderGrid(active: string): void {
  renderTabs(active);
  if (!gridRoot) return;
  gridRoot.replaceChildren();

  const visible = active === "all" ? cards : cards.filter((card) => card.category === active);
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "story-empty";
    empty.textContent = str("empty", "NO CARDS");
    gridRoot.append(empty);
    return;
  }
  visible.forEach((card) => gridRoot.append(renderCard(card)));
}

function renderCard(card: StoryCard): HTMLElement {
  const article = document.createElement("article");
  article.className = `story-card${card.category === "hero" ? " hero-card" : ""}`;

  const head = document.createElement("header");
  head.className = "story-card-head";
  const code = document.createElement("small");
  code.textContent = card.code;
  const kind = document.createElement("em");
  kind.textContent = card.category === "hero" ? str("heroChapter", "HERO") : str("worldChapter", "WORLD");
  head.append(code, kind);
  article.append(head);

  const title = document.createElement("h3");
  title.textContent = card.title;
  article.append(title);

  if (card.quote) {
    const quote = document.createElement("blockquote");
    quote.className = "story-card-quote";
    quote.textContent = card.quote;
    article.append(quote);
  }
  if (card.summary) {
    const summary = document.createElement("p");
    summary.className = "story-card-summary";
    summary.textContent = card.summary;
    article.append(summary);
  }

  const done = card.sections.filter((section) => section.completed).length;
  const meta = document.createElement("div");
  meta.className = "story-card-meta";
  const progress = document.createElement("span");
  progress.className = "story-card-progress";
  progress.textContent = `${str("cleared", "CLEARED")} ${done} / ${card.sections.length}`;
  meta.append(progress);
  article.append(meta);

  const list = document.createElement("ol");
  list.className = "story-sections";
  card.sections.forEach((section) => list.append(renderSection(card, section)));
  article.append(list);

  return article;
}

function renderSection(card: StoryCard, section: StorySection): HTMLElement {
  const item = document.createElement("li");
  item.className = `story-section${section.locked ? " locked" : ""}${section.completed ? " completed" : ""}`;
  item.dataset.sectionId = section.id;

  const index = document.createElement("i");
  index.className = "story-section-index";
  index.textContent = String(section.order + 1).padStart(2, "0");

  const copy = document.createElement("div");
  copy.className = "story-section-copy";
  const title = document.createElement("b");
  title.textContent = section.title;
  copy.append(title);

  const hero = heroOf(section.hero);
  const note = document.createElement("small");
  if (section.locked) {
    note.textContent = str("lockedHint", "Finish the previous section to unlock");
  } else if (section.completed) {
    note.textContent = `${str("completed", "COMPLETED")} · ${str("replay", "REPLAY")}`;
  } else if (section.started) {
    note.textContent = str("inProgress", "IN PROGRESS");
  } else if (hero) {
    note.textContent = `${str("fixedHeroShort", "FIXED")} · ${hero.name}`;
  } else {
    note.textContent = str("notStarted", "NOT STARTED");
  }
  copy.append(note);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "story-section-enter";
  if (section.locked) {
    action.disabled = true;
    action.textContent = str("locked", "LOCKED");
  } else {
    action.innerHTML = `<span>${section.completed ? str("replay", "REPLAY") : section.started ? str("continue", "CONTINUE") : str("enter", "ENTER")}</span><b>&gt;&gt;</b>`;
    action.addEventListener("click", () => {
      window.location.href = `/story?chapter=${encodeURIComponent(section.id)}`;
    });
  }

  item.append(index, copy, action);
  return item;
}

renderGrid(categories[0]?.id || "all");
