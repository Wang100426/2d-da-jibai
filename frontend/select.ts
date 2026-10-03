interface HeroPalette {
  main: string;
  light: string;
  dark: string;
}

interface SelectionSkill {
  id: string;
  name: string;
  description: string;
  detail_description?: string;
  kind: string;
  cost: number;
  cooldown: number;
}

interface SelectionHero {
  id: string;
  name: string;
  class_name: string;
  tagline: string;
  initial: string;
  accent: string;
  palette: HeroPalette;
  passive: { name: string; description: string };
  stats: Record<string, number>;
  skills: SelectionSkill[];
}

function requireSelectionElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing hero selection element: ${id}`);
  return element as T;
}

const heroes: SelectionHero[] = (window as Window & Partial<{ HERO_SELECTION: SelectionHero[] }>).HERO_SELECTION || [];
if (!heroes.length) throw new Error("Hero selection data was not provided by the Flask page.");
const gameMode = (window as Window & Partial<{ GAME_MODE: string }>).GAME_MODE === "duel" ? "duel" : "rogue";

const choices = [...document.querySelectorAll<HTMLButtonElement>("[data-hero-id]")];
const portrait = requireSelectionElement<HTMLDivElement>("detail-portrait");
const initial = requireSelectionElement<HTMLElement>("detail-initial");
const heroClass = requireSelectionElement<HTMLElement>("detail-class");
const heroName = requireSelectionElement<HTMLElement>("detail-name");
const tagline = requireSelectionElement<HTMLElement>("detail-tagline");
const stats = requireSelectionElement<HTMLDivElement>("detail-stats");
const skills = requireSelectionElement<HTMLDivElement>("detail-skill-list");
const passive = requireSelectionElement<HTMLDivElement>("detail-passive");
const passiveName = requireSelectionElement<HTMLElement>("detail-passive-name");
const passiveDesc = requireSelectionElement<HTMLElement>("detail-passive-desc");
const indexLabel = requireSelectionElement<HTMLElement>("detail-index");
const selectedName = requireSelectionElement<HTMLElement>("selected-name");
const enterBattle = requireSelectionElement<HTMLAnchorElement>("enter-battle");

function renderStats(hero: SelectionHero): void {
  stats.replaceChildren();
  Object.entries(hero.stats).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "detail-stat";
    const name = document.createElement("span");
    name.textContent = label;
    const score = document.createElement("b");
    score.textContent = String(value);
    const bar = document.createElement("i");
    const fill = document.createElement("em");
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    bar.append(fill);
    row.append(name, score, bar);
    stats.append(row);
  });
}

function renderSkills(hero: SelectionHero): void {
  skills.replaceChildren();
  hero.skills.forEach((skill, index) => {
    const row = document.createElement("article");
    row.className = "detail-skill";
    const key = document.createElement("kbd");
    key.textContent = ["Q", "E", "R"][index] || String(index + 1);
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = skill.name;
    const description = document.createElement("small");
    description.textContent = skill.detail_description || skill.description;
    copy.append(name, description);
    const cooldown = document.createElement("span");
    cooldown.textContent = `${skill.cost} EN / ${skill.cooldown}s`;
    row.append(key, copy, cooldown);
    skills.append(row);
  });
}

function applyPalette(element: HTMLElement, palette: HeroPalette): void {
  element.style.setProperty("--hero-main", palette.main);
  element.style.setProperty("--hero-light", palette.light);
  element.style.setProperty("--hero-dark", palette.dark);
}

function selectHero(heroId: string): void {
  const index = heroes.findIndex((hero) => hero.id === heroId);
  const hero = heroes[index];
  if (!hero) return;
  choices.forEach((choice) => {
    const selected = choice.dataset.heroId === hero.id;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
  portrait.className = `detail-portrait ${hero.accent}`;
  applyPalette(portrait, hero.palette);
  applyPalette(passive, hero.palette);
  passiveName.textContent = hero.passive.name;
  passiveDesc.textContent = hero.passive.description;
  initial.textContent = hero.initial;
  heroClass.textContent = hero.class_name;
  heroName.textContent = hero.name;
  tagline.textContent = hero.tagline;
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(heroes.length).padStart(2, "0")}`;
  selectedName.textContent = hero.name;
  enterBattle.href = `/battle?hero=${encodeURIComponent(hero.id)}${gameMode === "duel" ? "&mode=duel" : ""}`;
  renderStats(hero);
  renderSkills(hero);
}

choices.forEach((choice) => {
  choice.addEventListener("click", () => selectHero(choice.dataset.heroId || ""));
});

selectHero(choices.find((choice) => choice.classList.contains("selected"))?.dataset.heroId || heroes[0].id);
