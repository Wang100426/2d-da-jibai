"use strict";
const chooseWindow = window;
const categories = (chooseWindow.STORY_CATEGORIES || []).slice().sort((a, b) => a.order - b.order);
const cards = chooseWindow.STORY_CARDS || [];
const strings = chooseWindow.STORY_STRINGS || {};
const tabsRoot = document.getElementById("story-tabs");
const cardListRoot = document.getElementById("story-card-list");
const chaptersRoot = document.getElementById("story-chapters");
const workspace = document.getElementById("story-workspace");
const sidebar = document.getElementById("story-sidebar");
const sidebarToggle = document.getElementById("story-sidebar-toggle");
const driveSlot = document.getElementById("story-drive-slot");
const driveDisc = document.getElementById("story-drive-disc");
const ejectButton = document.getElementById("story-eject");
const emptyScreen = document.getElementById("story-screen-empty");
const loadedCard = document.getElementById("story-loaded-card");
const explorerPath = document.getElementById("story-explorer-path");
const screenStatus = document.getElementById("story-screen-status");
const loadedCode = document.getElementById("story-loaded-code");
const loadedTitle = document.getElementById("story-loaded-title");
const loadedSummary = document.getElementById("story-loaded-summary");
const loadedQuote = document.getElementById("story-loaded-quote");
const loadedProgress = document.getElementById("story-loaded-progress");
function str(key, fallback = "") {
    return strings[key] || fallback;
}
function setText(element, value) {
    if (element)
        element.textContent = value;
}
function setHidden(element, hidden) {
    if (element)
        element.hidden = hidden;
}
function renderTabs(active) {
    if (!tabsRoot)
        return;
    tabsRoot.replaceChildren();
    categories.forEach((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `story-tab${active === category.id ? " active" : ""}`;
        button.dataset.categoryId = category.id;
        button.textContent = category.name;
        button.title = category.description;
        button.addEventListener("click", () => renderCardList(category.id));
        tabsRoot.append(button);
    });
}
function renderCardList(active) {
    renderTabs(active);
    if (!cardListRoot)
        return;
    cardListRoot.replaceChildren();
    const visible = cards.filter((card) => card.category === active);
    if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "story-empty";
        empty.textContent = str("empty", "NO CARDS");
        cardListRoot.append(empty);
        return;
    }
    visible.forEach((card) => cardListRoot.append(renderCard(card)));
}
function renderCard(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.draggable = true;
    button.className = `story-disc-card${card.category === "hero" ? " hero-card" : ""}`;
    button.dataset.cardId = card.id;
    button.setAttribute("aria-label", `${card.code} · ${card.title}`);
    const code = document.createElement("small");
    code.textContent = card.code;
    const title = document.createElement("b");
    title.textContent = card.title;
    const progress = document.createElement("span");
    progress.className = "story-disc-progress";
    const completed = card.sections.filter((section) => section.completed).length;
    progress.textContent = `${str("cleared", "CLEARED")} ${completed}/${card.sections.length}`;
    const disc = document.createElement("i");
    disc.className = "story-disc-icon";
    disc.setAttribute("aria-hidden", "true");
    button.append(code, title, progress, disc);
    button.addEventListener("click", () => loadCard(card));
    button.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", card.id);
    });
    return button;
}
function renderSection(section) {
    const item = document.createElement("li");
    item.className = `story-section${section.locked ? " locked" : ""}${section.completed ? " completed" : ""}`;
    item.dataset.sectionId = section.id;
    const index = document.createElement("i");
    index.className = "story-section-index";
    index.textContent = String(section.order + 1).padStart(2, "0");
    const icon = document.createElement("span");
    icon.className = "story-file-icon";
    icon.textContent = section.locked ? "▰" : "▱";
    icon.setAttribute("aria-hidden", "true");
    const copy = document.createElement("div");
    copy.className = "story-section-copy";
    const title = document.createElement("b");
    title.textContent = section.title;
    const summary = document.createElement("small");
    summary.textContent = section.summary;
    copy.append(title, summary);
    const status = document.createElement("em");
    status.textContent = section.locked
        ? str("locked", "LOCKED")
        : section.completed
            ? str("completed", "COMPLETED")
            : section.started
                ? str("inProgress", "IN PROGRESS")
                : str("notStarted", "NOT STARTED");
    const action = document.createElement("button");
    action.type = "button";
    action.className = "story-section-enter";
    action.disabled = section.locked;
    action.textContent = section.locked
        ? str("locked", "LOCKED")
        : section.completed
            ? str("replay", "REPLAY")
            : section.started
                ? str("continue", "CONTINUE")
                : str("enter", "ENTER");
    if (!section.locked) {
        action.addEventListener("click", () => {
            window.location.href = `/story?chapter=${encodeURIComponent(section.id)}`;
        });
    }
    item.append(index, icon, copy, status, action);
    return item;
}
function markInsertedCard(cardId) {
    if (!cardListRoot)
        return;
    Array.from(cardListRoot.children).forEach((child) => {
        const button = child;
        button.classList.toggle("inserted", button.dataset.cardId === cardId);
    });
}
function loadCard(card) {
    if (!chaptersRoot)
        return;
    chaptersRoot.replaceChildren(...card.sections.map(renderSection));
    setText(loadedCode, card.code);
    setText(loadedTitle, card.title);
    setText(loadedSummary, card.summary);
    setText(loadedQuote, card.quote);
    setHidden(loadedQuote, !card.quote);
    setText(loadedProgress, `${str("cleared", "CLEARED")} ${card.sections.filter((section) => section.completed).length}/${card.sections.length}`);
    setText(explorerPath, `ARCHIVE://${card.code}`);
    setText(screenStatus, str("fileCount", "{count} memory sections").replace("{count}", String(card.sections.length)));
    setHidden(emptyScreen, true);
    setHidden(loadedCard, false);
    driveSlot?.classList.add("has-disc");
    driveDisc?.classList.add("active");
    markInsertedCard(card.id);
}
function ejectCard() {
    setHidden(loadedCard, true);
    setHidden(emptyScreen, false);
    setText(explorerPath, "ARCHIVE://NO_DISC");
    setText(screenStatus, str("noDisc", "NO DISC"));
    chaptersRoot?.replaceChildren();
    driveSlot?.classList.remove("has-disc");
    driveDisc?.classList.remove("active");
    markInsertedCard("");
}
sidebarToggle?.addEventListener("click", () => {
    const collapsed = !sidebar?.classList.contains("collapsed");
    sidebar?.classList.toggle("collapsed", collapsed);
    workspace?.classList.toggle("sidebar-collapsed", collapsed);
    sidebarToggle.classList.toggle("collapsed", collapsed);
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
});
ejectButton?.addEventListener("click", ejectCard);
driveSlot?.addEventListener("dragover", (event) => event.preventDefault());
driveSlot?.addEventListener("drop", (event) => {
    event.preventDefault();
    const cardId = event.dataTransfer?.getData("text/plain");
    const card = cards.find((entry) => entry.id === cardId);
    if (card)
        loadCard(card);
});
renderCardList(categories[0]?.id || "all");
