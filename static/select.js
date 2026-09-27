"use strict";
function requireSelectionElement(id) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement))
        throw new Error(`Missing hero selection element: ${id}`);
    return element;
}
const heroes = window.HERO_SELECTION || [];
if (!heroes.length)
    throw new Error("Hero selection data was not provided by the Flask page.");
const gameMode = window.GAME_MODE === "duel" ? "duel" : "rogue";
const choices = [...document.querySelectorAll("[data-hero-id]")];
const portrait = requireSelectionElement("detail-portrait");
const initial = requireSelectionElement("detail-initial");
const heroClass = requireSelectionElement("detail-class");
const heroName = requireSelectionElement("detail-name");
const tagline = requireSelectionElement("detail-tagline");
const stats = requireSelectionElement("detail-stats");
const skills = requireSelectionElement("detail-skill-list");
const indexLabel = requireSelectionElement("detail-index");
const selectedName = requireSelectionElement("selected-name");
const enterBattle = requireSelectionElement("enter-battle");
function renderStats(hero) {
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
function renderSkills(hero) {
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
        description.textContent = skill.description;
        copy.append(name, description);
        const cooldown = document.createElement("span");
        cooldown.textContent = `${skill.cost} EN / ${skill.cooldown}s`;
        row.append(key, copy, cooldown);
        skills.append(row);
    });
}
function selectHero(heroId) {
    const index = heroes.findIndex((hero) => hero.id === heroId);
    const hero = heroes[index];
    if (!hero)
        return;
    choices.forEach((choice) => {
        const selected = choice.dataset.heroId === hero.id;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
    });
    portrait.className = `detail-portrait ${hero.accent}`;
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
