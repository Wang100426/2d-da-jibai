"use strict";
/**
 * 剧情选择页：赛博世界剧情 / 英雄剧情 两类。
 *
 * 只负责列章节、显示进度、跳转 `/story?chapter=<id>`；剧情执行全在 story.ts。
 */
const chooseWindow = window;
const categories = (chooseWindow.STORY_CATEGORIES || []).slice().sort((a, b) => a.order - b.order);
const chapters = (chooseWindow.STORY_CHAPTERS || []).slice().sort((a, b) => a.order - b.order);
const progress = chooseWindow.STORY_PROGRESS || {};
const roster = chooseWindow.STORY_ROSTER || [];
const strings = chooseWindow.STORY_STRINGS || {};
const tabsRoot = document.getElementById("story-tabs");
const gridRoot = document.getElementById("story-chapters");
function str(key, fallback = "") {
    return strings[key] || fallback;
}
function heroOf(id) {
    if (!id)
        return undefined;
    return roster.find((entry) => entry.id === id);
}
function chapterProgress(chapterId) {
    return progress.chapters?.[chapterId];
}
function stateOf(chapter) {
    const entry = chapterProgress(chapter.id);
    if (entry?.completed)
        return "completed";
    if (entry?.node)
        return "in_progress";
    return "not_started";
}
function renderTabs(active) {
    if (!tabsRoot)
        return;
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
function renderGrid(active) {
    renderTabs(active);
    if (!gridRoot)
        return;
    gridRoot.replaceChildren();
    const visible = active === "all" ? chapters : chapters.filter((chapter) => chapter.category === active);
    if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "story-empty";
        empty.textContent = str("empty", "暂无章节");
        gridRoot.append(empty);
        return;
    }
    visible.forEach((chapter) => {
        gridRoot.append(renderCard(chapter));
    });
}
function renderCard(chapter) {
    const card = document.createElement("article");
    card.className = `story-chapter-card${chapter.hero ? " hero-chapter" : ""}`;
    card.dataset.chapterId = chapter.id;
    const state = stateOf(chapter);
    const hero = heroOf(chapter.hero);
    const top = document.createElement("div");
    top.className = "story-chapter-top";
    const badge = document.createElement("span");
    badge.className = `story-chapter-badge ${state}`;
    badge.textContent =
        state === "completed" ? str("completed", "COMPLETED")
            : state === "in_progress" ? str("inProgress", "IN PROGRESS")
                : str("notStarted", "NOT STARTED");
    top.append(badge);
    const kind = document.createElement("small");
    kind.textContent = chapter.hero
        ? `${str("heroChapter", "HERO")}${hero ? ` · ${hero.name}` : ""}`
        : str("worldChapter", "WORLD");
    top.append(kind);
    card.append(top);
    const title = document.createElement("h3");
    title.textContent = chapter.title;
    card.append(title);
    if (chapter.summary) {
        const summary = document.createElement("p");
        summary.className = "story-chapter-summary";
        summary.textContent = chapter.summary;
        card.append(summary);
    }
    const meta = document.createElement("div");
    meta.className = "story-chapter-meta";
    if (hero) {
        const chip = document.createElement("span");
        chip.className = "story-unit";
        chip.style.setProperty("--hero-main", hero.palette.main);
        chip.style.setProperty("--hero-light", hero.palette.light);
        chip.style.setProperty("--hero-dark", hero.palette.dark);
        const mark = document.createElement("i");
        mark.textContent = hero.initial;
        const name = document.createElement("b");
        name.textContent = hero.name;
        chip.append(mark, name);
        meta.append(chip);
    }
    const nodes = document.createElement("em");
    nodes.textContent = `${str("nodes", "NODES")} ${chapter.node_count}`;
    meta.append(nodes);
    card.append(meta);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "story-chapter-enter";
    action.innerHTML = `<span>${state === "in_progress" ? str("continue", "CONTINUE") : str("enter", "ENTER")}</span><b>&gt;&gt;</b>`;
    action.addEventListener("click", () => {
        window.location.href = `/story?chapter=${encodeURIComponent(chapter.id)}`;
    });
    card.append(action);
    return card;
}
renderGrid(categories[0]?.id || "all");
