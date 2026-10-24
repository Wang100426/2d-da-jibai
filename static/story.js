"use strict";
/**
 * 剧情引擎（纯逻辑，不碰 DOM）。
 *
 * 职责边界：
 * - **数据**：章节与节点来自 `story_script.py`，文本已按语言合并好。
 * - **执行**：本文件只做状态机（节点跳转、选择记录、任务状态、奖励防重）。
 * - **渲染**：全部在 `story.ts`。所以这里可以直接放进 Node 跑测试。
 *
 * 不做的事：不发请求、不读 localStorage、不改存档 —— 存档由 `story.ts` 调后端接口。
 */
function emptyProgress(entry) {
    return {
        node: entry,
        flags: {},
        objectives: {},
        choices: {},
        claimed_rewards: [],
        completed: false,
    };
}
/** 把外部（存档/接口）返回的进度整理成引擎可用的形状。 */
function normalizeProgress(raw, chapter, known) {
    const base = emptyProgress(chapter.entry);
    if (!raw || typeof raw !== "object")
        return base;
    const source = raw;
    const node = typeof source.node === "string" && known.has(source.node) ? source.node : chapter.entry;
    const boolMap = (value) => {
        const result = {};
        // 数组也是 object，但当成映射处理会产生 "0"/"1" 这类垃圾键，直接丢弃
        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value).forEach(([key, item]) => {
                if (key)
                    result[key] = Boolean(item);
            });
        }
        return result;
    };
    const stringMap = (value) => {
        const result = {};
        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value).forEach(([key, item]) => {
                if (key && typeof item === "string")
                    result[key] = item;
            });
        }
        return result;
    };
    return {
        node,
        flags: boolMap(source.flags),
        objectives: boolMap(source.objectives),
        choices: stringMap(source.choices),
        claimed_rewards: Array.isArray(source.claimed_rewards)
            ? source.claimed_rewards.filter((item) => typeof item === "string")
            : [],
        completed: Boolean(source.completed),
    };
}
class StoryEngine {
    chapter;
    nodes = new Map();
    problems = [];
    state;
    constructor(chapter, saved) {
        this.chapter = chapter;
        this.indexNodes();
        this.validate();
        this.state = normalizeProgress(saved, chapter, this.nodes);
    }
    /* ---------- 初始化与校验 ---------- */
    indexNodes() {
        (this.chapter.nodes || []).forEach((node) => {
            if (!node || typeof node.id !== "string" || !node.id) {
                this.problems.push({ code: "missing_config", message: "节点缺少 id" });
                return;
            }
            if (this.nodes.has(node.id)) {
                this.problems.push({ code: "duplicate_node", message: `节点 id 重复：${node.id}`, node: node.id });
                return;
            }
            this.nodes.set(node.id, node);
        });
    }
    validate() {
        if (!this.nodes.size) {
            this.problems.push({ code: "empty_chapter", message: `章节 ${this.chapter.id} 没有节点` });
            return;
        }
        if (!this.nodes.has(this.chapter.entry)) {
            this.problems.push({
                code: "unknown_node",
                message: `entry 指向不存在的节点：${this.chapter.entry}`,
                node: this.chapter.entry,
            });
        }
        this.nodes.forEach((node, id) => {
            const targets = [];
            if (node.next)
                targets.push(node.next);
            if (node.type === "choice") {
                const options = node.options || [];
                if (!options.length) {
                    this.problems.push({ code: "missing_config", message: "choice 没有可选项", node: id });
                }
                options.forEach((option) => targets.push(option.next));
            }
            if (node.type === "battle") {
                if (!node.on_win || !node.on_lose) {
                    this.problems.push({ code: "missing_config", message: "battle 缺少 on_win / on_lose", node: id });
                }
                const waves = node.battle?.target_waves;
                if (typeof waves !== "number" || waves < 1) {
                    this.problems.push({ code: "missing_config", message: "battle.target_waves 必须是正整数", node: id });
                }
                targets.push(node.on_win, node.on_lose);
            }
            if (node.type === "reward" && !node.reward_id) {
                this.problems.push({ code: "missing_config", message: "reward 缺少 reward_id", node: id });
            }
            targets.forEach((target) => {
                if (target && !this.nodes.has(target)) {
                    this.problems.push({
                        code: "invalid_transition",
                        message: `跳转到不存在的节点：${target}`,
                        node: id,
                    });
                }
            });
        });
    }
    /* ---------- 只读状态 ---------- */
    get issues() {
        return [...this.problems];
    }
    get progress() {
        return this.state;
    }
    get isValid() {
        return this.problems.length === 0;
    }
    getNode(id) {
        return this.nodes.get(id) || null;
    }
    currentNode() {
        return this.state.node ? this.getNode(this.state.node) : null;
    }
    isCompleted() {
        return this.state.completed;
    }
    hasFlag(flag) {
        return Boolean(this.state.flags[flag]);
    }
    /* ---------- 状态变更 ---------- */
    /** 进入章节：优先回到存档节点，存档节点不可用则回 entry。 */
    start() {
        if (!this.isValid) {
            return {
                ok: false,
                node: null,
                error: this.problems[0] || { code: "empty_chapter", message: "章节不可用" },
            };
        }
        const target = this.state.node && this.nodes.has(this.state.node) ? this.state.node : this.chapter.entry;
        return this.enter(target);
    }
    /** 跳转到指定节点，非法跳转不会改变当前状态。 */
    goTo(nodeId) {
        if (!nodeId) {
            return {
                ok: false,
                node: this.currentNode(),
                error: { code: "unknown_node", message: "空的节点 id" },
            };
        }
        if (!this.nodes.has(nodeId)) {
            return {
                ok: false,
                node: this.currentNode(),
                error: { code: "unknown_node", message: `节点不存在：${nodeId}`, node: nodeId },
            };
        }
        return this.enter(nodeId);
    }
    enter(nodeId) {
        this.state.node = nodeId;
        const node = this.nodes.get(nodeId) || null;
        return { ok: Boolean(node), node };
    }
    /** 分支选择：记录选择并跳到选项指向的节点。 */
    choose(optionIndex) {
        const node = this.currentNode();
        if (!node || node.type !== "choice") {
            return {
                ok: false,
                node,
                error: { code: "wrong_node_type", message: "当前节点不是 choice", node: node?.id },
            };
        }
        const option = node.options?.[optionIndex];
        if (!option) {
            return {
                ok: false,
                node,
                error: { code: "invalid_option", message: `选项越界：${optionIndex}`, node: node.id },
            };
        }
        this.state.choices[node.id] = option.id;
        return this.goTo(option.next);
    }
    /** 战斗结果回传：按 on_win / on_lose 跳转。 */
    applyBattleResult(result) {
        const node = this.currentNode();
        if (!node || node.type !== "battle") {
            return {
                ok: false,
                node,
                error: { code: "wrong_node_type", message: "当前节点不是 battle", node: node?.id },
            };
        }
        const target = result === "win" ? node.on_win : node.on_lose;
        if (!target) {
            return {
                ok: false,
                node,
                error: { code: "missing_config", message: `battle 缺少 ${result} 分支`, node: node.id },
            };
        }
        if (result === "win")
            this.state.flags[`battle:${node.id}`] = true;
        return this.goTo(target);
    }
    /** 任务目标勾选。 */
    setObjective(goalId, done) {
        if (!goalId)
            return;
        this.state.objectives[goalId] = done;
        const node = this.currentNode();
        if (node && node.type === "objective") {
            const goal = (node.goals || []).find((item) => item.id === goalId);
            if (goal?.done_flag)
                this.state.flags[goal.done_flag] = done;
        }
    }
    /** 当前 objective 节点是否全部达成。 */
    objectivesDone() {
        const node = this.currentNode();
        if (!node || node.type !== "objective")
            return true;
        return (node.goals || []).every((goal) => Boolean(this.state.objectives[goal.id]));
    }
    /** objective 节点能否继续：要么全部达成，要么该节点允许跳过。 */
    canLeaveObjective() {
        const node = this.currentNode();
        if (!node || node.type !== "objective")
            return true;
        return this.objectivesDone() || Boolean(node.allow_skip);
    }
    /** 当前节点是否为待领取的奖励（已领过就返回 null）。 */
    pendingReward() {
        const node = this.currentNode();
        if (!node || node.type !== "reward" || !node.reward_id)
            return null;
        return this.state.claimed_rewards.includes(node.reward_id) ? null : node;
    }
    /** 本地标记奖励已领取；重复标记返回 false。 */
    markRewardClaimed(rewardId) {
        if (!rewardId)
            return false;
        if (this.state.claimed_rewards.includes(rewardId))
            return false;
        this.state.claimed_rewards.push(rewardId);
        return true;
    }
    /** 标记章节完成。 */
    finishChapter() {
        this.state.completed = true;
    }
    /** 导出可提交给存档接口的进度。 */
    snapshot() {
        return {
            node: this.state.node,
            flags: { ...this.state.flags },
            objectives: { ...this.state.objectives },
            choices: { ...this.state.choices },
            claimed_rewards: [...this.state.claimed_rewards],
            completed: this.state.completed,
        };
    }
}
/**
 * 剧情执行页的 UI 层。
 *
 * 分工：所有状态机逻辑在 `story_engine.ts`（可单测），本文件只做三件事：
 * 1. 把节点画出来
 * 2. 把交互交给引擎
 * 3. 把进度/奖励同步到后端（进度写档、奖励幂等领取）
 */
