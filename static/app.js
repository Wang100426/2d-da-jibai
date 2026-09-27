"use strict";
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Required map element was not found: ${selector}`);
    return element;
}
function requireContext(canvas) {
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error(`Unable to create 2D canvas context: ${canvas.id}`);
    return context;
}
function getMapConfig() {
    const mapConfig = window.MAP_CONFIG;
    if (!mapConfig)
        throw new Error("Map configuration was not provided by the Flask page.");
    return mapConfig;
}
const world = requireElement("#world");
const context = requireContext(world);
const minimap = requireElement("#minimap");
const miniContext = requireContext(minimap);
const config = getMapConfig();
const map = { width: config.duel ? 1400 : 3200, height: config.duel ? 900 : 2400 };
const player = {
    x: config.multiplayer?.x ?? (config.duel ? 430 : 1600),
    y: config.multiplayer?.y ?? (config.duel ? 450 : 1200),
    radius: 19,
    speed: 235,
};
const camera = { x: 0, y: 0 };
const facing = { x: 1, y: 0 };
const playerState = {
    hp: config.multiplayer?.hp ?? 100,
    maxHp: config.multiplayer?.max_hp ?? 100,
    shield: config.multiplayer?.shield ?? 0,
    energy: config.multiplayer?.energy ?? 100,
    maxEnergy: config.multiplayer?.max_energy ?? 100,
    damageMultiplier: 1,
    attackSpeed: 2,
    damageReduction: Math.min(0.6, config.defense / 250),
    energyRegen: 1.5,
    cooldownReduction: 0,
    lifesteal: 0,
    dodgeChance: 0,
    thornDamageMultiplier: 0.45,
    thornReturnDamage: 12,
};
let empoweredAttack = false;
let wave = 0;
let waveState = "starting";
let enemiesToSpawn = 0;
let spawnTimer = 0;
let breakTimer = 1.5;
let runLevel = 1;
let skillExperience = 0;
let skillExperienceLevel = 1;
let skillExperienceThreshold = 60;
let pendingSkillChoices = 0;
let runEnded = false;
let duelRound = 1;
let duelPlayerScore = 0;
let duelBotScore = 0;
let duelRoundActive = true;
let duelBreakRemaining = 0;
let duelUpgradePicked = false;
let duelUpgradeChoicesCurrent = [];
let basicAttackTimer = 0;
const keys = new Set();
const touchKeys = new Set();
const skillCooldowns = new Map();
const skillProgress = new Map(config.skills.map((skill) => [skill.id, { tier: 1, minorUpgrades: 0 }]));
const statusEffects = {};
const enemies = [];
const supplies = config.duel ? [] : [
    { x: 1180, y: 700, type: "health", collected: false },
    { x: 2040, y: 1450, type: "energy", collected: false },
    { x: 2720, y: 720, type: "health", collected: false },
    { x: 1540, y: 1370, type: "energy", collected: false },
    { x: 250, y: 1300, type: "health", collected: false },
    { x: 2970, y: 1510, type: "energy", collected: false },
];
const floatingTexts = [];
const skillVisuals = [];
const impactParticles = [];
const tabletProjectiles = [];
let tabletVolley;
const skillButtons = [...document.querySelectorAll(".map-skill[data-skill]")];
const toast = requireElement("#map-toast");
const pickupPrompt = requireElement("#pickup-prompt");
const basicAttackButton = requireElement("#basic-attack");
const hpBar = requireElement("#hp-bar");
const shieldBar = requireElement("#shield-bar");
const energyBar = requireElement("#energy-bar");
const hpLabel = requireElement("#hp-label");
const energyLabel = requireElement("#energy-label");
const lootCountLabel = requireElement("#loot-count");
const combatTraitsLabel = requireElement("#combat-traits");
const skillExperienceBar = requireElement("#skill-exp-bar");
const skillExperienceLabel = requireElement("#skill-exp-label");
const peerList = requireElement("#peer-list");
const mapMode = requireElement("#map-mode");
const waveTitle = requireElement("#wave-title");
const waveSubtitle = requireElement("#wave-subtitle");
const upgradeOverlay = requireElement("#upgrade-overlay");
const upgradeChoices = requireElement("#upgrade-choices");
const skillUpgradeOverlay = requireElement("#skill-upgrade-overlay");
const skillUpgradeChoices = requireElement("#skill-upgrade-choices");
const skillUpgradeTitle = requireElement("#skill-upgrade-title");
const skillUpgradeSubtitle = requireElement("#skill-upgrade-subtitle");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseToggle = document.querySelector("#pause-toggle");
const resumeRunButton = document.querySelector("#resume-run");
const runLevelLabel = requireElement("#run-level");
const runOverOverlay = requireElement("#run-over-overlay");
const finalWaveLabel = requireElement("#final-wave");
const retryRunButton = requireElement("#retry-run");
const duelUpgradeOverlay = document.querySelector("#duel-upgrade-overlay");
const duelUpgradeTitle = document.querySelector("#duel-upgrade-title");
const duelUpgradeSubtitle = document.querySelector("#duel-upgrade-subtitle");
const duelUpgradeChoices = document.querySelector("#duel-upgrade-choices");
const duelCountdown = document.querySelector("#duel-countdown");
const duelOpponentName = document.querySelector("#duel-opponent-name");
const duelOpponentHp = document.querySelector("#duel-opponent-hp");
const duelOpponentVitals = document.querySelector("#duel-opponent-vitals");
let lootCollected = 0;
let toastTimer = 0;
let nearestSupply;
let lastHudEnergy = -1;
let afterimage;
let afterimageDash;
let syncPending = false;
let syncErrorShown = false;
let lastSync = 0;
let attackSequence = 0;
const pendingPvpAttacks = [];
const remotePlayers = new Map();
const colors = {
    pink: { main: "#ff4fa3", light: "#ffd3e8", dark: "#812354" },
    green: { main: "#b7ef55", light: "#e9ffb7", dark: "#426b2e" },
    blue: { main: "#8c9aff", light: "#e0e4ff", dark: "#414f9e" },
    tech: { main: "#438dff", light: "#e1eeff", dark: "#183c88" },
};
const heroColors = colors[config.accent] || colors.pink;
function hasPlayerEffect(effect) {
    return (statusEffects[effect] || 0) > 0;
}
function playerMovementLocked() {
    return hasPlayerEffect("眩晕") || hasPlayerEffect("禁锢");
}
function playerActionsLocked() {
    return hasPlayerEffect("眩晕");
}
function showControlBlocked(action) {
    const reason = hasPlayerEffect("眩晕") ? "眩晕中无法行动" : "禁锢中无法移动";
    showToast(`${action}失败：${reason}。`, "warning");
}
const obstacles = [
    { x: 360, y: 300, w: 360, h: 230, type: "building", name: "废弃商场" },
    { x: 980, y: 250, w: 260, h: 330, type: "building", name: "旧城区" },
    { x: 1790, y: 310, w: 440, h: 220, type: "building", name: "信号塔基站" },
    { x: 2600, y: 280, w: 300, h: 360, type: "building", name: "物流中心" },
    { x: 220, y: 850, w: 280, h: 340, type: "building", name: "地铁入口" },
    { x: 760, y: 920, w: 360, h: 250, type: "building", name: "地下车库" },
    { x: 1410, y: 790, w: 350, h: 390, type: "building", name: "中央枢纽" },
    { x: 2200, y: 900, w: 410, h: 240, type: "building", name: "维修厂" },
    { x: 2840, y: 970, w: 220, h: 390, type: "building", name: "高墙区" },
    { x: 400, y: 1580, w: 440, h: 280, type: "building", name: "旧体育馆" },
    { x: 1110, y: 1690, w: 300, h: 390, type: "building", name: "变电站" },
    { x: 1810, y: 1580, w: 440, h: 300, type: "building", name: "废弃工厂" },
    { x: 2550, y: 1660, w: 390, h: 280, type: "building", name: "货运仓库" },
    { x: 820, y: 650, w: 110, h: 38, type: "barrier", name: "路障" },
    { x: 1270, y: 1330, w: 150, h: 40, type: "barrier", name: "路障" },
    { x: 1960, y: 690, w: 42, h: 140, type: "barrier", name: "路障" },
    { x: 2500, y: 1320, w: 120, h: 42, type: "barrier", name: "路障" },
    { x: 920, y: 1450, w: 44, h: 130, type: "barrier", name: "路障" },
    { x: 2340, y: 2060, w: 150, h: 38, type: "barrier", name: "路障" },
];
const roads = [
    { x: 0, y: 650, w: map.width, h: 110 },
    { x: 0, y: 1370, w: map.width, h: 120 },
    { x: 790, y: 0, w: 100, h: map.height },
    { x: 1300, y: 0, w: 105, h: map.height },
    { x: 2280, y: 0, w: 115, h: map.height },
];
const upgradePool = [
    {
        id: "attack-speed",
        name: "高频驱动",
        description: "普通攻击速度提高 0.25 次/秒，最高 3.5 次/秒。",
        available: () => playerState.attackSpeed < 3.5,
        apply: () => { playerState.attackSpeed = Math.min(3.5, playerState.attackSpeed + 0.25); },
    },
    {
        id: "armor",
        name: "纳米装甲",
        description: "受到的伤害额外降低 8%，最多降低至 60%。",
        available: () => playerState.damageReduction < 0.6,
        apply: () => { playerState.damageReduction = Math.min(0.6, playerState.damageReduction + 0.08); },
    },
    {
        id: "power",
        name: "超载弹药",
        description: "攻击伤害提高 20%。",
        apply: () => { playerState.damageMultiplier += 0.2; },
    },
    {
        id: "lifesteal",
        name: "噬血协议",
        description: "造成伤害时回复相当于伤害 10% 的生命。",
        available: () => playerState.lifesteal < 0.6,
        apply: () => { playerState.lifesteal = Math.min(0.6, playerState.lifesteal + 0.1); },
    },
    {
        id: "dodge",
        name: "相位闪避",
        description: "受到攻击时有 8% 概率完全闪避本次伤害。",
        available: () => playerState.dodgeChance < 0.6,
        apply: () => { playerState.dodgeChance = Math.min(0.6, playerState.dodgeChance + 0.08); },
    },
    {
        id: "vitality",
        name: "合金心脏",
        description: "最大生命提高 25，并恢复同等生命。",
        apply: () => {
            playerState.maxHp += 25;
            playerState.hp = Math.min(playerState.maxHp, playerState.hp + 25);
        },
    },
    {
        id: "reactor",
        name: "脉冲反应堆",
        description: "能量恢复速度提高 50%。",
        apply: () => { playerState.energyRegen += 0.75; },
    },
    {
        id: "fleet",
        name: "轻量化关节",
        description: "移动速度提高 12%。",
        apply: () => { player.speed *= 1.12; },
    },
    {
        id: "medkit",
        name: "战场急救",
        description: "立即恢复 35 点生命。",
        apply: () => { playerState.hp = Math.min(playerState.maxHp, playerState.hp + 35); },
    },
    {
        id: "coolant",
        name: "冷却液注入",
        description: "当前技能冷却立即缩短 2 秒。",
        apply: () => {
            skillCooldowns.forEach((remaining, id) => skillCooldowns.set(id, Math.max(0, remaining - 2)));
        },
    },
    {
        id: "cooldown",
        name: "时间折叠",
        description: "技能冷却时间缩短 8%，最多缩短 40%。",
        available: () => playerState.cooldownReduction < 0.4,
        apply: () => {
            playerState.cooldownReduction = Math.min(0.4, playerState.cooldownReduction + 0.08);
        },
    },
];
function updateWaveHud() {
    if (config.duel) {
        updateDuelHud();
        return;
    }
    basicAttackTimer = getBasicAttackCooldown();
    const displayWave = waveState === "starting" ? wave + 1 : wave;
    const title = `第 ${displayWave} 波 · ${waveState === "active" ? "交战中" : waveState === "upgrade" ? "波次完成" : "集结中"}`;
    if (waveTitle.textContent !== title)
        waveTitle.textContent = title;
    if (waveState === "active") {
        const alive = enemies.filter((enemy) => enemy.hp > 0).length;
        const subtitle = enemiesToSpawn > 0
            ? `场上 ${alive} · 正在接近 ${enemiesToSpawn}`
            : `剩余敌人 ${alive}`;
        if (waveSubtitle.textContent !== subtitle)
            waveSubtitle.textContent = subtitle;
    }
    else {
        const subtitle = waveState === "upgrade" ? "选择强化，准备下一波" : "敌人即将出现";
        if (waveSubtitle.textContent !== subtitle)
            waveSubtitle.textContent = subtitle;
    }
}
function updateDuelHud() {
    const title = `你 ${duelPlayerScore} : ${duelBotScore} AI · 第 ${duelRound} 回合`;
    if (waveTitle.textContent !== title)
        waveTitle.textContent = title;
    const subtitle = duelRoundActive
        ? "先赢下 4 分获得胜利"
        : `下一回合 ${Math.max(0, Math.ceil(duelBreakRemaining))} 秒后开始`;
    if (waveSubtitle.textContent !== subtitle)
        waveSubtitle.textContent = subtitle;
    const bot = enemies.find((enemy) => enemy.duelBot);
    if (bot) {
        if (duelOpponentName && duelOpponentName.textContent !== bot.name)
            duelOpponentName.textContent = bot.name || "AI 对手";
        if (duelOpponentHp)
            duelOpponentHp.style.width = `${Math.max(0, bot.hp / bot.maxHp * 100)}%`;
        if (duelOpponentVitals)
            duelOpponentVitals.textContent = `${Math.ceil(Math.max(0, bot.hp))} / ${bot.maxHp}`;
    }
}
function isSpawnPositionClear(x, y) {
    if (Math.hypot(x - player.x, y - player.y) < 290)
        return false;
    if (x < 35 || y < 35 || x > map.width - 35 || y > map.height - 35)
        return false;
    return !obstacles.some((item) => x > item.x - 40 && x < item.x + item.w + 40 &&
        y > item.y - 40 && y < item.y + item.h + 40);
}
function createDuelBot() {
    const availableHeroes = ["volt", "moss", "luna", "tech"].filter((id) => id !== getHeroId());
    const botHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)] || "volt";
    const profiles = {
        volt: { name: "霓虹拳王", initial: "拳", accent: "pink", defense: 58 },
        moss: { name: "苔藓守卫", initial: "苔", accent: "green", defense: 94 },
        luna: { name: "月蚀术士", initial: "蚀", accent: "blue", defense: 48 },
        tech: { name: "科技男", initial: "科", accent: "tech", defense: 58 },
    };
    const profile = profiles[botHero] || profiles.volt;
    const maxHp = 125 + (duelRound - 1) * 18;
    return {
        x: map.width / 2 + 220,
        y: map.height / 2,
        hp: maxHp,
        maxHp,
        attackTimer: 0.5,
        attack: 10 + duelRound * 1.5,
        speed: 182 + Math.min(duelRound - 1, 4) * 8,
        kind: "grunt",
        poisonDamage: 0,
        poisonTimer: 0,
        effects: {},
        experienceAwarded: true,
        duelBot: true,
        accent: profile.accent,
        initial: profile.initial,
        name: profile.name,
        skillTimer: 2.5,
        defenseReduction: Math.min(0.38, profile.defense / 250 + (duelRound - 1) * 0.015),
    };
}
function getHeroId() {
    const heroByAccent = { pink: "volt", green: "moss", blue: "luna", tech: "tech" };
    return heroByAccent[config.accent] || "volt";
}
function startDuelRound() {
    enemies.splice(0, enemies.length, createDuelBot());
    player.x = map.width / 2 - 220;
    player.y = map.height / 2;
    playerState.hp = playerState.maxHp;
    playerState.energy = playerState.maxEnergy;
    playerState.shield = 0;
    basicAttackTimer = 0;
    empoweredAttack = false;
    Object.keys(statusEffects).forEach((effect) => delete statusEffects[effect]);
    skillCooldowns.clear();
    afterimage = undefined;
    afterimageDash = undefined;
    skillVisuals.splice(0);
    impactParticles.splice(0);
    floatingTexts.splice(0);
    tabletProjectiles.splice(0);
    tabletVolley = undefined;
    duelRoundActive = true;
    duelBreakRemaining = 0;
    duelUpgradePicked = false;
    if (duelUpgradeOverlay)
        duelUpgradeOverlay.hidden = true;
    keys.clear();
    touchKeys.clear();
    updateHud();
    updateDuelHud();
}
function spawnEnemyForWave() {
    let x = player.x;
    let y = player.y;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 340 + Math.random() * 260;
        const candidateX = Math.max(35, Math.min(map.width - 35, player.x + Math.cos(angle) * distance));
        const candidateY = Math.max(35, Math.min(map.height - 35, player.y + Math.sin(angle) * distance));
        if (isSpawnPositionClear(candidateX, candidateY)) {
            x = candidateX;
            y = candidateY;
            break;
        }
    }
    const roll = Math.random();
    const kind = wave >= 3 && roll > 0.78 ? "brute" : wave >= 2 && roll > 0.5 ? "runner" : "grunt";
    const hpScale = 1 + (wave - 1) * 0.16;
    const base = kind === "brute" ? { hp: 150, attack: 13, speed: 34 } : kind === "runner" ? { hp: 62, attack: 7, speed: 88 } : { hp: 88, attack: 9, speed: 54 };
    enemies.push({
        x, y,
        hp: Math.round(base.hp * hpScale),
        maxHp: Math.round(base.hp * hpScale),
        attackTimer: 0,
        attack: Math.round(base.attack * (1 + (wave - 1) * 0.08)),
        speed: base.speed,
        kind,
        poisonDamage: 0,
        poisonTimer: 0,
        effects: {},
        experienceAwarded: false,
    });
    impactParticles.forEach((particle) => {
        context.save();
        context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        context.shadowColor = particle.color;
        context.shadowBlur = 9;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
    });
    tabletProjectiles.forEach((tablet) => {
        const progress = Math.min(1, tablet.age / tablet.duration);
        const spread = (1 - progress) * tablet.lane * 38;
        const x = tablet.startX + (tablet.targetX - tablet.startX) * progress + spread * -tablet.directionY;
        const y = tablet.startY + (tablet.targetY - tablet.startY) * progress + spread * tablet.directionX;
        context.save();
        context.globalAlpha = 0.24 * (1 - progress * 0.35);
        context.strokeStyle = "#438dff";
        context.shadowColor = "#438dff";
        context.shadowBlur = 16;
        context.lineWidth = 9;
        context.beginPath();
        context.moveTo(x - tablet.directionX * 34, y - tablet.directionY * 34);
        context.lineTo(x, y);
        context.stroke();
        context.globalAlpha = 1;
        context.translate(x, y);
        context.rotate(Math.atan2(tablet.directionY, tablet.directionX) + Math.PI / 2);
        context.shadowColor = "#438dff";
        context.shadowBlur = 22;
        context.fillStyle = "#101a36";
        context.strokeStyle = "#73b4ff";
        context.lineWidth = 2.5;
        context.beginPath();
        context.roundRect(-12, -19, 24, 38, 5);
        context.fill();
        context.stroke();
        const screen = context.createLinearGradient(-8, -12, 8, 12);
        screen.addColorStop(0, "#b7e3ff");
        screen.addColorStop(0.42, "#438dff");
        screen.addColorStop(1, "#172e72");
        context.shadowBlur = 10;
        context.fillStyle = screen;
        context.beginPath();
        context.roundRect(-8, -13, 16, 26, 3);
        context.fill();
        context.shadowBlur = 0;
        context.fillStyle = "#ffffff";
        context.globalAlpha = 0.8;
        context.fillRect(-5, -8, 8, 1.5);
        context.fillStyle = "#8fd3ff";
        context.fillRect(-5, -4, 10, 1);
        context.fillRect(-5, 0, 7, 1);
        context.globalAlpha = 1;
        context.fillStyle = "#d6efff";
        context.beginPath();
        context.arc(0, 16, 1.4, 0, Math.PI * 2);
        context.fill();
        context.restore();
    });
    if (afterimage && afterimage.age < afterimage.duration) {
        context.save();
        context.globalAlpha = 0.68 * (1 - afterimage.age / afterimage.duration);
        context.shadowColor = "#49e6e0";
        context.shadowBlur = 24;
        context.strokeStyle = "#baffff";
        context.fillStyle = "#49e6e055";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(afterimage.x, afterimage.y, player.radius + 4, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.fillStyle = "#d4fffb";
        context.font = "bold 18px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(config.initial, afterimage.x, afterimage.y);
        context.restore();
    }
}
function startWave() {
    wave += 1;
    waveState = "active";
    enemiesToSpawn = Math.min(4 + wave * 2, 18);
    spawnTimer = 0.3;
    updateWaveHud();
    showToast(`第 ${wave} 波来袭！准备迎战。`, "warning");
}
function showWaveUpgrade() {
    waveState = "upgrade";
    updateWaveHud();
    const choices = upgradePool
        .filter((choice) => !choice.available || choice.available())
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    upgradeChoices.replaceChildren();
    choices.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-choice";
        const name = document.createElement("b");
        name.textContent = choice.name;
        const description = document.createElement("span");
        description.textContent = choice.description;
        button.append(name, description);
        button.addEventListener("click", () => {
            choice.apply();
            runLevel += 1;
            runLevelLabel.textContent = `Lv.${String(runLevel).padStart(2, "0")}`;
            playerState.energy = Math.min(playerState.maxEnergy, playerState.energy + 25);
            upgradeOverlay.hidden = true;
            updateHud();
            showToast(`获得强化：${choice.name}。下一波即将开始。`);
            waveState = "starting";
            breakTimer = 2;
            updateWaveHud();
        });
        upgradeChoices.append(button);
    });
    upgradeOverlay.hidden = false;
}
function updateWaveSpawner(dt) {
    if (config.duel)
        return;
    if (waveState === "starting") {
        breakTimer -= dt;
        if (breakTimer <= 0)
            startWave();
        return;
    }
    if (waveState !== "active")
        return;
    spawnTimer -= dt;
    if (enemiesToSpawn > 0 && spawnTimer <= 0) {
        spawnEnemyForWave();
        enemiesToSpawn -= 1;
        spawnTimer = Math.max(0.45, 1.25 - wave * 0.035);
    }
    if (enemiesToSpawn === 0 && enemies.every((enemy) => enemy.hp <= 0)) {
        showWaveUpgrade();
    }
    updateWaveHud();
}
function resize() {
    const ratio = window.devicePixelRatio || 1;
    world.width = Math.floor(window.innerWidth * ratio);
    world.height = Math.floor(window.innerHeight * ratio);
    world.style.width = `${window.innerWidth}px`;
    world.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    minimap.width = 180;
    minimap.height = 132;
}
function showToast(message, kind = "success") {
    toast.textContent = message;
    toast.classList.toggle("warning", kind === "warning");
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2200);
}
function finishRun() {
    if (config.duel) {
        finishDuelRound(false);
        return;
    }
    runEnded = true;
    keys.clear();
    touchKeys.clear();
    finalWaveLabel.textContent = String(wave);
    waveSubtitle.textContent = "探索者已被击败";
    runOverOverlay.hidden = false;
}
function finishDuelRound(playerWon) {
    if (!config.duel || !duelRoundActive || runEnded)
        return;
    duelRoundActive = false;
    if (playerWon)
        duelPlayerScore += 1;
    else
        duelBotScore += 1;
    keys.clear();
    touchKeys.clear();
    basicAttackTimer = 0;
    updateDuelHud();
    if (duelPlayerScore >= 4 || duelBotScore >= 4) {
        runEnded = true;
        if (duelUpgradeOverlay)
            duelUpgradeOverlay.hidden = true;
        const won = duelPlayerScore >= 4;
        const title = document.querySelector("#run-over-title");
        const description = document.querySelector("#run-over-description");
        if (title)
            title.textContent = won ? "竞技胜利" : "挑战失败";
        if (description)
            description.textContent = `最终比分 ${duelPlayerScore} : ${duelBotScore}。${won ? "你击败了 AI 对手！" : "AI 对手赢下了本场比赛。"}`;
        retryRunButton.textContent = "再战一局";
        runOverOverlay.hidden = false;
        return;
    }
    showDuelUpgrade();
}
function showDuelUpgrade() {
    if (!duelUpgradeOverlay || !duelUpgradeChoices || !duelUpgradeTitle || !duelUpgradeSubtitle || !duelCountdown) {
        throw new Error("Duel upgrade interface is missing from the battle page.");
    }
    duelBreakRemaining = 10;
    duelUpgradePicked = false;
    duelUpgradeTitle.textContent = `第 ${duelRound} 回合结束 · 选择强化`;
    duelUpgradeSubtitle.textContent = "选择一项强化，十秒后自动开始下一回合。";
    duelUpgradeChoicesCurrent = upgradePool
        .filter((choice) => choice.id !== "coolant" && (!choice.available || choice.available()))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    duelUpgradeChoices.replaceChildren();
    duelUpgradeChoicesCurrent.forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-choice";
        const name = document.createElement("b");
        name.textContent = choice.name;
        const description = document.createElement("span");
        description.textContent = choice.description;
        button.append(name, description);
        button.addEventListener("click", () => {
            if (duelUpgradePicked || duelRoundActive)
                return;
            choice.apply();
            duelUpgradePicked = true;
            duelUpgradeSubtitle.textContent = `已获得强化：${choice.name}。等待下一回合开始。`;
            duelUpgradeChoices.querySelectorAll("button").forEach((item) => {
                item.disabled = true;
            });
            updateHud();
        });
        duelUpgradeChoices.append(button);
    });
    duelUpgradeOverlay.hidden = false;
    updateDuelHud();
}
function updateDuelBreak(dt) {
    if (!config.duel || duelRoundActive || runEnded || duelBreakRemaining <= 0)
        return;
    duelBreakRemaining = Math.max(0, duelBreakRemaining - dt);
    if (duelCountdown)
        duelCountdown.textContent = String(Math.ceil(duelBreakRemaining));
    if (duelBreakRemaining === 0) {
        if (!duelUpgradePicked && duelUpgradeChoicesCurrent.length) {
            duelUpgradeChoicesCurrent[Math.floor(Math.random() * duelUpgradeChoicesCurrent.length)].apply();
        }
        duelRound += 1;
        startDuelRound();
    }
    updateDuelHud();
}
function updateHud() {
    const energy = Math.floor(playerState.energy);
    const hp = Math.max(0, Math.floor(playerState.hp));
    const shield = Math.max(0, Math.floor(playerState.shield));
    const displayedMaxHp = playerState.maxHp + shield;
    hpBar.style.width = `${hp / displayedMaxHp * 100}%`;
    shieldBar.style.left = `${hp / displayedMaxHp * 100}%`;
    shieldBar.style.width = `${shield / displayedMaxHp * 100}%`;
    energyBar.style.width = `${energy / playerState.maxEnergy * 100}%`;
    hpLabel.textContent = shield > 0
        ? `${hp} + ${shield} / ${playerState.maxHp}`
        : `${hp} / ${playerState.maxHp}`;
    if (energy !== lastHudEnergy) {
        energyLabel.textContent = `${energy} / ${playerState.maxEnergy}`;
        lastHudEnergy = energy;
    }
    lootCountLabel.textContent = `${lootCollected}`;
    combatTraitsLabel.textContent =
        `攻速 ${playerState.attackSpeed.toFixed(1)}/秒 · 防御 ${Math.round(playerState.damageReduction * 100)}% · 吸血 ${Math.round(playerState.lifesteal * 100)}% · 闪避 ${Math.round(playerState.dodgeChance * 100)}%`;
    skillExperienceBar.style.width = `${skillExperience / skillExperienceThreshold * 100}%`;
    skillExperienceLabel.textContent = `Lv.${skillExperienceLevel} · ${skillExperience} / ${skillExperienceThreshold}`;
    skillButtons.forEach((button, index) => {
        const skill = config.skills[index];
        const progress = skill ? skillProgress.get(skill.id) : undefined;
        const rankLabel = button.querySelector(".skill-rank");
        if (!skill || !progress || !rankLabel)
            return;
        const required = progress.tier === 1 ? 3 : progress.tier === 2 ? 4 : 0;
        rankLabel.textContent = required
            ? `${progress.tier}阶 · 小强化 ${progress.minorUpgrades}/${required}`
            : "3阶 · 已满";
    });
    const basicCooldown = basicAttackButton.querySelector(".skill-cooldown");
    if (basicCooldown) {
        basicCooldown.textContent = basicAttackTimer > 0 ? `${basicAttackTimer.toFixed(1)}s` : "";
    }
    const basicDescription = basicAttackButton.querySelector("small");
    if (basicDescription) {
        const rate = getEffectiveAttackSpeed();
        const label = `${rate.toFixed(1)} 次/秒${config.duel ? "" : " · 回复 5 能量"}`;
        if (basicDescription.textContent !== label)
            basicDescription.textContent = label;
    }
}
function getEffectiveAttackSpeed() {
    const haste = (statusEffects["加速"] || 0) > 0 || (statusEffects["攻速加成"] || 0) > 0;
    return Math.min(3.5, playerState.attackSpeed * (haste ? 1.3 : 1));
}
function getBasicAttackCooldown() {
    return 1 / getEffectiveAttackSpeed();
}
function skillIsPaused() {
    return !skillUpgradeOverlay.hidden || !upgradeOverlay.hidden ||
        !!duelUpgradeOverlay && !duelUpgradeOverlay.hidden ||
        !!pauseOverlay && !pauseOverlay.hidden;
}
function togglePause() {
    if (config.multiplayer || config.duel || runEnded || !pauseOverlay)
        return;
    if (!pauseOverlay.hidden) {
        pauseOverlay.hidden = true;
        pauseToggle?.setAttribute("aria-pressed", "false");
        keys.clear();
        touchKeys.clear();
        return;
    }
    if (!skillUpgradeOverlay.hidden || !upgradeOverlay.hidden)
        return;
    pauseOverlay.hidden = false;
    pauseToggle?.setAttribute("aria-pressed", "true");
    keys.clear();
    touchKeys.clear();
}
function grantSkillExperience(amount, x, y) {
    skillExperience += amount;
    addFloatingText(x, y - 42, `+${amount} 技能经验`, "#ffe45c");
    while (skillExperience >= skillExperienceThreshold) {
        skillExperience -= skillExperienceThreshold;
        skillExperienceLevel += 1;
        pendingSkillChoices += 1;
        skillExperienceThreshold += 30;
    }
    updateHud();
    if (pendingSkillChoices > 0 && skillUpgradeOverlay.hidden)
        showSkillUpgrade();
}
function smallUpgradeRequirement(tier) {
    return tier === 1 ? 3 : tier === 2 ? 4 : 0;
}
function describeSmallSkillUpgrade(skill, progress) {
    const stage = progress.minorUpgrades % 3;
    if (stage === 0 && skill.damage > 0)
        return "伤害小幅提升";
    if (stage === 1 && skill.radius !== undefined)
        return "作用范围 +12";
    if (stage === 2 && skill.effect_turns > 0)
        return "效果持续时间 +0.5 秒";
    if (skill.dash_range !== undefined && stage !== 2)
        return "技能距离 +15";
    if (skill.shield !== undefined)
        return "护盾值 +5";
    return "技能冷却 -0.4 秒";
}
function describeSkillTierEffect(skill, tier) {
    const effects = {
        "volt-ult": ["范围眩晕半径 +40", "眩晕时间 +1 秒"],
        "volt-chain": ["强化普攻额外伤害 +12", "强化普攻可波及周围敌人"],
        "volt-overdrive": ["冲刺距离 +45", "冲刺伤害提高 30%"],
        "moss-ult": ["荆棘花园半径 +40", "禁锢时间 +1 秒，回复生命 +15"],
        "moss-vine": ["荆棘壁垒持续时间 +2 秒", "减伤提升，荆棘反伤提高至 20"],
        "moss-bark": ["中毒每秒伤害 +4", "中毒持续时间 +2 秒"],
        "luna-ult": ["陨星爆炸半径 +40", "眩晕时间 +1 秒"],
        "luna-orbit": ["月刃伤害 +10", "月刃飞行距离 +120"],
        "luna-phase": ["获得护盾 +25", "护盾持续时间 +2 秒"],
        "tech-ult": ["范围眩晕半径 +40", "眩晕时间 +1 秒"],
        "tech-tablets": ["平板合击爆炸半径 +35", "减速持续时间 +2 秒"],
        "tech-afterimage": ["残影冲刺伤害提高 30%", "额外增加一次往返冲刺"],
    };
    return effects[skill.id]?.[tier - 2] || "解锁新的技能效果";
}
function applySmallSkillUpgrade(skill, progress) {
    const stage = progress.minorUpgrades % 3;
    if (stage === 0 && skill.damage > 0) {
        const bonus = Math.max(2, Math.round(skill.damage * 0.08));
        skill.damage += bonus;
        return `伤害 +${bonus}`;
    }
    if (stage === 1 && skill.radius !== undefined) {
        skill.radius += 12;
        return "作用范围 +12";
    }
    if (stage === 2 && skill.effect_turns > 0) {
        skill.effect_turns += 0.5;
        return "效果持续时间 +0.5 秒";
    }
    if (skill.dash_range !== undefined && stage !== 2) {
        skill.dash_range += 15;
        return "技能距离 +15";
    }
    if (skill.shield !== undefined) {
        skill.shield += 5;
        return "护盾值 +5";
    }
    skill.cooldown = Math.max(2, skill.cooldown - 0.4);
    return "技能冷却 -0.4 秒";
}
function applySkillTierEffect(skill, tier) {
    switch (skill.id) {
        case "volt-ult":
        case "tech-ult":
            if (tier === 2) {
                skill.radius = (skill.radius || 0) + 40;
                return "范围眩晕半径 +40";
            }
            skill.effect_turns += 0.5;
            return "眩晕时间 +1 秒";
        case "volt-chain":
            if (tier === 2) {
                skill.empowered_damage = (skill.empowered_damage || 34) + 12;
                return "强化普攻额外伤害 +12";
            }
            skill.empowered_splash_radius = 90;
            return "强化普攻可波及周围敌人";
        case "volt-overdrive":
            if (tier === 2) {
                skill.dash_range = (skill.dash_range || 0) + 45;
                return "冲刺距离 +45";
            }
            skill.damage = Math.round(skill.damage * 1.3);
            return "冲刺伤害提高 30%";
        case "moss-ult":
            if (tier === 2) {
                skill.radius = (skill.radius || 0) + 40;
                return "荆棘花园半径 +40";
            }
            skill.effect_turns += 0.5;
            skill.heal_bonus = (skill.heal_bonus || 0) + 15;
            return "禁锢时间 +1 秒，回复生命 +15";
        case "moss-vine":
            if (tier === 2) {
                skill.effect_turns += 2;
                return "荆棘壁垒持续时间 +2 秒";
            }
            playerState.thornDamageMultiplier = 0.3;
            playerState.thornReturnDamage = 20;
            return "减伤提升，荆棘反伤提高至 20";
        case "moss-bark":
            if (tier === 2) {
                skill.poison_damage_bonus = (skill.poison_damage_bonus || 0) + 4;
                return "中毒每秒伤害 +4";
            }
            skill.effect_turns += 2;
            return "中毒持续时间 +2 秒";
        case "luna-ult":
            if (tier === 2) {
                skill.radius = (skill.radius || 0) + 40;
                return "陨星爆炸半径 +40";
            }
            skill.effect_turns += 0.5;
            return "眩晕时间 +1 秒";
        case "luna-orbit":
            if (tier === 2) {
                skill.damage += 10;
                return "月刃伤害 +10";
            }
            skill.dash_range = (skill.dash_range || 0) + 120;
            return "月刃飞行距离 +120";
        case "luna-phase":
            if (tier === 2) {
                skill.shield = (skill.shield || 30) + 25;
                return "获得护盾 +25";
            }
            skill.effect_turns += 2;
            return "护盾持续时间 +2 秒";
        case "tech-tablets":
            if (tier === 2) {
                skill.radius = (skill.radius || 0) + 35;
                return "平板合击爆炸半径 +35";
            }
            skill.effect_turns += 1;
            return "减速持续时间 +2 秒";
        case "tech-afterimage":
            if (tier === 2) {
                skill.damage = Math.round(skill.damage * 1.3);
                return "残影冲刺伤害提高 30%";
            }
            skill.extra_round_trips = (skill.extra_round_trips || 0) + 1;
            return "额外增加一次往返冲刺";
        default:
            return "技能效果强化";
    }
}
function showSkillUpgrade() {
    keys.clear();
    touchKeys.clear();
    skillUpgradeTitle.textContent = `选择技能强化 · 第 ${skillExperienceLevel} 级`;
    skillUpgradeSubtitle.textContent = `击败敌人获得技能经验，当前还有 ${pendingSkillChoices} 次强化待选择。`;
    skillUpgradeChoices.replaceChildren();
    config.skills.forEach((skill) => {
        const progress = skillProgress.get(skill.id);
        if (!progress)
            return;
        const requirement = smallUpgradeRequirement(progress.tier);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-choice skill-upgrade-choice";
        const title = document.createElement("b");
        title.textContent = `${skill.name} · ${progress.tier} 阶`;
        const description = document.createElement("span");
        description.textContent = requirement
            ? progress.minorUpgrades + 1 >= requirement
                ? `小强化：${describeSmallSkillUpgrade(skill, progress)}。本次升阶将解锁：${describeSkillTierEffect(skill, (progress.tier + 1))}。`
                : `小强化：${describeSmallSkillUpgrade(skill, progress)}（${progress.minorUpgrades + 1}/${requirement}），逐步解锁新的技能效果。`
            : "技能已达 3 阶；本次继续获得一项小强化。";
        button.append(title, description);
        button.addEventListener("click", () => {
            const improvement = applySmallSkillUpgrade(skill, progress);
            let message = `${skill.name}：${improvement}`;
            if (requirement > 0) {
                progress.minorUpgrades += 1;
                if (progress.minorUpgrades >= requirement) {
                    const newTier = progress.tier === 1 ? 2 : 3;
                    progress.tier = newTier;
                    progress.minorUpgrades = 0;
                    const tierEffect = applySkillTierEffect(skill, newTier);
                    message += `；升至 ${progress.tier} 阶，解锁：${tierEffect}`;
                }
            }
            pendingSkillChoices = Math.max(0, pendingSkillChoices - 1);
            updateHud();
            if (pendingSkillChoices > 0) {
                showSkillUpgrade();
            }
            else {
                skillUpgradeOverlay.hidden = true;
                showToast(`技能强化完成：${message}`);
            }
        });
        skillUpgradeChoices.append(button);
    });
    skillUpgradeOverlay.hidden = false;
}
window.addEventListener("resize", resize);
resize();
function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
}
function drawMap() {
    context.fillStyle = "#111827";
    context.fillRect(0, 0, map.width, map.height);
    context.strokeStyle = "#20303a";
    context.lineWidth = 1;
    for (let x = 0; x <= map.width; x += 64) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, map.height);
        context.stroke();
    }
    for (let y = 0; y <= map.height; y += 64) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(map.width, y);
        context.stroke();
    }
    if (!config.duel)
        roads.forEach((road) => {
            context.fillStyle = "#1a2530";
            context.fillRect(road.x, road.y, road.w, road.h);
            context.strokeStyle = "#34434b";
            context.setLineDash([18, 20]);
            context.lineWidth = 2;
            context.beginPath();
            if (road.w > road.h) {
                context.moveTo(road.x, road.y + road.h / 2);
                context.lineTo(road.x + road.w, road.y + road.h / 2);
            }
            else {
                context.moveTo(road.x + road.w / 2, road.y);
                context.lineTo(road.x + road.w / 2, road.y + road.h);
            }
            context.stroke();
            context.setLineDash([]);
        });
    if (config.duel) {
        context.save();
        context.strokeStyle = "#49e6e055";
        context.lineWidth = 5;
        context.beginPath();
        context.ellipse(map.width / 2, map.height / 2, 420, 280, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "#ff4fa344";
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(map.width / 2, map.height / 2, 340, 220, 0, 0, Math.PI * 2);
        context.stroke();
        context.restore();
    }
    if (!config.duel)
        obstacles.forEach((obstacle, index) => {
            if (obstacle.type === "barrier") {
                roundedRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 7);
                context.fillStyle = "#bf526d";
                context.fill();
                context.strokeStyle = "#ff8b9d";
                context.lineWidth = 3;
                context.stroke();
                context.fillStyle = "#ffd3a2";
                for (let i = 8; i < obstacle.w; i += 28) {
                    context.fillRect(obstacle.x + i, obstacle.y + 5, 8, Math.max(4, obstacle.h - 10));
                }
                return;
            }
            roundedRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 12);
            context.fillStyle = "#252d3c";
            context.fill();
            context.strokeStyle = "#465365";
            context.lineWidth = 4;
            context.stroke();
            context.fillStyle = "#313c4d";
            context.fillRect(obstacle.x + 12, obstacle.y + 12, obstacle.w - 24, 28);
            context.fillStyle = "#738091";
            context.font = "13px sans-serif";
            context.fillText(obstacle.name, obstacle.x + 22, obstacle.y + 31);
            context.strokeStyle = index % 2 ? "#31585a" : "#4c3e65";
            context.lineWidth = 2;
            for (let x = obstacle.x + 25; x < obstacle.x + obstacle.w - 20; x += 54) {
                context.beginPath();
                context.moveTo(x, obstacle.y + 58);
                context.lineTo(x, obstacle.y + obstacle.h - 20);
                context.stroke();
            }
            for (let y = obstacle.y + 72; y < obstacle.y + obstacle.h - 16; y += 58) {
                context.beginPath();
                context.moveTo(obstacle.x + 20, y);
                context.lineTo(obstacle.x + obstacle.w - 20, y);
                context.stroke();
            }
            context.fillStyle = "#121923";
            context.fillRect(obstacle.x + obstacle.w / 2 - 18, obstacle.y + obstacle.h - 20, 36, 20);
        });
    supplies.forEach((supply) => {
        if (!supply.collected)
            drawSupply(supply);
    });
    enemies.forEach(drawEnemy);
    drawFloatingTexts();
    context.strokeStyle = "#49e6e0";
    context.lineWidth = 8;
    context.strokeRect(4, 4, map.width - 8, map.height - 8);
}
function drawSupply(supply) {
    const color = supply.type === "health" ? "#ff668d" : "#49e6e0";
    context.save();
    context.translate(supply.x, supply.y);
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = "#101722";
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = color;
    context.font = "bold 19px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(supply.type === "health" ? "+" : "⚡", 0, 1);
    context.restore();
}
function drawEnemy(enemy) {
    if (enemy.hp <= 0)
        return;
    if (enemy.duelBot) {
        const color = colors[enemy.accent || "pink"] || colors.pink;
        context.save();
        context.translate(enemy.x, enemy.y);
        context.shadowColor = color.main;
        context.shadowBlur = 20;
        context.fillStyle = "#050914";
        context.strokeStyle = color.main;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, 25, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = color.light;
        context.font = "bold 21px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(enemy.initial || "AI", 0, 1);
        context.fillStyle = "#f1f5f9";
        context.font = "12px sans-serif";
        context.fillText(enemy.name || "AI", 0, -45);
        context.fillStyle = "#10131e";
        context.fillRect(-30, -36, 60, 5);
        context.fillStyle = color.main;
        context.fillRect(-30, -36, 60 * Math.max(0, enemy.hp / enemy.maxHp), 5);
        if (Object.keys(enemy.effects).some((effect) => enemy.effects[effect] > 0)) {
            context.strokeStyle = "#ffe45c";
            context.beginPath();
            context.arc(0, 0, 32, 0, Math.PI * 2);
            context.stroke();
        }
        context.restore();
        return;
    }
    const size = enemy.kind === "brute" ? 25 : enemy.kind === "runner" ? 14 : 18;
    const color = enemy.kind === "brute" ? "#d17bff" : enemy.kind === "runner" ? "#ffac53" : "#ff637c";
    context.save();
    context.translate(enemy.x, enemy.y);
    context.fillStyle = "#0009";
    context.beginPath();
    context.ellipse(2, size * 0.8, size + 2, size * 0.44, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = enemy.kind === "brute" ? "#583b6c" : enemy.kind === "runner" ? "#784423" : "#742b42";
    context.beginPath();
    context.arc(0, 0, size, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.font = `bold ${Math.max(11, size * 0.8)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(enemy.kind === "brute" ? "重" : enemy.kind === "runner" ? "快" : "!", 0, 1);
    context.fillStyle = "#10131e";
    context.fillRect(-size, -size - 9, size * 2, 4);
    context.fillStyle = color;
    context.fillRect(-size, -size - 9, size * 2 * enemy.hp / enemy.maxHp, 4);
    if (enemy.poisonDamage > 0) {
        context.strokeStyle = "#9cff65";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, 0, size + 4, 0, Math.PI * 2);
        context.stroke();
    }
    context.restore();
}
function drawFloatingTexts() {
    floatingTexts.forEach((item) => {
        context.globalAlpha = Math.max(0, item.life / 0.8);
        context.fillStyle = item.color;
        context.font = "bold 16px sans-serif";
        context.textAlign = "center";
        context.fillText(item.text, item.x, item.y);
    });
    context.globalAlpha = 1;
}
function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 0.8 });
}
function spawnImpact(x, y, color) {
    skillVisuals.push({
        type: "impact", x, y, targetX: x, targetY: y, age: 0, duration: 0.38, color,
    });
    for (let index = 0; index < 9; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 145;
        const life = 0.28 + Math.random() * 0.3;
        impactParticles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 4,
            color: index % 3 === 0 ? "#ffffff" : color,
            life,
            maxLife: life,
        });
    }
}
function addSkillVisual(skill, target) {
    if (skill.target === "self") {
        skillVisuals.push({
            type: "aura",
            x: player.x,
            y: player.y,
            targetX: player.x,
            targetY: player.y,
            age: 0,
            duration: 0.85,
            color: heroColors.main,
        });
        return;
    }
    if (!target)
        return;
    const isLightning = skill.name.includes("雷");
    const isMeteor = skill.action === "luna_moonfall";
    skillVisuals.push({
        type: isLightning ? "lightning" : isMeteor ? "meteor" : "beam",
        x: player.x,
        y: player.y,
        targetX: target.x,
        targetY: target.y,
        age: 0,
        duration: isLightning || isMeteor ? 0.72 : 0.38,
        color: isLightning ? "#ffe45c" : isMeteor ? "#bda5ff" : heroColors.main,
    });
}
function drawSkillVisuals() {
    skillVisuals.forEach((visual) => {
        const progress = Math.min(1, visual.age / visual.duration);
        const alpha = 1 - progress;
        context.save();
        context.globalAlpha = alpha;
        context.lineCap = "round";
        if (visual.type === "impact") {
            context.shadowColor = visual.color;
            context.shadowBlur = 16;
            context.strokeStyle = visual.color;
            context.lineWidth = 5 * (1 - progress);
            context.beginPath();
            context.arc(visual.x, visual.y, 9 + progress * ((visual.radius || 40) - 9), 0, Math.PI * 2);
            context.stroke();
            context.fillStyle = "#ffffff";
            context.globalAlpha = alpha * 0.75;
            context.beginPath();
            context.arc(visual.x, visual.y, Math.max(2, 8 * (1 - progress)), 0, Math.PI * 2);
            context.fill();
        }
        else if (visual.type === "lightning") {
            const strikeX = visual.targetX;
            const startY = Math.max(0, visual.targetY - 300);
            context.shadowColor = visual.color;
            context.shadowBlur = 24;
            context.strokeStyle = visual.color;
            context.lineWidth = 10;
            context.beginPath();
            context.moveTo(strikeX, startY);
            context.lineTo(strikeX, visual.targetY);
            context.stroke();
            context.shadowBlur = 0;
            context.strokeStyle = "#fffbe0";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(strikeX, startY);
            context.lineTo(strikeX, visual.targetY);
            context.stroke();
            context.strokeStyle = visual.color;
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(strikeX, startY + 24);
            context.lineTo(strikeX - 12, startY + 60);
            context.lineTo(strikeX + 10, startY + 92);
            context.lineTo(strikeX - 8, startY + 130);
            context.stroke();
        }
        else if (visual.type === "meteor") {
            const startX = visual.targetX + 170 * (1 - progress);
            const startY = visual.targetY - 240 * (1 - progress);
            context.shadowColor = visual.color;
            context.shadowBlur = 26;
            context.strokeStyle = visual.color;
            context.lineWidth = 12;
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(visual.targetX, visual.targetY);
            context.stroke();
            context.fillStyle = "#f4eaff";
            context.beginPath();
            context.arc(visual.targetX, visual.targetY, 18 + progress * 50, 0, Math.PI * 2);
            context.fill();
        }
        else if (visual.type === "beam") {
            context.shadowColor = visual.color;
            context.shadowBlur = 18;
            context.strokeStyle = visual.color;
            context.lineWidth = 12 * (1 - progress * 0.45);
            context.beginPath();
            context.moveTo(visual.x, visual.y);
            context.lineTo(visual.targetX, visual.targetY);
            context.stroke();
            context.shadowBlur = 0;
            context.strokeStyle = "#ffffff";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(visual.x, visual.y);
            context.lineTo(visual.targetX, visual.targetY);
            context.stroke();
        }
        if (visual.type !== "aura" && visual.type !== "impact") {
            const radius = visual.type === "lightning" ? 20 + progress * 46 : 12 + progress * 36;
            context.strokeStyle = visual.color;
            context.lineWidth = Math.max(1, 5 * (1 - progress));
            context.beginPath();
            context.arc(visual.targetX, visual.targetY, radius, 0, Math.PI * 2);
            context.stroke();
        }
        else {
            const radius = 24 + progress * 42;
            context.shadowColor = visual.color;
            context.shadowBlur = 20;
            context.strokeStyle = visual.color;
            context.lineWidth = 5 * (1 - progress * 0.55);
            context.beginPath();
            context.arc(visual.x, visual.y, radius, 0, Math.PI * 2);
            context.stroke();
            context.fillStyle = visual.color;
            context.globalAlpha = alpha * 0.16;
            context.beginPath();
            context.arc(visual.x, visual.y, radius, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    });
}
function collides(x, y) {
    if (x - player.radius < 0 ||
        y - player.radius < 0 ||
        x + player.radius > map.width ||
        y + player.radius > map.height) {
        return true;
    }
    if (config.duel)
        return false;
    return obstacles.some((item) => {
        const nearestX = Math.max(item.x, Math.min(x, item.x + item.w));
        const nearestY = Math.max(item.y, Math.min(y, item.y + item.h));
        return (x - nearestX) ** 2 + (y - nearestY) ** 2 < player.radius ** 2;
    });
}
function movePlayer(dx, dy) {
    if (playerMovementLocked())
        return;
    if (!collides(player.x + dx, player.y))
        player.x += dx;
    if (!collides(player.x, player.y + dy))
        player.y += dy;
}
function movePlayerToward(targetX, targetY, distance) {
    if (playerMovementLocked())
        return 0;
    const startX = player.x;
    const startY = player.y;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;
    const length = Math.hypot(deltaX, deltaY);
    if (!length)
        return 0;
    const travel = Math.min(distance, length);
    const steps = Math.max(1, Math.ceil(travel / 8));
    for (let step = 1; step <= steps; step += 1) {
        const ratio = travel * step / steps / length;
        const nextX = startX + deltaX * ratio;
        const nextY = startY + deltaY * ratio;
        if (collides(nextX, nextY))
            break;
        player.x = nextX;
        player.y = nextY;
    }
    return Math.hypot(player.x - startX, player.y - startY);
}
function addEnemyLoot(enemy) {
    if (enemy.experienceAwarded)
        return;
    enemy.experienceAwarded = true;
    supplies.push({ x: enemy.x, y: enemy.y, type: "energy", collected: false });
    const experience = enemy.kind === "brute" ? 30 : enemy.kind === "runner" ? 18 : 10;
    grantSkillExperience(experience, enemy.x, enemy.y);
}
function hitEnemy(enemy, damage, effect = "", effectTurns = 0) {
    if (enemy.hp <= 0)
        return;
    damage = Math.max(1, Math.round(damage * playerState.damageMultiplier * (1 - (enemy.defenseReduction || 0))));
    const actualDamage = Math.min(enemy.hp, damage);
    enemy.hp = Math.max(0, enemy.hp - actualDamage);
    healFromDamage(actualDamage, enemy.x, enemy.y);
    if (effect && effectTurns > 0) {
        enemy.effects[effect] = Math.max(enemy.effects[effect] || 0, effectTurns);
        if (effect === "中毒") {
            const poisonSkill = config.skills.find((item) => item.action === "moss_spore");
            enemy.poisonDamage = Math.max(enemy.poisonDamage, 4 + wave + (poisonSkill?.poison_damage_bonus || 0));
            enemy.poisonTimer = 1;
        }
    }
    addFloatingText(enemy.x, enemy.y - 28, `-${actualDamage}`, "#ff668d");
    if (enemy.hp <= 0) {
        if (enemy.duelBot)
            finishDuelRound(true);
        else
            addEnemyLoot(enemy);
    }
    spawnImpact(enemy.x, enemy.y, heroColors.main);
}
function healFromDamage(damage, x, y) {
    if (damage <= 0 || playerState.lifesteal <= 0)
        return;
    const restored = Math.min(playerState.maxHp - playerState.hp, Math.floor(damage * playerState.lifesteal));
    if (restored <= 0)
        return;
    playerState.hp += restored;
    addFloatingText(x, y - 46, `+${restored} 吸血`, "#9cff65");
    updateHud();
}
function applyPlayerDamage(damage, attacker) {
    if (afterimageDash) {
        addFloatingText(player.x, player.y - 34, "无敌闪避", "#49e6e0");
        return;
    }
    if (Math.random() < playerState.dodgeChance) {
        addFloatingText(player.x, player.y - 34, "闪避", "#8c9aff");
        return;
    }
    const thornArmor = (statusEffects["荆棘护甲"] || 0) > 0;
    const thornMultiplier = thornArmor ? playerState.thornDamageMultiplier : 1;
    const reducedDamage = Math.max(1, Math.round(damage * (1 - playerState.damageReduction) * thornMultiplier));
    const absorbed = Math.min(playerState.shield, reducedDamage);
    playerState.shield -= absorbed;
    const healthDamage = reducedDamage - absorbed;
    playerState.hp = Math.max(0, playerState.hp - healthDamage);
    if (absorbed > 0)
        addFloatingText(player.x, player.y - 28, `-${absorbed} 护盾`, "#ffffff");
    if (healthDamage > 0)
        addFloatingText(player.x, player.y - 28, `-${healthDamage}`, "#ff668d");
    if (thornArmor) {
        hitEnemy(attacker, playerState.thornReturnDamage);
        addFloatingText(attacker.x, attacker.y - 38, `荆棘反伤 ${playerState.thornReturnDamage}`, "#b7ef55");
    }
    if (playerState.hp <= 0) {
        playerState.hp = 0;
        finishRun();
    }
    else {
        showToast(`防御减伤 ${Math.round(playerState.damageReduction * 100)}%：受到 ${healthDamage} 点生命伤害${absorbed > 0 ? `，护盾吸收 ${absorbed}` : ""}。`, "warning");
    }
    updateHud();
}
function updateDuelBot(bot, dt) {
    if (!duelRoundActive || bot.hp <= 0)
        return;
    const distance = distanceTo(bot.x, bot.y);
    const rangeByAccent = { tech: 330, blue: 300, green: 150, pink: 95 };
    const attackRange = rangeByAccent[bot.accent || "pink"] || 95;
    const preferredDistance = attackRange > 150 ? attackRange * 0.7 : attackRange * 0.72;
    if (!bot.effects["眩晕"] && !bot.effects["禁锢"] && distance > 0) {
        let direction = 0;
        if (distance > preferredDistance + 24)
            direction = 1;
        else if (attackRange > 150 && distance < preferredDistance - 35)
            direction = -0.55;
        if (direction !== 0) {
            const speed = bot.speed * (bot.effects["减速"] ? 0.5 : 1) * dt * direction;
            bot.x = Math.max(38, Math.min(map.width - 38, bot.x + (player.x - bot.x) / distance * speed));
            bot.y = Math.max(38, Math.min(map.height - 38, bot.y + (player.y - bot.y) / distance * speed));
        }
    }
    bot.attackTimer = Math.max(0, bot.attackTimer - dt);
    if (distance <= attackRange && bot.attackTimer === 0 && !bot.effects["眩晕"]) {
        bot.attackTimer = 1 / Math.min(2, 1.35 + duelRound * 0.08);
        skillVisuals.push({
            type: "beam", x: bot.x, y: bot.y, targetX: player.x, targetY: player.y,
            age: 0, duration: 0.22, color: (colors[bot.accent || "pink"] || colors.pink).main,
        });
        applyPlayerDamage(bot.attack, bot);
        if (playerState.hp <= 0 || !duelRoundActive)
            return;
    }
    bot.skillTimer = Math.max(0, (bot.skillTimer || 0) - dt);
    if (bot.skillTimer !== 0 || bot.effects["眩晕"])
        return;
    if (distance > Math.max(attackRange * 1.6, 220)) {
        bot.skillTimer = 1;
        return;
    }
    bot.skillTimer = 6 + Math.random() * 2;
    const accent = bot.accent || "pink";
    const effect = accent === "tech" || accent === "pink" ? "眩晕" : accent === "green" ? "禁锢" : "减速";
    const effectDuration = effect === "减速" ? 1.8 : effect === "禁锢" ? 1.2 : 0.8;
    const damage = Math.round(bot.attack * (accent === "green" ? 1.8 : 2.2));
    skillVisuals.push({
        type: "impact", x: player.x, y: player.y, targetX: player.x, targetY: player.y,
        age: 0, duration: 0.45, color: (colors[accent] || colors.pink).main, radius: 85,
    });
    addFloatingText(player.x, player.y - 45, `${bot.name} 技能`, (colors[accent] || colors.pink).main);
    statusEffects[effect] = Math.max(statusEffects[effect] || 0, effectDuration);
    applyPlayerDamage(damage, bot);
}
function knockbackEnemy(enemy, distance) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    knockbackEnemyInDirection(enemy, distance, dx / length, dy / length);
}
function knockbackEnemyInDirection(enemy, distance, directionX, directionY) {
    const startX = enemy.x;
    const startY = enemy.y;
    const steps = Math.max(1, Math.ceil(distance / 8));
    for (let step = 1; step <= steps; step += 1) {
        const ratio = step / steps;
        const nextX = startX + directionX * distance * ratio;
        const nextY = startY + directionY * distance * ratio;
        const blocked = nextX < 17 || nextY < 17 || nextX > map.width - 17 || nextY > map.height - 17 ||
            !config.duel && obstacles.some((item) => {
                const nearestX = Math.max(item.x, Math.min(nextX, item.x + item.w));
                const nearestY = Math.max(item.y, Math.min(nextY, item.y + item.h));
                return (nextX - nearestX) ** 2 + (nextY - nearestY) ** 2 < 17 ** 2;
            });
        if (blocked)
            break;
        enemy.x = nextX;
        enemy.y = nextY;
    }
    skillVisuals.push({
        type: "aura",
        x: enemy.x,
        y: enemy.y,
        targetX: enemy.x,
        targetY: enemy.y,
        age: 0,
        duration: 0.35,
        color: "#ffe45c",
    });
}
function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared)
        return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function dashStrike(skill) {
    const startX = player.x;
    const startY = player.y;
    const distance = movePlayerToward(player.x + facing.x * (skill.dash_range || 230), player.y + facing.y * (skill.dash_range || 230), skill.dash_range || 230);
    const hitEnemies = enemies.filter((enemy) => enemy.hp > 0 && distanceToSegment(enemy.x, enemy.y, startX, startY, player.x, player.y) <= 34);
    hitEnemies.forEach((enemy) => hitEnemy(enemy, skill.damage));
    const pvpVictims = [...remotePlayers.values()].filter((remote) => remote.hp > 0 && distanceToSegment(remote.x, remote.y, startX, startY, player.x, player.y) <= 42);
    queuePvpAttack("skill", pvpVictims, skill.id);
    skillVisuals.push({
        type: "beam",
        x: startX,
        y: startY,
        targetX: player.x,
        targetY: player.y,
        age: 0,
        duration: 0.3,
        color: "#ff4fa3",
    });
    showToast(hitEnemies.length
        ? `${skill.name} 冲刺 ${Math.round(distance)} 距离，命中路径上 ${hitEnemies.length} 个敌人。`
        : `${skill.name} 向前冲刺 ${Math.round(distance)} 距离，路径上没有敌人。`);
}
function distanceTo(x, y) {
    return Math.hypot(player.x - x, player.y - y);
}
function collectSupply() {
    if (skillIsPaused())
        return;
    if (!nearestSupply) {
        showToast("附近没有可收集的物资。", "warning");
        return;
    }
    nearestSupply.collected = true;
    lootCollected += 1;
    if (nearestSupply.type === "health") {
        const restored = Math.min(30, playerState.maxHp - playerState.hp);
        playerState.hp += restored;
        addFloatingText(nearestSupply.x, nearestSupply.y - 18, restored ? `+${restored} HP` : "生命已满", "#ff668d");
        showToast(restored ? `收集成功：恢复 ${restored} 点生命。` : "收集成功：生命值已满。");
    }
    else {
        const restored = Math.min(35, playerState.maxEnergy - playerState.energy);
        playerState.energy += restored;
        addFloatingText(nearestSupply.x, nearestSupply.y - 18, restored ? `+${restored} 能量` : "能量已满", "#49e6e0");
        showToast(restored ? `收集成功：恢复 ${restored} 点能量。` : "收集成功：能量已满。");
    }
    nearestSupply = undefined;
    pickupPrompt.hidden = true;
    updateHud();
}
function nearestEnemy(maxRange) {
    return enemies
        .filter((enemy) => enemy.hp > 0 && distanceTo(enemy.x, enemy.y) <= maxRange)
        .sort((a, b) => distanceTo(a.x, a.y) - distanceTo(b.x, b.y))[0];
}
function remotePlayersInRange(maxRange) {
    return [...remotePlayers.values()].filter((remote) => remote.hp > 0 && Math.hypot(player.x - remote.x, player.y - remote.y) <= maxRange);
}
function queuePvpAttack(kind, targets, skillId, castId) {
    if (!config.multiplayer || playerActionsLocked() || (!targets.length && kind !== "skill"))
        return;
    if (kind === "skill" && skillId) {
        for (let index = pendingPvpAttacks.length - 1; index >= 0; index -= 1) {
            const pending = pendingPvpAttacks[index];
            if (pending.kind !== "skill" || pending.skill_id !== skillId)
                continue;
            const targetIds = new Set(pending.target_ids);
            targets.forEach((target) => targetIds.add(target.player_id));
            pending.target_ids = [...targetIds];
            return;
        }
    }
    queuePvpAction(kind, targets, skillId, castId);
}
function queuePvpAction(kind, targets, skillId, castId) {
    if (!config.multiplayer)
        return;
    const targetIds = [...new Set(targets.map((target) => target.player_id))];
    pendingPvpAttacks.push({
        id: `${config.multiplayer.player_id}-${Date.now()}-${attackSequence++}`,
        kind,
        ...(skillId ? { skill_id: skillId } : {}),
        ...(castId ? { cast_id: castId } : {}),
        target_ids: targetIds,
    });
}
function nearbyPvpTargets(x, y, radius) {
    return [...remotePlayers.values()].filter((remote) => remote.hp > 0 && Math.hypot(remote.x - x, remote.y - y) <= radius);
}
function nearestRemoteAt(x, y, range) {
    return [...remotePlayers.values()]
        .filter((remote) => remote.hp > 0 && Math.hypot(remote.x - x, remote.y - y) <= range)
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
}
function castCrescent(skill, target) {
    const startX = player.x;
    const startY = player.y;
    const dx = target.x - startX;
    const dy = target.y - startY;
    const length = Math.hypot(dx, dy) || 1;
    const range = skill.dash_range || 480;
    const endX = startX + dx / length * range;
    const endY = startY + dy / length * range;
    const victims = enemies.filter((enemy) => enemy.hp > 0 && distanceToSegment(enemy.x, enemy.y, startX, startY, endX, endY) < 42 &&
        (enemy.x - startX) * dx + (enemy.y - startY) * dy > 0);
    skillVisuals.push({
        type: "beam", x: startX, y: startY, targetX: endX, targetY: endY,
        age: 0, duration: 0.48, color: "#bda5ff",
    });
    victims.forEach((enemy) => hitEnemy(enemy, skill.damage, skill.effect, skill.effect_turns * 2));
    const pvpVictims = [...remotePlayers.values()].filter((remote) => remote.hp > 0 && distanceToSegment(remote.x, remote.y, startX, startY, endX, endY) < 42 &&
        (remote.x - startX) * dx + (remote.y - startY) * dy > 0);
    queuePvpAttack("skill", pvpVictims, skill.id);
    showToast(`弦月穿波贯穿前方 ${range} 距离，命中 ${victims.length} 个敌人。`);
}
function startTabletVolley(skill) {
    const directionX = facing.x || 1;
    const directionY = facing.y;
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    const distance = skill.dash_range || 200;
    const targetX = Math.max(30, Math.min(map.width - 30, player.x + directionX * distance));
    const targetY = Math.max(30, Math.min(map.height - 30, player.y + directionY * distance));
    tabletProjectiles.length = 0;
    for (let lane = -2; lane <= 2; lane += 1) {
        tabletProjectiles.push({
            startX: player.x,
            startY: player.y,
            targetX,
            targetY,
            lane,
            directionX,
            directionY,
            age: 0,
            duration: 0.75,
            hitEnemies: new Set(),
        });
    }
    tabletVolley = {
        x: targetX,
        y: targetY,
        radius: skill.radius || 100,
        damage: skill.damage,
        effect: skill.effect,
        effectTurns: skill.effect_turns * 2,
        targetIds: new Set(),
    };
    addFloatingText(player.x, player.y - 40, "五屏启动", "#49e6e0");
    showToast(`五台平板出击：击退沿途敌人，并在前方 ${distance} 米汇聚爆炸。`);
}
function startAfterimageDash(skill) {
    const distance = skill.dash_range || 180;
    const castId = `${config.multiplayer?.player_id || "local"}-dash-${Date.now()}-${attackSequence++}`;
    afterimage = { x: player.x, y: player.y, age: 0, duration: 3.2 };
    afterimageDash = {
        castId,
        originX: player.x,
        originY: player.y,
        directionX: facing.x || 1,
        directionY: facing.y,
        distance,
        duration: distance / (player.speed * 2.4),
        elapsed: 0,
        phase: "out",
        segmentStartX: player.x,
        segmentStartY: player.y,
        hitEnemies: new Set(),
        hitPlayerIds: new Set(),
        damage: skill.damage,
        completedSegments: 0,
        totalSegments: 6 + (skill.extra_round_trips || 0) * 2,
    };
    if (config.multiplayer)
        queuePvpAction("dash_start", [], skill.id, castId);
    showToast(`残影折返：前后冲刺 ${afterimageDash.totalSegments / 2} 次，路径上的敌人会受到伤害并被击退。`);
}
function advanceTabletVolley(dt) {
    if (!tabletVolley)
        return;
    tabletProjectiles.forEach((tablet) => {
        if (tablet.age >= tablet.duration)
            return;
        const previousProgress = tablet.age / tablet.duration;
        tablet.age = Math.min(tablet.duration, tablet.age + dt);
        const progress = tablet.age / tablet.duration;
        const previousSpread = (1 - previousProgress) * tablet.lane * 38;
        const currentSpread = (1 - progress) * tablet.lane * 38;
        const previousX = tablet.startX + (tablet.targetX - tablet.startX) * previousProgress - previousSpread * tablet.directionY;
        const previousY = tablet.startY + (tablet.targetY - tablet.startY) * previousProgress + previousSpread * tablet.directionX;
        const currentX = tablet.startX + (tablet.targetX - tablet.startX) * progress - currentSpread * tablet.directionY;
        const currentY = tablet.startY + (tablet.targetY - tablet.startY) * progress + currentSpread * tablet.directionX;
        enemies.forEach((enemy) => {
            if (enemy.hp <= 0 || tablet.hitEnemies.has(enemy))
                return;
            if (distanceToSegment(enemy.x, enemy.y, previousX, previousY, currentX, currentY) > 28)
                return;
            tablet.hitEnemies.add(enemy);
            hitEnemy(enemy, tabletVolley.damage * 0.35, tabletVolley.effect, tabletVolley.effectTurns);
            knockbackEnemyInDirection(enemy, 54, tablet.directionX, tablet.directionY);
            addFloatingText(enemy.x, enemy.y - 40, "击退", "#49e6e0");
        });
        remotePlayers.forEach((remote) => {
            if (remote.hp <= 0 || tabletVolley.targetIds.has(remote.player_id))
                return;
            if (distanceToSegment(remote.x, remote.y, previousX, previousY, currentX, currentY) > 28)
                return;
            tabletVolley.targetIds.add(remote.player_id);
        });
    });
    if (!tabletProjectiles.every((tablet) => tablet.age >= tablet.duration))
        return;
    const volley = tabletVolley;
    const victims = enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - volley.x, enemy.y - volley.y) <= volley.radius);
    nearbyPvpTargets(volley.x, volley.y, volley.radius).forEach((remote) => volley.targetIds.add(remote.player_id));
    queuePvpAttack("skill", [...volley.targetIds].map((id) => remotePlayers.get(id)).filter((remote) => !!remote), config.skills.find((skill) => skill.action === "tech_tablets")?.id);
    victims.forEach((enemy) => hitEnemy(enemy, volley.damage, volley.effect, volley.effectTurns));
    skillVisuals.push({
        type: "impact", x: volley.x, y: volley.y, targetX: volley.x, targetY: volley.y,
        age: 0, duration: 0.65, color: "#438dff", radius: volley.radius,
    });
    for (let index = 0; index < 28; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 220;
        const life = 0.4 + Math.random() * 0.5;
        impactParticles.push({
            x: volley.x, y: volley.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 5, color: index % 4 === 0 ? "#ffffff" : "#438dff",
            life, maxLife: life,
        });
    }
    showToast(`五屏汇聚爆炸：范围内命中 ${victims.length} 个敌人并施加减速。`);
    tabletProjectiles.length = 0;
    tabletVolley = undefined;
}
function advanceAfterimageDash(dt) {
    if (!afterimageDash)
        return;
    const dash = afterimageDash;
    dash.elapsed += dt;
    const destinationX = dash.phase === "out"
        ? dash.originX + dash.directionX * dash.distance
        : dash.originX;
    const destinationY = dash.phase === "out"
        ? dash.originY + dash.directionY * dash.distance
        : dash.originY;
    const previousX = player.x;
    const previousY = player.y;
    movePlayerToward(destinationX, destinationY, player.speed * 2.4 * dt);
    const travelX = player.x - previousX;
    const travelY = player.y - previousY;
    const travelLength = Math.hypot(travelX, travelY);
    if (travelLength > 0) {
        skillVisuals.push({
            type: "beam",
            x: previousX,
            y: previousY,
            targetX: player.x,
            targetY: player.y,
            age: 0,
            duration: 0.2,
            color: "#438dff",
        });
        enemies.forEach((enemy) => {
            if (enemy.hp <= 0 || dash.hitEnemies.has(enemy))
                return;
            const enemyRadius = enemy.kind === "brute" ? 25 : enemy.kind === "runner" ? 14 : 18;
            if (distanceToSegment(enemy.x, enemy.y, previousX, previousY, player.x, player.y) > player.radius + enemyRadius + 5)
                return;
            dash.hitEnemies.add(enemy);
            hitEnemy(enemy, dash.damage);
            knockbackEnemyInDirection(enemy, 72, travelX / travelLength, travelY / travelLength);
            addFloatingText(enemy.x, enemy.y - 40, "残影击退", "#49e6e0");
        });
        remotePlayers.forEach((remote) => {
            if (remote.hp <= 0 || dash.hitPlayerIds.has(remote.player_id))
                return;
            if (distanceToSegment(remote.x, remote.y, previousX, previousY, player.x, player.y) > player.radius + 18 + 5)
                return;
            dash.hitPlayerIds.add(remote.player_id);
        });
    }
    const reachedDestination = Math.hypot(player.x - destinationX, player.y - destinationY) < 12;
    if (dash.elapsed < dash.duration && !reachedDestination)
        return;
    dash.completedSegments += 1;
    if (dash.completedSegments >= dash.totalSegments) {
        queuePvpAction("dash_hit", [...dash.hitPlayerIds].map((id) => remotePlayers.get(id)).filter((remote) => !!remote), config.skills.find((skill) => skill.action === "tech_afterimage")?.id, dash.castId);
        afterimageDash = undefined;
        showToast(`残影折返结束：完成 ${dash.totalSegments / 2} 次往返冲刺。`);
        return;
    }
    dash.phase = dash.phase === "out" ? "back" : "out";
    dash.elapsed = 0;
    dash.hitEnemies.clear();
}
function castSkill(index) {
    if (skillIsPaused())
        return;
    if (playerActionsLocked()) {
        showControlBlocked("技能施放");
        return;
    }
    if (afterimageDash) {
        showToast("残影折返尚未结束，暂时无法施放其他技能。", "warning");
        return;
    }
    const skill = config.skills[index];
    const button = skillButtons[index];
    if (!skill || !button) {
        showToast("技能配置缺失，请检查英雄技能数据。", "warning");
        return;
    }
    if (hasPlayerEffect("禁锢") && skill.action === "tech_afterimage") {
        showControlBlocked(skill.name);
        return;
    }
    const remaining = skillCooldowns.get(skill.id) || 0;
    if (remaining > 0) {
        showToast(`${skill.name} 冷却中，还需 ${remaining.toFixed(1)} 秒。`, "warning");
        return;
    }
    if (playerState.energy < skill.cost) {
        showToast(`能量不足：${skill.name} 需要 ${skill.cost} 点能量。`, "warning");
        return;
    }
    let target;
    if (skill.target === "enemy") {
        target = nearestEnemy(skill.cast_range || 340);
        if (!target) {
            const remote = remotePlayersInRange(skill.cast_range || 340)
                .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) - Math.hypot(player.x - b.x, player.y - b.y))[0];
            if (remote) {
                target = {
                    x: remote.x,
                    y: remote.y,
                    hp: remote.hp,
                    maxHp: remote.max_hp,
                    attackTimer: 0,
                    attack: 0,
                    speed: 0,
                    kind: "grunt",
                    poisonDamage: 0,
                    poisonTimer: 0,
                    effects: {},
                    experienceAwarded: false,
                };
            }
        }
        if (!target) {
            const alive = enemies.some((enemy) => enemy.hp > 0);
            showToast(alive ? `${skill.name} 施放失败：范围内没有敌人（最大距离 ${skill.cast_range || 340}）。` : "这一波没有存活敌人，等待下一波出现。", "warning");
            return;
        }
    }
    playerState.energy -= skill.cost;
    const cooldown = calculateSkillCooldown(skill);
    skillCooldowns.set(skill.id, cooldown);
    if (skill.action !== "tech_afterimage")
        queuePvpAttack("skill", [], skill.id);
    if (skill.action === "moss_barkskin") {
        statusEffects["荆棘护甲"] = skill.effect_turns;
        addSkillVisual(skill);
        showToast(`树皮壁垒展开：受到伤害降低 ${Math.round((1 - playerState.thornDamageMultiplier) * 100)}%，近战敌人会被荆棘反伤。`);
    }
    else if (skill.action === "tech_tablets") {
        startTabletVolley(skill);
    }
    else if (skill.action === "tech_afterimage") {
        startAfterimageDash(skill);
    }
    else if (skill.action === "tech_overdrive") {
        const radius = skill.radius || 330;
        const victims = enemies.filter((enemy) => enemy.hp > 0 && distanceTo(enemy.x, enemy.y) <= radius);
        const startX = player.x;
        const startY = player.y;
        victims.forEach((enemy) => hitEnemy(enemy, skill.damage, skill.effect, skill.effect_turns * 2));
        const travelled = movePlayerToward(player.x + facing.x * (skill.dash_range || 300), player.y + facing.y * (skill.dash_range || 300), skill.dash_range || 300);
        queuePvpAttack("skill", nearbyPvpTargets(startX, startY, radius), skill.id);
        skillVisuals.push({
            type: "beam", x: startX, y: startY, targetX: player.x, targetY: player.y,
            age: 0, duration: 0.4, color: "#49e6e0",
        });
        showToast(`超频突袭：眩晕周围 ${victims.length} 个敌人，并冲刺 ${Math.round(travelled)} 距离。`);
    }
    else if (skill.action === "luna_phase") {
        const startX = player.x;
        const startY = player.y;
        const distance = movePlayerToward(player.x + facing.x * (skill.dash_range || 190), player.y + facing.y * (skill.dash_range || 190), skill.dash_range || 190);
        const shieldDuration = skill.effect_turns;
        statusEffects["月影护盾"] = shieldDuration;
        playerState.shield = Math.max(playerState.shield, skill.shield || 30);
        skillVisuals.push({
            type: "beam", x: startX, y: startY, targetX: player.x, targetY: player.y,
            age: 0, duration: 0.42, color: "#bda5ff",
        });
        addFloatingText(player.x, player.y - 38, "月影护盾", "#d9caff");
        showToast(`月影相移：闪现 ${Math.round(distance)} 距离，并获得 ${playerState.shield} 点护盾，持续 ${shieldDuration} 秒。`);
    }
    else if (skill.action === "empower_attack") {
        empoweredAttack = true;
        addSkillVisual(skill);
        addFloatingText(player.x, player.y - 38, "重拳已蓄势！", "#ffe45c");
        showToast(`${skill.name} 生效：下次普攻造成额外伤害并击退敌人。`);
    }
    else if (skill.action === "dash_aoe" && target) {
        const startX = player.x;
        const startY = player.y;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const targetDistance = Math.hypot(dx, dy) || 1;
        const stopDistance = Math.min(42, targetDistance);
        const destinationX = target.x - dx / targetDistance * stopDistance;
        const destinationY = target.y - dy / targetDistance * stopDistance;
        const travelled = movePlayerToward(destinationX, destinationY, skill.dash_range || 300);
        const radius = skill.radius || 115;
        const victims = enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) <= radius);
        skillVisuals.push({
            type: "beam",
            x: startX,
            y: startY,
            targetX: player.x,
            targetY: player.y,
            age: 0,
            duration: 0.32,
            color: "#ff4fa3",
        });
        skillVisuals.push({
            type: "aura",
            x: player.x,
            y: player.y,
            targetX: player.x,
            targetY: player.y,
            age: 0,
            duration: 0.65,
            color: "#ffe45c",
        });
        victims.forEach((enemy) => hitEnemy(enemy, skill.damage, skill.effect, skill.effect_turns * 2));
        queuePvpAttack("skill", nearbyPvpTargets(player.x, player.y, radius), skill.id);
        showToast(`${skill.name} 突进 ${Math.round(travelled)} 距离，${radius} 范围内命中 ${victims.length} 个敌人，造成伤害并眩晕。`);
    }
    else if (skill.action === "moss_rootfield" && target) {
        const radius = skill.radius || 185;
        const victims = enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius);
        addSkillVisual(skill, target);
        victims.forEach((enemy) => hitEnemy(enemy, skill.damage, "禁锢", skill.effect_turns * 2));
        queuePvpAttack("skill", nearbyPvpTargets(target.x, target.y, radius), skill.id);
        const heal = Math.min(20 + (skill.heal_bonus || 0), playerState.maxHp - playerState.hp);
        playerState.hp += heal;
        skillVisuals.push({
            type: "aura", x: target.x, y: target.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.9, color: "#b7ef55",
        });
        showToast(`荆棘花园扎根：禁锢 ${victims.length} 个敌人，造成范围伤害并回复 ${heal} 生命。`);
    }
    else if (skill.action === "moss_spore" && target) {
        const radius = skill.radius || 130;
        const victims = enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius);
        addSkillVisual(skill, target);
        victims.forEach((enemy) => hitEnemy(enemy, skill.damage, "中毒", skill.effect_turns));
        queuePvpAttack("skill", nearbyPvpTargets(target.x, target.y, radius), skill.id);
        skillVisuals.push({
            type: "aura", x: target.x, y: target.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.75, color: "#9cff65",
        });
        showToast(`孢子绽放：${victims.length} 个敌人中毒，持续受到伤害。`);
    }
    else if (skill.action === "luna_moonfall" && target) {
        const radius = skill.radius || 150;
        const victims = enemies.filter((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius);
        addSkillVisual(skill, target);
        victims.forEach((enemy) => hitEnemy(enemy, skill.damage, skill.effect, skill.effect_turns * 2));
        queuePvpAttack("skill", nearbyPvpTargets(target.x, target.y, radius), skill.id);
        skillVisuals.push({
            type: "aura", x: target.x, y: target.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.85, color: "#bda5ff",
        });
        showToast(`新月陨星落地：${victims.length} 个敌人受到 ${skill.damage} 点范围伤害。`);
    }
    else if (skill.action === "luna_crescent" && target) {
        castCrescent(skill, target);
    }
    else if (skill.action === "dash_strike") {
        dashStrike(skill);
    }
    else if (skill.target === "self") {
        addSkillVisual(skill);
        const duration = Math.max(3, skill.effect_turns * 3);
        statusEffects[skill.effect] = duration;
        addFloatingText(player.x, player.y - 38, `${effectText(skill.effect)}！`, "#8dffac");
        showToast(`${skill.name} 释放成功：${effectText(skill.effect)} 持续 ${duration} 秒。`);
    }
    else if (target) {
        addSkillVisual(skill, target);
        hitEnemy(target, skill.damage, skill.effect, skill.effect_turns * 2);
        queuePvpAttack("skill", [nearestRemoteAt(target.x, target.y, skill.cast_range || 340)].filter((remote) => !!remote), skill.id);
        showToast(`${skill.name} 命中，造成 ${skill.damage} 点伤害${skill.effect ? `并施加${skill.effect}` : ""}。`);
    }
    updateHud();
    updateSkillButtons();
}
function effectText(effect) {
    const labels = {
        加速: "移动加速",
        攻速加成: "技能急速",
        攻击力加成: "攻击力提升",
        强化普攻: "下次普攻强化并附带击退",
    };
    return labels[effect] || effect;
}
function basicAttack() {
    if (runEnded || skillIsPaused())
        return;
    if (basicAttackTimer > 0)
        return;
    if (playerActionsLocked()) {
        showControlBlocked("普通攻击");
        return;
    }
    const range = config.accent === "tech" ? 330 : config.accent === "blue" ? 300 : config.accent === "green" ? 150 : 95;
    const target = nearestEnemy(range);
    const remoteTarget = nearestRemoteAt(player.x, player.y, range);
    if (remoteTarget && (!target || distanceTo(remoteTarget.x, remoteTarget.y) < distanceTo(target.x, target.y))) {
        basicAttackTimer = getBasicAttackCooldown();
        queuePvpAttack("basic", [remoteTarget]);
        skillVisuals.push({
            type: "beam", x: player.x, y: player.y, targetX: remoteTarget.x, targetY: remoteTarget.y,
            age: 0, duration: 0.24, color: heroColors.main,
        });
        playerState.energy = Math.min(playerState.maxEnergy, playerState.energy + 5);
        showToast(`攻击 ${remoteTarget.name}，服务器将校验距离并同步伤害。`);
        updateHud();
        return;
    }
    if (!target) {
        showToast(`普攻未命中：${config.accent === "tech" ? "将敌人保持在 330" : config.accent === "blue" ? "将敌人保持在 300" : config.accent === "green" ? "将敌人保持在 150" : "靠近敌人至 95"} 距离内再攻击。`, "warning");
        return;
    }
    const wasEmpowered = empoweredAttack;
    const empoweredSkill = config.skills.find((skill) => skill.action === "empower_attack");
    const damage = wasEmpowered
        ? empoweredSkill?.empowered_damage || 34
        : config.accent === "tech" ? 14 : config.accent === "green" ? 12 : config.accent === "blue" ? 15 : 16;
    if (config.accent === "green" && !wasEmpowered) {
        skillVisuals.push({
            type: "beam", x: player.x, y: player.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.25, color: "#b7ef55",
        });
        hitEnemy(target, damage, "禁锢", 0.8);
    }
    else if (config.accent === "tech") {
        skillVisuals.push({
            type: "beam", x: player.x, y: player.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.24, color: "#49e6e0",
        });
        hitEnemy(target, damage);
    }
    else if (config.accent === "blue") {
        skillVisuals.push({
            type: "beam", x: player.x, y: player.y, targetX: target.x, targetY: target.y,
            age: 0, duration: 0.22, color: "#bda5ff",
        });
        hitEnemy(target, damage);
    }
    else {
        hitEnemy(target, damage);
    }
    if (wasEmpowered) {
        empoweredAttack = false;
        const splashRadius = empoweredSkill?.empowered_splash_radius || 0;
        if (splashRadius > 0) {
            enemies.forEach((enemy) => {
                if (enemy !== target && enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= splashRadius) {
                    hitEnemy(enemy, Math.round(damage * 0.5));
                }
            });
        }
        if (target.hp > 0) {
            knockbackEnemy(target, 115);
            addFloatingText(target.x, target.y - 48, "击退！", "#ffe45c");
        }
    }
    playerState.energy = Math.min(playerState.maxEnergy, playerState.energy + 5);
    showToast(wasEmpowered
        ? `强化普攻命中，造成 ${damage} 点伤害并击退敌人！`
        : config.accent === "green"
            ? `荆棘挥击造成 ${damage} 点伤害并短暂缠绕目标。`
            : config.accent === "tech"
                ? `科技男远程普攻命中，造成 ${damage} 点伤害。`
                : config.accent === "blue"
                    ? `月光弹命中，造成 ${damage} 点远程伤害。`
                    : `普攻命中，造成 ${damage} 点伤害，回复 5 点能量。`);
    updateHud();
}
function updateSkillButtons() {
    skillButtons.forEach((button, index) => {
        const skill = config.skills[index];
        if (!skill)
            return;
        const remaining = skillCooldowns.get(skill.id) || 0;
        const label = button.querySelector(".skill-cooldown");
        const cooldownText = remaining > 0 ? `${remaining.toFixed(1)}s` : "";
        if (label && label.textContent !== cooldownText)
            label.textContent = cooldownText;
        if (button.classList.contains("cooling") !== (remaining > 0))
            button.classList.toggle("cooling", remaining > 0);
        const lowEnergy = playerState.energy < skill.cost;
        if (button.classList.contains("low-energy") !== lowEnergy)
            button.classList.toggle("low-energy", lowEnergy);
        const progress = skillProgress.get(skill.id);
        const rankLabel = button.querySelector(".skill-rank");
        if (progress && rankLabel) {
            const required = smallUpgradeRequirement(progress.tier);
            rankLabel.textContent = required
                ? `${progress.tier}阶 · ${progress.minorUpgrades}/${required}`
                : "3阶 MAX";
        }
    });
}
function calculateSkillCooldown(skill) {
    const haste = (statusEffects["加速"] || 0) > 0 || (statusEffects["攻速加成"] || 0) > 0;
    const hasteMultiplier = haste ? 0.7 : 1;
    return Math.max(1, skill.cooldown * (1 - playerState.cooldownReduction) * hasteMultiplier);
}
function updateCombat(dt) {
    if (runEnded || skillIsPaused())
        return;
    if (afterimage) {
        afterimage.age += dt;
        if (afterimage.age >= afterimage.duration)
            afterimage = undefined;
    }
    advanceTabletVolley(dt);
    if (skillIsPaused())
        return;
    if (!playerMovementLocked())
        advanceAfterimageDash(dt);
    if (skillIsPaused())
        return;
    skillVisuals.forEach((visual) => { visual.age += dt; });
    for (let i = skillVisuals.length - 1; i >= 0; i -= 1) {
        if (skillVisuals[i].age >= skillVisuals[i].duration)
            skillVisuals.splice(i, 1);
    }
    skillCooldowns.forEach((remaining, id) => {
        const next = Math.max(0, remaining - dt);
        skillCooldowns.set(id, next);
    });
    basicAttackTimer = Math.max(0, basicAttackTimer - dt);
    Object.keys(statusEffects).forEach((effect) => {
        statusEffects[effect] = Math.max(0, statusEffects[effect] - dt);
        if (statusEffects[effect] <= 0) {
            delete statusEffects[effect];
            if (effect === "月影护盾") {
                playerState.shield = 0;
                updateHud();
            }
        }
    });
    enemies.forEach((enemy) => {
        if (runEnded || skillIsPaused())
            return;
        Object.keys(enemy.effects).forEach((effect) => {
            enemy.effects[effect] = Math.max(0, enemy.effects[effect] - dt);
            if (enemy.effects[effect] <= 0) {
                delete enemy.effects[effect];
                if (effect === "中毒")
                    enemy.poisonDamage = 0;
            }
        });
        if (enemy.hp <= 0)
            return;
        if (enemy.poisonDamage > 0) {
            enemy.poisonTimer -= dt;
            if (enemy.poisonTimer <= 0) {
                enemy.poisonTimer = 1;
                const poisonDamage = Math.min(enemy.hp, enemy.poisonDamage);
                enemy.hp = Math.max(0, enemy.hp - poisonDamage);
                healFromDamage(poisonDamage, enemy.x, enemy.y);
                addFloatingText(enemy.x, enemy.y - 30, `-${poisonDamage} 毒`, "#9cff65");
                if (enemy.hp <= 0) {
                    if (enemy.duelBot)
                        finishDuelRound(true);
                    else
                        addEnemyLoot(enemy);
                }
            }
            if (enemy.hp <= 0)
                return;
        }
        if (enemy.duelBot) {
            updateDuelBot(enemy, dt);
            return;
        }
        const distance = distanceTo(enemy.x, enemy.y);
        if (distance > 60 && distance < 520 && !enemy.effects["禁锢"] && !enemy.effects["眩晕"]) {
            const speed = enemy.effects["减速"] ? enemy.speed * 0.45 : enemy.speed;
            const dx = (player.x - enemy.x) / distance * speed * dt;
            const dy = (player.y - enemy.y) / distance * speed * dt;
            const nextX = enemy.x + dx;
            const nextY = enemy.y + dy;
            const blocked = obstacles.some((obstacle) => nextX > obstacle.x - 17 && nextX < obstacle.x + obstacle.w + 17 &&
                nextY > obstacle.y - 17 && nextY < obstacle.y + obstacle.h + 17);
            if (!blocked) {
                enemy.x = nextX;
                enemy.y = nextY;
            }
        }
        enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
        const attackRange = enemy.kind === "brute" ? 70 : 48;
        if (distance < attackRange && enemy.attackTimer === 0 && !enemy.effects["眩晕"]) {
            enemy.attackTimer = enemy.kind === "runner" ? 1.05 : 1.35;
            applyPlayerDamage(enemy.attack, enemy);
        }
    });
    if (skillIsPaused())
        return;
    floatingTexts.forEach((item) => {
        item.life -= dt;
        item.y -= 24 * dt;
    });
    for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
        if (floatingTexts[i].life <= 0)
            floatingTexts.splice(i, 1);
    }
    impactParticles.forEach((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.max(0, 1 - dt * 2.8);
        particle.vy *= Math.max(0, 1 - dt * 2.8);
    });
    for (let i = impactParticles.length - 1; i >= 0; i -= 1) {
        if (impactParticles[i].life <= 0)
            impactParticles.splice(i, 1);
    }
    const closest = supplies
        .filter((supply) => !supply.collected && distanceTo(supply.x, supply.y) < 58)
        .sort((a, b) => distanceTo(a.x, a.y) - distanceTo(b.x, b.y))[0];
    nearestSupply = closest;
    pickupPrompt.hidden = !closest;
    updateWaveSpawner(dt);
    updateSkillButtons();
    if (config.duel)
        updateDuelHud();
}
function drawPlayer() {
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = "#0009";
    context.beginPath();
    context.ellipse(3, 17, 22, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = heroColors.dark;
    if (afterimageDash) {
        context.shadowColor = "#49e6e0";
        context.shadowBlur = 24;
        context.strokeStyle = "#d4fffb";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
        context.stroke();
        context.shadowBlur = 0;
    }
    context.beginPath();
    context.arc(0, 0, player.radius + 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = heroColors.main;
    context.beginPath();
    context.arc(0, 0, player.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = heroColors.light;
    context.font = "bold 18px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(config.initial, 0, 1);
    context.fillStyle = "#f1f5f9";
    context.font = "12px sans-serif";
    context.fillText(config.name, 0, -34);
    context.restore();
}
function drawRemotePlayers() {
    remotePlayers.forEach((remote) => {
        const remoteColor = colors[remote.accent] || colors.pink;
        context.save();
        context.translate(remote.x, remote.y);
        context.fillStyle = "#0009";
        context.beginPath();
        context.ellipse(2, 14, 20, 9, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = remoteColor.dark;
        context.beginPath();
        context.arc(0, 0, 22, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = remoteColor.main;
        context.beginPath();
        context.arc(0, 0, 18, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = remoteColor.light;
        context.font = "bold 16px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(remote.initial, 0, 1);
        context.fillStyle = "#10131e";
        context.fillRect(-24, 22, 48, 5);
        const healthCapacity = remote.max_hp + remote.shield;
        context.fillStyle = remote.hp > remote.max_hp * 0.4 ? "#49e6e0" : "#ff668d";
        context.fillRect(-24, 22, 48 * Math.max(0, remote.hp) / healthCapacity, 5);
        if (remote.shield > 0) {
            context.fillStyle = "#ffffff";
            context.fillRect(-24 + 48 * remote.hp / healthCapacity, 22, 48 * remote.shield / healthCapacity, 5);
        }
        if (remote.invulnerable) {
            context.shadowColor = "#49e6e0";
            context.shadowBlur = 18;
            context.strokeStyle = "#d4fffb";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(0, 0, 25, 0, Math.PI * 2);
            context.stroke();
            context.shadowBlur = 0;
        }
        context.fillStyle = "#f1f5f9";
        context.font = "12px sans-serif";
        context.fillText(`${remote.name} ${remote.hp}${remote.shield > 0 ? `+${remote.shield}` : ""}/${remote.max_hp}`, 0, -33);
        const crowdControl = remote.effects["眩晕"] ? "眩晕" : remote.effects["禁锢"] ? "禁锢" : "";
        if (crowdControl) {
            context.fillStyle = crowdControl === "眩晕" ? "#ffe45c" : "#b7ef55";
            context.font = "bold 11px sans-serif";
            context.fillText(crowdControl, 0, 39);
        }
        context.restore();
    });
    if (config.multiplayer) {
        peerList.hidden = remotePlayers.size === 0;
        peerList.textContent = remotePlayers.size
            ? `同局玩家 ${remotePlayers.size} 人：${[...remotePlayers.values()].map((item) => item.name).join("、")}`
            : "等待其他玩家同步位置…";
    }
}
async function syncMultiplayer() {
    if (!config.multiplayer || syncPending)
        return;
    syncPending = true;
    const attacksToSend = pendingPvpAttacks.slice();
    try {
        const response = await fetch(`/api/mp/rooms/${encodeURIComponent(config.multiplayer.room_id)}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                player_id: config.multiplayer.player_id,
                x: player.x,
                y: player.y,
                attacks: attacksToSend,
            }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok)
            throw new Error(result.error || "联机同步失败。");
        const updatedPlayers = result.players || [];
        updatedPlayers.forEach((item) => {
            const previous = remotePlayers.get(item.player_id);
            if (previous && item.hp < previous.hp) {
                spawnImpact(item.x, item.y, "#ff668d");
                addFloatingText(item.x, item.y - 48, `-${previous.hp - item.hp}`, "#ff668d");
            }
            remotePlayers.set(item.player_id, item);
        });
        const activePlayerIds = new Set(updatedPlayers.map((item) => item.player_id));
        remotePlayers.forEach((_remote, id) => {
            if (!activePlayerIds.has(id))
                remotePlayers.delete(id);
        });
        const sentAttackIds = new Set(attacksToSend.map((attack) => attack.id));
        for (let index = pendingPvpAttacks.length - 1; index >= 0; index -= 1) {
            if (sentAttackIds.has(pendingPvpAttacks[index].id))
                pendingPvpAttacks.splice(index, 1);
        }
        if (result.self) {
            playerState.hp = result.self.hp;
            playerState.maxHp = result.self.max_hp;
            playerState.energy = result.self.energy;
            playerState.maxEnergy = result.self.max_energy;
            player.x = result.self.x;
            player.y = result.self.y;
            Object.keys(statusEffects).forEach((effect) => {
                if (effect === "眩晕" || effect === "禁锢")
                    delete statusEffects[effect];
            });
            Object.entries(result.self.effects || {}).forEach(([effect, duration]) => {
                statusEffects[effect] = Math.max(statusEffects[effect] || 0, duration);
            });
            if (playerState.hp <= 0 && !runEnded)
                finishRun();
            updateHud();
        }
        if (syncErrorShown) {
            syncErrorShown = false;
            showToast("已恢复与房间的连接。");
        }
    }
    catch (error) {
        if (!syncErrorShown) {
            syncErrorShown = true;
            showToast(error instanceof Error ? error.message : "联机连接中断，请返回大厅重新加入。", "warning");
        }
    }
    finally {
        syncPending = false;
    }
}
function drawMinimap() {
    const sx = minimap.width / map.width;
    const sy = minimap.height / map.height;
    miniContext.fillStyle = "#101722";
    miniContext.fillRect(0, 0, minimap.width, minimap.height);
    miniContext.fillStyle = "#283744";
    roads.forEach((road) => miniContext.fillRect(road.x * sx, road.y * sy, road.w * sx, road.h * sy));
    miniContext.fillStyle = "#7d8797";
    obstacles.forEach((item) => miniContext.fillRect(item.x * sx, item.y * sy, item.w * sx, item.h * sy));
    miniContext.fillStyle = "#ffca62";
    supplies.filter((supply) => !supply.collected).forEach((supply) => {
        miniContext.fillRect(supply.x * sx - 1, supply.y * sy - 1, 3, 3);
    });
    miniContext.fillStyle = "#ff637c";
    enemies.filter((enemy) => enemy.hp > 0).forEach((enemy) => {
        miniContext.fillRect(enemy.x * sx - 1, enemy.y * sy - 1, 3, 3);
    });
    remotePlayers.forEach((remote) => {
        miniContext.fillStyle = (colors[remote.accent] || colors.pink).main;
        miniContext.fillRect(remote.x * sx - 2, remote.y * sy - 2, 5, 5);
    });
    miniContext.fillStyle = heroColors.main;
    miniContext.beginPath();
    miniContext.arc(player.x * sx, player.y * sy, 3.5, 0, Math.PI * 2);
    miniContext.fill();
    miniContext.strokeStyle = "#49e6e0";
    miniContext.lineWidth = 1;
    miniContext.strokeRect(camera.x * sx, camera.y * sy, window.innerWidth * sx, window.innerHeight * sy);
}
let lastFrameTime = 0;
function drawFrame(timestamp) {
    const dt = Math.min((timestamp - (lastFrameTime || timestamp)) / 1000, 0.04);
    lastFrameTime = timestamp;
    updateDuelBreak(dt);
    if (!runEnded && !skillIsPaused()) {
        let dx = 0;
        let dy = 0;
        if (keys.has("ArrowLeft") || keys.has("a") || touchKeys.has("left"))
            dx -= 1;
        if (keys.has("ArrowRight") || keys.has("d") || touchKeys.has("right"))
            dx += 1;
        if (keys.has("ArrowUp") || keys.has("w") || touchKeys.has("up"))
            dy -= 1;
        if (keys.has("ArrowDown") || keys.has("s") || touchKeys.has("down"))
            dy += 1;
        if (dx && dy) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }
        if (!playerMovementLocked() && !afterimageDash && (dx || dy)) {
            facing.x = dx;
            facing.y = dy;
        }
        const movementSpeed = player.speed *
            ((statusEffects["加速"] || 0) > 0 ? 1.45 : 1) *
            ((statusEffects["减速"] || 0) > 0 ? 0.55 : 1);
        if (!playerMovementLocked() && !afterimageDash)
            movePlayer(dx * movementSpeed * dt, dy * movementSpeed * dt);
        playerState.energy = Math.min(playerState.maxEnergy, playerState.energy + dt * playerState.energyRegen);
        updateCombat(dt);
        if (Math.floor(playerState.energy) !== lastHudEnergy)
            updateHud();
    }
    camera.x = Math.max(0, Math.min(map.width - window.innerWidth, player.x - window.innerWidth / 2));
    camera.y = Math.max(0, Math.min(map.height - window.innerHeight, player.y - window.innerHeight / 2));
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context.save();
    context.translate(-camera.x, -camera.y);
    drawMap();
    drawSkillVisuals();
    drawPlayer();
    drawRemotePlayers();
    context.restore();
    drawMinimap();
    if (config.multiplayer && timestamp - lastSync > 250) {
        lastSync = timestamp;
        void syncMultiplayer();
    }
    requestAnimationFrame(drawFrame);
}
function normalizeKey(key) {
    return key.length === 1 ? key.toLowerCase() : key;
}
document.addEventListener("keydown", (event) => {
    if (runEnded)
        return;
    if (event.key === "Escape" || event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
        return;
    }
    if (skillIsPaused()) {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key))
            event.preventDefault();
        keys.clear();
        touchKeys.clear();
        return;
    }
    const key = normalizeKey(event.key);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)) {
        event.preventDefault();
    }
    if (event.repeat)
        return;
    const skillIndex = { q: 0, e: 1, r: 2 };
    if (skillIndex[key] !== undefined) {
        castSkill(skillIndex[key]);
        return;
    }
    if (key === "f") {
        collectSupply();
        return;
    }
    if (key === " ") {
        basicAttack();
        return;
    }
    keys.add(key);
});
document.addEventListener("keyup", (event) => {
    keys.delete(normalizeKey(event.key));
});
window.addEventListener("blur", () => keys.clear());
document.querySelectorAll(".touch-pad button").forEach((button) => {
    const direction = button.dataset.move;
    if (!direction)
        return;
    const release = () => { touchKeys.delete(direction); };
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        touchKeys.add(direction);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});
skillButtons.forEach((button, index) => {
    button.addEventListener("click", () => castSkill(index));
});
pickupPrompt.addEventListener("click", collectSupply);
basicAttackButton.addEventListener("click", basicAttack);
retryRunButton.addEventListener("click", () => {
    if (config.duel)
        window.location.href = "/select?mode=duel";
    else
        window.location.reload();
});
pauseToggle?.addEventListener("click", togglePause);
resumeRunButton?.addEventListener("click", togglePause);
updateHud();
if (config.multiplayer) {
    mapMode.textContent = `局域网房间 ${config.multiplayer.room_id}`;
    peerList.hidden = false;
}
if (config.duel) {
    mapMode.textContent = "人机对抗";
    startDuelRound();
    showToast("人机对抗开始！先赢下 4 分获胜，SPACE 普攻，Q / E / R 释放技能。");
}
else {
    showToast("探索提示：靠近闪光物资后按 F 收集；Q / E / R 释放技能。");
}
drawMap();
requestAnimationFrame(drawFrame);
