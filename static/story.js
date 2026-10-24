"use strict";
const script = window.STORY_SCRIPT;
const roster = window.STORY_ROSTER || [];
const strings = window.STORY_STRINGS || {};
function str(key, fallback = "") {
    return strings[key] || fallback;
}
const stage = document.getElementById("story-stage");
if (!stage)
    throw new Error("Missing story stage element.");
const backdrop = document.getElementById("story-backdrop");
const skipButton = document.getElementById("story-skip");
const progressLabel = document.getElementById("story-progress");
const titleLabel = document.getElementById("story-title");
const nodeMap = new Map();
let currentNode = null;
function buildNodeMap() {
    nodeMap.clear();
    (script?.nodes || []).forEach((node) => nodeMap.set(node.id, node));
}
function heroOf(id) {
    return roster.find((entry) => entry.id === id);
}
function applyPalette(element, palette) {
    if (!palette)
        return;
    element.style.setProperty("--hero-main", palette.main);
    element.style.setProperty("--hero-light", palette.light);
    element.style.setProperty("--hero-dark", palette.dark);
}
/* ---------- 打字机 ---------- */
let typingTimer = 0;
let typingTarget = null;
let typingFull = "";
let typingIndex = 0;
function stopTyping() {
    if (typingTimer)
        window.clearInterval(typingTimer);
    typingTimer = 0;
}
function isTyping() {
    return typingTimer !== 0;
}
function finishTyping() {
    stopTyping();
    if (typingTarget)
        typingTarget.textContent = typingFull;
    typingIndex = typingFull.length;
}
function startTyping(target, text) {
    stopTyping();
    typingTarget = target;
    typingFull = text;
    typingIndex = 0;
    target.textContent = "";
    typingTimer = window.setInterval(() => {
        typingIndex += 1;
        target.textContent = text.slice(0, typingIndex);
        if (typingIndex >= text.length)
            stopTyping();
    }, 24);
}
/* ---------- 轻提示 ---------- */
function toast(message) {
    const element = document.createElement("div");
    element.className = "story-toast";
    element.textContent = message;
    document.body.append(element);
    window.setTimeout(() => element.classList.add("story-toast-out"), 1700);
    window.setTimeout(() => element.remove(), 2200);
}
/* ---------- 节点导航 ---------- */
function updateProgress() {
    if (!progressLabel || !script)
        return;
    const total = script.nodes.length;
    const index = currentNode ? script.nodes.findIndex((node) => node.id === currentNode?.id) : -1;
    progressLabel.textContent = `${str("progress", "PROGRESS")} ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}
function goTo(nodeId) {
    if (!nodeId)
        return;
    const node = nodeMap.get(nodeId);
    if (!node)
        return;
    stopTyping();
    currentNode = node;
    updateProgress();
    stage?.replaceChildren();
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
        default:
            renderEnd(node);
            break;
    }
}
function advance() {
    if (!currentNode)
        return;
    if (currentNode.type === "dialogue") {
        if (isTyping()) {
            finishTyping();
            return;
        }
        goTo(currentNode.next);
    }
}
/** 下一个节点：对话/战斗用 next，分支节点取第一个选项。 */
function nextCursor(node) {
    if (node.next)
        return node.next;
    return node.options?.[0]?.next;
}
/** 跳到当前路线上的第一个战斗节点；没有战斗则跳到结束节点。 */
function skipToBattle() {
    let cursor = currentNode?.id;
    const seen = new Set();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const node = nodeMap.get(cursor);
        if (!node)
            break;
        if (node.type === "battle" || node.type === "end") {
            if (node.type === "end" && currentNode?.type !== "end") {
                toast(str("skipped", "SKIPPED"));
            }
            goTo(node.id);
            return;
        }
        cursor = nextCursor(node);
    }
}
/* ---------- 渲染：对话框 ---------- */
function renderDialogue(node) {
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
    role.textContent = node.role || "";
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
    box.addEventListener("click", advance);
    section.append(speaker, box);
    stage?.append(section);
    startTyping(body, node.text || "");
}
/* ---------- 渲染：分支选择 ---------- */
function renderChoice(node) {
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
        label.textContent = option.label;
        copy.append(label);
        if (option.hint) {
            const hint = document.createElement("small");
            hint.textContent = option.hint;
            copy.append(hint);
        }
        const arrow = document.createElement("span");
        arrow.textContent = "›";
        button.append(key, copy, arrow);
        button.addEventListener("click", () => goTo(option.next));
        options.append(button);
    });
    section.append(options);
    stage?.append(section);
}
/* ---------- 渲染：战斗剧情 ---------- */
function renderBattle(node) {
    const section = document.createElement("section");
    section.className = "story-battle";
    const head = document.createElement("header");
    head.className = "story-battle-head";
    const kicker = document.createElement("p");
    kicker.className = "eyebrow";
    kicker.textContent = str("wave", "WAVE");
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
    const waves = document.createElement("div");
    waves.className = "story-waves";
    (node.waves || []).forEach((wave) => {
        waves.append(renderWave(wave));
    });
    section.append(waves);
    const footer = document.createElement("footer");
    footer.className = "story-battle-foot";
    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "enter-trapezoid story-start";
    startButton.innerHTML = `${str("startBattle", "START")} <b>&gt;&gt;</b>`;
    startButton.addEventListener("click", () => {
        toast(str("battleLocked", "NOT CONNECTED"));
    });
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "button button-ghost story-skip-battle";
    continueButton.textContent = str("continue", "CONTINUE");
    continueButton.addEventListener("click", () => goTo(node.next));
    footer.append(startButton, continueButton);
    section.append(footer);
    stage?.append(section);
}
function renderWave(wave) {
    const card = document.createElement("article");
    card.className = "story-wave";
    const head = document.createElement("header");
    const label = document.createElement("b");
    label.textContent = wave.label || `${str("wave", "WAVE")} ${wave.index}`;
    head.append(label);
    if (wave.note) {
        const note = document.createElement("small");
        note.textContent = wave.note;
        head.append(note);
    }
    card.append(head);
    const event = document.createElement("p");
    event.className = "story-event";
    event.textContent = `${str("event", "EVENT")}：${wave.event || "—"}`;
    card.append(event);
    const unitBlock = document.createElement("div");
    unitBlock.className = "story-block";
    const unitTitle = document.createElement("small");
    unitTitle.textContent = str("enemyUnits", "ENEMIES");
    const units = document.createElement("div");
    units.className = "story-units";
    (wave.enemies || []).forEach((enemy) => {
        const hero = heroOf(enemy.hero);
        const chip = document.createElement("span");
        chip.className = "story-unit";
        applyPalette(chip, hero?.palette);
        const mark = document.createElement("i");
        mark.textContent = hero?.initial || "?";
        const text = document.createElement("b");
        text.textContent = `${hero?.name || enemy.hero} ×${enemy.count}`;
        chip.append(mark, text);
        if (enemy.mod) {
            const mod = document.createElement("em");
            mod.textContent = enemy.mod;
            chip.append(mod);
        }
        units.append(chip);
    });
    unitBlock.append(unitTitle, units);
    card.append(unitBlock);
    const skillBlock = document.createElement("div");
    skillBlock.className = "story-block";
    const skillTitle = document.createElement("small");
    skillTitle.textContent = str("enemySkills", "SKILLS");
    skillBlock.append(skillTitle);
    const list = document.createElement("ul");
    list.className = "story-skills";
    if (!wave.skills || !wave.skills.length) {
        const empty = document.createElement("li");
        empty.className = "story-skill-empty";
        empty.textContent = str("noSkills", "NONE");
        list.append(empty);
    }
    else {
        wave.skills.forEach((skill) => {
            const item = document.createElement("li");
            const name = document.createElement("b");
            name.textContent = skill.name;
            const desc = document.createElement("small");
            desc.textContent = skill.description;
            const meta = document.createElement("em");
            const parts = [`${str("cooldown", "CD")} ${skill.cooldown}s`];
            if (skill.damage)
                parts.push(`${str("damage", "DMG")} ${skill.damage}`);
            if (skill.effect)
                parts.push(skill.effect);
            meta.textContent = parts.join(" · ");
            item.append(name, desc, meta);
            list.append(item);
        });
    }
    skillBlock.append(list);
    card.append(skillBlock);
    return card;
}
/* ---------- 渲染：结束 ---------- */
function renderEnd(node) {
    const section = document.createElement("section");
    section.className = "story-end";
    const kicker = document.createElement("p");
    kicker.className = "eyebrow";
    kicker.textContent = "END";
    const heading = document.createElement("h2");
    heading.textContent = node.title || "";
    const text = document.createElement("p");
    text.className = "story-end-text";
    text.textContent = node.text || "";
    const actions = document.createElement("div");
    actions.className = "story-end-actions";
    const home = document.createElement("a");
    home.className = "enter-trapezoid";
    home.href = "/";
    home.textContent = str("backHome", "HOME");
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "button button-ghost";
    replay.textContent = str("replay", "REPLAY");
    replay.addEventListener("click", () => {
        goTo(script?.start);
    });
    actions.append(home, replay);
    section.append(kicker, heading, text, actions);
    stage?.append(section);
}
/* ---------- 初始化 ---------- */
function init() {
    if (!script)
        throw new Error("Story script was not provided by the Flask page.");
    buildNodeMap();
    if (titleLabel)
        titleLabel.textContent = script.title;
    if (backdrop && script.background) {
        backdrop.style.backgroundImage = `url("/static/${script.background}")`;
    }
    skipButton?.addEventListener("click", skipToBattle);
    document.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
            if (currentNode?.type === "dialogue") {
                event.preventDefault();
                advance();
            }
            return;
        }
        if (currentNode?.type === "choice" && /^[1-9]$/.test(event.key)) {
            const index = Number(event.key) - 1;
            const option = currentNode.options?.[index];
            if (option) {
                event.preventDefault();
                goTo(option.next);
            }
        }
    });
    goTo(script.start);
}
init();