const storyWindow = window;
const chapter = storyWindow.STORY_CHAPTER;
const roster = storyWindow.STORY_ROSTER || [];
const storyHeroes = storyWindow.STORY_HEROES || [];
const strings = storyWindow.STORY_STRINGS || {};
if (!chapter)
    throw new Error("剧情数据未由 Flask 页面注入。");
const engine = new StoryEngine(chapter, storyWindow.STORY_PROGRESS);
/** 赛博世界剧情：战斗前自选的英雄（英雄剧情固定用 chapter.hero，忽略这个）。 */
let pickedHero = null;
const stage = document.getElementById("story-stage");
if (!stage)
    throw new Error("缺少剧情舞台元素。");
const backdrop = document.getElementById("story-backdrop");
const skipButton = document.getElementById("story-skip");
const progressLabel = document.getElementById("story-progress");
const titleLabel = document.getElementById("story-title");
const chapterLabel = document.getElementById("story-chapter");
const params = new URLSearchParams(window.location.search);
let lastBattleResult = null;
function str(key, fallback = "") {
    return strings[key] || fallback;
}
function heroOf(id) {
    if (!id)
        return undefined;
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
function toast(message, kind = "info") {
    const element = document.createElement("div");
    element.className = `story-toast${kind === "warning" ? " story-toast-warning" : ""}`;
    element.textContent = message;
    document.body.append(element);
    window.setTimeout(() => element.classList.add("story-toast-out"), 1700);
    window.setTimeout(() => element.remove(), 2200);
}
/* ---------- 存档同步 ---------- */
function persist() {
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
function updateHeader() {
    if (!progressLabel || !chapter)
        return;
    const index = chapter.nodes.findIndex((node) => node.id === engine.progress.node);
    progressLabel.textContent = `${str("progress", "PROGRESS")} ${String(Math.max(0, index) + 1).padStart(2, "0")} / ${String(chapter.nodes.length).padStart(2, "0")}`;
}
function render() {
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
            renderBroken(str("unknown_node", "未知节点类型"), [`type=${String(node.type)}`]);
            break;
    }
}
/** 统一的跳转入口：失败时给出可见错误，而不是白屏。 */
function move(step) {
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
function renderBattle(node) {
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
            waves.append(renderWave(raw));
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
function renderHeroPicker() {
    const wrap = document.createElement("div");
    wrap.className = "story-hero-pick";
    const label = document.createElement("small");
    label.textContent = str("pickHero", "PICK YOUR FIGHTER");
    wrap.append(label);
    const grid = document.createElement("div");
    grid.className = "story-hero-grid";
    const buttons = [];
    const unlocked = storyHeroes.filter((hero) => !hero.locked);
    if (!pickedHero || !unlocked.some((hero) => hero.id === pickedHero)) {
        pickedHero = unlocked[0]?.id || "volt";
    }
    storyHeroes.forEach((hero) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "story-hero-option";
        button.disabled = hero.locked;
        if (hero.id === pickedHero)
            button.classList.add("selected");
        if (hero.locked)
            button.classList.add("locked");
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
function renderWave(wave) {
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
            if (skill.damage)
                parts.push(`${str("damage", "DMG")} ${skill.damage}`);
            if (skill.effect)
                parts.push(skill.effect);
            metaInfo.textContent = parts.join(" · ");
            item.append(name, desc, metaInfo);
            list.append(item);
        });
        card.append(list);
    }
    return card;
}
/** 复用现有 /battle：只传英雄、章节、节点，战斗本身不在这里实现。 */
function startStoryBattle(node, heroId) {
    persist();
    const query = new URLSearchParams({
        hero: heroId,
        story: chapter?.id || "",
        node: node.id,
    });
    window.location.href = `/battle?${query.toString()}`;
}
/* ---------- 渲染：任务目标 ---------- */
function renderObjective(node) {
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
    }
    else {
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
function renderReward(node) {
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
async function claimReward(node, status, next) {
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
        const data = await response.json();
        engine.markRewardClaimed(rewardId);
        if (data.already_claimed) {
            status.textContent = str("rewardAlready", "该奖励已领取过，不会重复发放。");
        }
        else {
            status.textContent = data.infinite_coins
                ? str("rewardInfinite", "金币无限，奖励已记录。")
                : str("rewardGained", "已获得金币：{coins}").replace("{coins}", String(data.gained ?? node.coins ?? 0));
        }
    }
    catch {
        status.textContent = str("rewardFailed", "领取失败，可稍后重试。");
    }
    finally {
        next.disabled = false;
        persist();
    }
}
/* ---------- 渲染：章节结束 ---------- */
function renderChapterEnd(node) {
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
function renderBroken(title, details) {
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
function skipToBattle() {
    let cursor = engine.progress.node;
    const seen = new Set();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const node = engine.getNode(cursor);
        if (!node)
            break;
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
function boot() {
    if (engine.issues.length) {
        console.warn("[story] chapter has problems", engine.issues);
    }
    if (titleLabel)
        titleLabel.textContent = chapter?.title || "";
    if (chapterLabel)
        chapterLabel.textContent = chapter?.category_name || "";
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
    }
    else {
        engine.start();
    }
    skipButton?.addEventListener("click", skipToBattle);
    document.addEventListener("keydown", (event) => {
        const node = engine.currentNode();
        if (!node)
            return;
        if ((event.key === " " || event.key === "Enter") && node.type === "dialogue") {
            event.preventDefault();
            if (isTyping()) {
                finishTyping();
            }
            else {
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
