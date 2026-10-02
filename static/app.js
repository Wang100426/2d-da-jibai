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
const locale = config.locale;
const english = locale.code === "en";
const tx = (source) => localizeBattleText(source);
function localizeBattleText(value) {
    let text = value;
    if (english) {
        for (const [pattern, replacement] of locale.battle.patterns) {
            text = text.replace(new RegExp(pattern), replacement);
        }
        for (const [phrase, translation] of Object.entries(locale.battle.phrases)) {
            text = text.replaceAll(phrase, translation);
        }
    }
    for (const [source, translation] of Object.entries(locale.battle.messages)) {
        text = text.replaceAll(source, translation);
    }
    return text;
}
const mapTheme = config.mapTheme;
const map = { width: config.duel ? 1400 : 3200, height: config.duel ? 900 : 2400 };
const player = {
    x: config.multiplayer?.x ?? (config.duel ? 430 : mapTheme === "airport" ? 1840 : 1600),
    y: config.multiplayer?.y ?? (config.duel ? 450 : mapTheme === "airport" ? 1300 : 1200),
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
let randomEventTimer = 24 + Math.random() * 10;
let randomEventWarning = 0;
const trafficCars = [];
const harpFields = [];
const gymRushers = [];
const airportPlanes = [];
const pipaMinions = [];
let airportFlightTimer = 20 + Math.random() * 12;
let airportFlightsTarget = 0;
let airportTakeoffsScheduled = 0;
let airportLandingsScheduled = 0;
let airportNextFlightTakeoff = true;
let eventSerial = 0;
let schoolClassTimer = 32 + Math.random() * 12;
let schoolClassDuration = 0;
let pipaFrenzyAttackTimer = 0;
const anesthetizedTargets = new Set();
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
const touchModeToggle = requireElement("#touch-mode-toggle");
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
const mapTransition = document.querySelector("#map-transition");
const mapTransitionStartedAt = performance.now();
let mapTransitionComplete = !mapTransition;
let mapTransitionLeaving = false;
let mapTransitionFallbackTimer = 0;
function finishMapTransition() {
    if (mapTransitionComplete || !mapTransition)
        return;
    window.clearTimeout(mapTransitionFallbackTimer);
    mapTransition.hidden = true;
    mapTransitionComplete = true;
}
mapTransition?.addEventListener("animationend", (event) => {
    if (event.target === mapTransition && event.animationName === "map-transition-out") {
        finishMapTransition();
    }
});
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
    pipa: { main: "#f1b95b", light: "#fff0b8", dark: "#80552a" },
};
const heroColors = colors[config.accent] || colors.pink;
function hasPlayerEffect(effect) {
    return (statusEffects[effect] || 0) > 0;
}
function playerMovementLocked() {
    return hasPlayerEffect("眩晕") || hasPlayerEffect("禁锢") || hasPlayerEffect("狂舞");
}
function playerActionsLocked() {
    return hasPlayerEffect("眩晕") || hasPlayerEffect("狂舞");
}
function pipaFrenzyAttackSpeedMultiplier() {
    const ultimate = config.skills.find((skill) => skill.action === "pipa_kinsnake");
    return 1 + (ultimate?.frenzy_attack_speed_bonus || 0);
}
function updateDuelBotFrenzy(bot, dt) {
    bot.attackTimer = Math.max(0, bot.attackTimer - dt * pipaFrenzyAttackSpeedMultiplier());
    if (bot.attackTimer > 0)
        return;
    bot.attackTimer = 0.65;
    damageEnemyByNpc(bot, bot.attack);
}
function updatePipaMinions(dt) {
    for (let index = pipaMinions.length - 1; index >= 0; index -= 1) {
        const minion = pipaMinions[index];
        if (minion.hp <= 0) {
            pipaMinions.splice(index, 1);
            continue;
        }
        minion.attackTimer = Math.max(0, minion.attackTimer - dt * (schoolClassDuration > 0 ? 0.5 : 1));
        const target = enemies
            .filter((enemy) => enemy.hp > 0)
            .sort((left, right) => Math.hypot(left.x - minion.x, left.y - minion.y) -
            Math.hypot(right.x - minion.x, right.y - minion.y))[0];
        if (!target)
            continue;
        const distance = Math.hypot(target.x - minion.x, target.y - minion.y);
        const combatTarget = {
            id: target.id || `enemy-${enemies.indexOf(target)}`,
            x: target.x,
            y: target.y,
            player: false,
            unit: target,
        };
        if (distance > 42) {
            const classSlow = schoolClassDuration > 0 ? 0.4 : 1;
            moveEnemyToward(minion, combatTarget, minion.speed * classSlow * dt, dt);
        }
        else if (minion.attackTimer === 0) {
            minion.attackTimer = 1.1;
            damageEnemyByNpc(target, minion.attack);
        }
    }
}
function queuePvpSelfAttack() {
    if (!config.multiplayer || !hasPlayerEffect("狂舞"))
        return;
    pendingPvpAttacks.push({
        id: `${config.multiplayer.player_id}-${Date.now()}-${attackSequence++}`,
        kind: "basic",
        target_ids: [config.multiplayer.player_id],
    });
}
function showControlBlocked(action) {
    const reason = hasPlayerEffect("眩晕")
        ? tx("眩晕中无法行动")
        : hasPlayerEffect("狂舞") ? tx("狂舞中无法行动") : tx("禁锢中无法移动");
    showToast(tx(`${action}失败：${reason}。`), "warning");
}
const cityObstacles = [
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
const hospitalObstacles = [
    { x: 220, y: 240, w: 520, h: 290, type: "building", name: "急诊中心" },
    { x: 1040, y: 210, w: 430, h: 350, type: "building", name: "手术中心" },
    { x: 2220, y: 230, w: 720, h: 300, type: "building", name: "住院大楼" },
    { x: 250, y: 900, w: 410, h: 330, type: "building", name: "影像科" },
    { x: 930, y: 900, w: 360, h: 260, type: "building", name: "检验科" },
    { x: 2180, y: 900, w: 720, h: 330, type: "building", name: "康复中心" },
    { x: 260, y: 1700, w: 540, h: 310, type: "building", name: "药剂科" },
    { x: 1120, y: 1740, w: 440, h: 300, type: "building", name: "重症监护室" },
    { x: 2220, y: 1690, w: 680, h: 350, type: "building", name: "研究病区" },
    { x: 740, y: 480, w: 180, h: 150, type: "building", name: "护士站" },
    { x: 1830, y: 480, w: 190, h: 180, type: "building", name: "配药室" },
    { x: 690, y: 1390, w: 190, h: 160, type: "building", name: "隔离病房" },
    { x: 1880, y: 1380, w: 210, h: 170, type: "building", name: "急救室" },
    { x: 820, y: 680, w: 90, h: 34, type: "barrier", name: "隔离带" },
    { x: 1320, y: 760, w: 120, h: 34, type: "barrier", name: "隔离带" },
    { x: 2290, y: 680, w: 90, h: 34, type: "barrier", name: "隔离带" },
    { x: 1050, y: 1450, w: 34, h: 110, type: "barrier", name: "隔离带" },
    { x: 2350, y: 1450, w: 34, h: 110, type: "barrier", name: "隔离带" },
];
const musicObstacles = [
    { x: 260, y: 250, w: 540, h: 300, type: "building", name: "琴工厂" },
    { x: 1090, y: 230, w: 420, h: 350, type: "building", name: "赛博琴行" },
    { x: 2240, y: 260, w: 650, h: 290, type: "building", name: "电子琴研究所" },
    { x: 250, y: 900, w: 430, h: 340, type: "building", name: "合成器工坊" },
    { x: 2170, y: 900, w: 700, h: 340, type: "building", name: "交响乐厅" },
    { x: 310, y: 1710, w: 540, h: 300, type: "building", name: "音源仓库" },
    { x: 2220, y: 1690, w: 680, h: 350, type: "building", name: "声学实验室" },
    { x: 790, y: 620, w: 190, h: 145, type: "building", name: "调音室" },
    { x: 1770, y: 600, w: 220, h: 170, type: "building", name: "黑胶唱片厂" },
    { x: 930, y: 1450, w: 210, h: 165, type: "building", name: "节拍器工厂" },
    { x: 1810, y: 1430, w: 205, h: 175, type: "building", name: "琴弦加工厂" },
    { x: 1110, y: 830, w: 46, h: 145, type: "barrier", name: "隔音墙" },
    { x: 2110, y: 1290, w: 145, h: 42, type: "barrier", name: "隔音墙" },
];
const gymObstacles = [
    { x: 280, y: 260, w: 600, h: 340, type: "building", name: "铁拳健身馆" },
    { x: 2200, y: 260, w: 700, h: 330, type: "building", name: "力量训练中心" },
    { x: 240, y: 1690, w: 620, h: 350, type: "building", name: "肌肉工厂" },
    { x: 2220, y: 1690, w: 680, h: 350, type: "building", name: "赛博拳击馆" },
    { x: 950, y: 360, w: 300, h: 240, type: "building", name: "蛋白质补给站" },
    { x: 1830, y: 360, w: 300, h: 240, type: "building", name: "重训器械库" },
    { x: 960, y: 1780, w: 310, h: 230, type: "building", name: "极限举重馆" },
    { x: 1830, y: 1780, w: 310, h: 230, type: "building", name: "格斗擂台" },
    { x: 830, y: 790, w: 145, h: 42, type: "barrier", name: "训练围栏" },
    { x: 2160, y: 790, w: 145, h: 42, type: "barrier", name: "训练围栏" },
    { x: 830, y: 1420, w: 145, h: 42, type: "barrier", name: "训练围栏" },
    { x: 2160, y: 1420, w: 145, h: 42, type: "barrier", name: "训练围栏" },
];
const schoolObstacles = [
    { x: 270, y: 250, w: 560, h: 310, type: "building", name: "教学楼 A" },
    { x: 2210, y: 250, w: 690, h: 320, type: "building", name: "教学楼 B" },
    { x: 300, y: 1710, w: 560, h: 300, type: "building", name: "实验楼" },
    { x: 2220, y: 1690, w: 650, h: 330, type: "building", name: "体育馆" },
    { x: 930, y: 320, w: 300, h: 235, type: "building", name: "图书馆" },
    { x: 1830, y: 320, w: 300, h: 235, type: "building", name: "食堂" },
    { x: 960, y: 1790, w: 310, h: 220, type: "building", name: "社团活动中心" },
    { x: 1830, y: 1790, w: 310, h: 220, type: "building", name: "学生宿舍" },
    { x: 1410, y: 700, w: 380, h: 270, type: "building", name: "办公室" },
    { x: 830, y: 790, w: 150, h: 38, type: "barrier", name: "校园护栏" },
    { x: 2170, y: 790, w: 150, h: 38, type: "barrier", name: "校园护栏" },
    { x: 830, y: 1430, w: 150, h: 38, type: "barrier", name: "校园护栏" },
    { x: 2170, y: 1430, w: 150, h: 38, type: "barrier", name: "校园护栏" },
];
const airportObstacles = [
    { x: 970, y: 300, w: 430, h: 250, type: "building", name: "航站楼" },
    { x: 260, y: 310, w: 410, h: 250, type: "building", name: "货运中心" },
    { x: 2070, y: 310, w: 440, h: 250, type: "building", name: "机库 A" },
    { x: 260, y: 1810, w: 420, h: 250, type: "building", name: "维修机库" },
    { x: 2230, y: 1810, w: 430, h: 250, type: "building", name: "机库 B" },
    { x: 2040, y: 790, w: 300, h: 210, type: "building", name: "空管塔台" },
    { x: 870, y: 1800, w: 360, h: 230, type: "building", name: "行李分拣中心" },
    { x: 1750, y: 330, w: 175, h: 130, type: "building", name: "机场消防站" },
];
function randomizeObstacleLayout(source) {
    return source.map((item) => {
        const jitter = item.type === "building" ? 76 : 48;
        let x = item.x;
        let y = item.y;
        for (let attempt = 0; attempt < 12; attempt += 1) {
            x = Math.max(70, Math.min(map.width - item.w - 70, item.x + (Math.random() * 2 - 1) * jitter));
            y = Math.max(70, Math.min(map.height - item.h - 70, item.y + (Math.random() * 2 - 1) * jitter));
            const spawnOverlaps = x < 1630 && x + item.w > 1570 && y < 1230 && y + item.h > 1170;
            if (!spawnOverlaps)
                break;
            x = item.x;
            y = item.y;
        }
        return { ...item, x, y };
    });
}
const airportApron = { x: map.width / 2, y: map.height / 2 };
const airportRunways = [
    [0, -1], [Math.SQRT1_2, -Math.SQRT1_2], [1, 0], [Math.SQRT1_2, Math.SQRT1_2],
    [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2],
].map(([x, y]) => {
    const distanceX = x === 0 ? Infinity : (map.width / 2 - 60) / Math.abs(x);
    const distanceY = y === 0 ? Infinity : (map.height / 2 - 60) / Math.abs(y);
    const distance = Math.min(distanceX, distanceY);
    return {
        x: airportApron.x,
        y: airportApron.y,
        endX: airportApron.x + x * distance,
        endY: airportApron.y + y * distance,
    };
});
const obstacles = config.duel
    ? []
    : randomizeObstacleLayout(mapTheme === "hospital" ? hospitalObstacles
        : mapTheme === "music" ? musicObstacles
            : mapTheme === "gym" ? gymObstacles
                : mapTheme === "airport" ? airportObstacles
                    : mapTheme === "school" ? schoolObstacles
                        : cityObstacles);
const roads = config.duel || mapTheme === "airport" ? [] : mapTheme === "hospital"
    ? [
        { x: 0, y: 660 + Math.random() * 45, w: map.width, h: 150 },
        { x: 0, y: 1430 + Math.random() * 45, w: map.width, h: 155 },
        { x: 810 + Math.random() * 40, y: 0, w: 150, h: map.height },
        { x: 1550 + Math.random() * 40, y: 0, w: 165, h: map.height },
        { x: 2320 + Math.random() * 40, y: 0, w: 150, h: map.height },
    ]
    : [
        { x: 0, y: 620 + Math.random() * 70, w: map.width, h: 110 },
        { x: 0, y: 1340 + Math.random() * 70, w: map.width, h: 120 },
        { x: 750 + Math.random() * 80, y: 0, w: 100, h: map.height },
        { x: 1260 + Math.random() * 80, y: 0, w: 105, h: map.height },
        { x: 2240 + Math.random() * 80, y: 0, w: 115, h: map.height },
    ];
const upgradePool = [
    {
        id: "attack-speed",
        name: locale.upgrades["attack-speed"].name,
        description: locale.upgrades["attack-speed"].description,
        available: () => playerState.attackSpeed < 3.5,
        apply: () => { playerState.attackSpeed = Math.min(3.5, playerState.attackSpeed + 0.25); },
    },
    {
        id: "armor",
        name: locale.upgrades.armor.name,
        description: locale.upgrades.armor.description,
        available: () => playerState.damageReduction < 0.6,
        apply: () => { playerState.damageReduction = Math.min(0.6, playerState.damageReduction + 0.08); },
    },
    {
        id: "power",
        name: locale.upgrades.power.name,
        description: locale.upgrades.power.description,
        apply: () => { playerState.damageMultiplier += 0.2; },
    },
    {
        id: "lifesteal",
        name: locale.upgrades.lifesteal.name,
        description: locale.upgrades.lifesteal.description,
        available: () => playerState.lifesteal < 0.6,
        apply: () => { playerState.lifesteal = Math.min(0.6, playerState.lifesteal + 0.1); },
    },
    {
        id: "dodge",
        name: locale.upgrades.dodge.name,
        description: locale.upgrades.dodge.description,
        available: () => playerState.dodgeChance < 0.6,
        apply: () => { playerState.dodgeChance = Math.min(0.6, playerState.dodgeChance + 0.08); },
    },
    {
        id: "vitality",
        name: locale.upgrades.vitality.name,
        description: locale.upgrades.vitality.description,
        apply: () => {
            playerState.maxHp += 25;
            playerState.hp = Math.min(playerState.maxHp, playerState.hp + 25);
        },
    },
    {
        id: "reactor",
        name: locale.upgrades.reactor.name,
        description: locale.upgrades.reactor.description,
        apply: () => { playerState.energyRegen += 0.75; },
    },
    {
        id: "fleet",
        name: locale.upgrades.fleet.name,
        description: locale.upgrades.fleet.description,
        apply: () => { player.speed *= 1.12; },
    },
    {
        id: "medkit",
        name: locale.upgrades.medkit.name,
        description: locale.upgrades.medkit.description,
        apply: () => { playerState.hp = Math.min(playerState.maxHp, playerState.hp + 35); },
    },
    {
        id: "coolant",
        name: locale.upgrades.coolant.name,
        description: locale.upgrades.coolant.description,
        apply: () => {
            skillCooldowns.forEach((remaining, id) => skillCooldowns.set(id, Math.max(0, remaining - 2)));
        },
    },
    {
        id: "cooldown",
        name: locale.upgrades.cooldown.name,
        description: locale.upgrades.cooldown.description,
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
    const displayWave = waveState === "starting" ? wave + 1 : wave;
    const title = `第 ${displayWave} 波 · ${waveState === "active" ? "交战中" : waveState === "upgrade" ? "波次完成" : "集结中"}`;
    if (waveTitle.textContent !== title)
        waveTitle.textContent = localizeBattleText(title);
    if (waveState === "active") {
        const alive = enemies.filter((enemy) => enemy.hp > 0).length;
        const subtitle = enemiesToSpawn > 0
            ? tx(`场上 ${alive} · 正在接近 ${enemiesToSpawn}`)
            : tx(`剩余敌人 ${alive}`);
        if (waveSubtitle.textContent !== subtitle)
            waveSubtitle.textContent = localizeBattleText(subtitle);
    }
    else {
        const subtitle = waveState === "upgrade" ? tx("选择强化，准备下一波") : tx("敌人即将出现");
        if (waveSubtitle.textContent !== subtitle)
            waveSubtitle.textContent = localizeBattleText(subtitle);
    }
}
function updateDuelHud() {
    const title = localizeBattleText(`你 ${duelPlayerScore} : ${duelBotScore} AI · 第 ${duelRound} 回合`);
    if (waveTitle.textContent !== title)
        waveTitle.textContent = title;
    const subtitle = duelRoundActive
        ? tx("先赢下 4 分获得胜利")
        : tx(`下一回合 ${Math.max(0, Math.ceil(duelBreakRemaining))} 秒后开始`);
    if (waveSubtitle.textContent !== subtitle)
        waveSubtitle.textContent = localizeBattleText(subtitle);
    const bot = enemies.find((enemy) => enemy.duelBot);
    if (bot) {
        if (duelOpponentName && duelOpponentName.textContent !== bot.name)
            duelOpponentName.textContent = bot.name || tx("AI 对手");
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
    const availableHeroes = ["volt", "moss", "luna", "tech", "pipa"].filter((id) => id !== getHeroId());
    const botHero = availableHeroes[Math.floor(Math.random() * availableHeroes.length)] || "volt";
    const profiles = {
        volt: { accent: "pink", defense: 58 },
        moss: { accent: "green", defense: 94 },
        luna: { accent: "blue", defense: 48 },
        tech: { accent: "tech", defense: 58 },
        pipa: { accent: "pipa", defense: 66 },
    };
    const profile = profiles[botHero] || profiles.volt;
    const localizedBot = locale.heroes[botHero] || locale.heroes.volt;
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
        initial: localizedBot.initial,
        name: localizedBot.name,
        skillTimer: 2.5,
        defenseReduction: Math.min(0.38, profile.defense / 250 + (duelRound - 1) * 0.015),
    };
}
function getHeroId() {
    const heroByAccent = { pink: "volt", green: "moss", blue: "luna", tech: "tech", pipa: "pipa" };
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
        id: `enemy-${++eventSerial}`,
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
    if (mapTheme === "airport")
        scheduleAirportFlightsForWave();
    enemiesToSpawn = Math.min(4 + wave * 2, 18);
    spawnTimer = 0.3;
    updateWaveHud();
    showToast(tx(`第 ${wave} 波来袭！准备迎战。`), "warning");
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
            showToast(tx(`获得强化：${choice.name}。下一波即将开始。`));
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
    if (enemiesToSpawn === 0 && enemies.every((enemy) => enemy.anesthetist || enemy.hp <= 0)) {
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
    toast.textContent = localizeBattleText(message);
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
    waveSubtitle.textContent = tx("探索者已被击败");
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
            title.textContent = won ? tx("竞技胜利") : tx("挑战失败");
        if (description)
            description.textContent = tx(`最终比分 ${duelPlayerScore} : ${duelBotScore}。${won ? "你击败了 AI 对手！" : "AI 对手赢下了本场比赛。"}`);
        retryRunButton.textContent = tx("再战一局");
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
    duelUpgradeTitle.textContent = tx(`第 ${duelRound} 回合结束 · 选择强化`);
    duelUpgradeSubtitle.textContent = tx("选择一项强化，十秒后自动开始下一回合。");
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
            duelUpgradeSubtitle.textContent = tx(`已获得强化：${choice.name}。等待下一回合开始。`);
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
    combatTraitsLabel.textContent = localizeBattleText(`攻速 ${playerState.attackSpeed.toFixed(1)}/秒 · 防御 ${Math.round(playerState.damageReduction * 100)}% · 吸血 ${Math.round(playerState.lifesteal * 100)}% · 闪避 ${Math.round(playerState.dodgeChance * 100)}%`);
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
            ? tx(`${progress.tier}阶 · 小强化 ${progress.minorUpgrades}/${required}`)
            : tx("3阶 · 已满");
    });
    const basicCooldown = basicAttackButton.querySelector(".skill-cooldown");
    if (basicCooldown) {
        basicCooldown.textContent = basicAttackTimer > 0 ? `${basicAttackTimer.toFixed(1)}s` : "";
    }
    const basicDescription = basicAttackButton.querySelector("small");
    if (basicDescription) {
        const rate = getEffectiveAttackSpeed();
        const label = tx(`${rate.toFixed(1)} 次/秒${config.duel ? "" : " · 回复 5 能量"}`);
        if (basicDescription.textContent !== label)
            basicDescription.textContent = label;
    }
}
function getEffectiveAttackSpeed() {
    const haste = (statusEffects["加速"] || 0) > 0 || (statusEffects["攻速加成"] || 0) > 0;
    return Math.min(3.5, playerState.attackSpeed * (haste ? 1.3 : 1)) *
        (schoolClassDuration > 0 ? 0.5 : 1);
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
        "pipa-yangchun": ["攻击对象 +1", "禁锢时间 +1 秒"],
        "pipa-shimian": ["小兵生命 +50%", "小兵数量 +2"],
        "pipa-ult": ["狂舞时间 +1 秒", "狂舞目标攻速 +20%"],
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
        case "pipa-yangchun":
            if (tier === 2) {
                skill.target_count = (skill.target_count || 3) + 1;
                return "攻击对象 +1";
            }
            skill.effect_turns += 1;
            return "禁锢时间 +1 秒";
        case "pipa-shimian":
            if (tier === 2) {
                skill.minion_hp_multiplier = (skill.minion_hp_multiplier || 1) * 1.5;
                return "小兵生命 +50%";
            }
            skill.minion_count = (skill.minion_count || 5) + 2;
            return "小兵数量 +2";
        case "pipa-ult":
            if (tier === 2) {
                skill.frenzy_duration_bonus = (skill.frenzy_duration_bonus || 0) + 1;
                return "狂舞时间 +1 秒";
            }
            skill.frenzy_attack_speed_bonus = (skill.frenzy_attack_speed_bonus || 0) + 0.2;
            return "狂舞目标攻速 +20%";
        default:
            return "技能效果强化";
    }
}
function showSkillUpgrade() {
    keys.clear();
    touchKeys.clear();
    skillUpgradeTitle.textContent = tx(`选择技能强化 · 第 ${skillExperienceLevel} 级`);
    skillUpgradeSubtitle.textContent = tx(`击败敌人获得技能经验，当前还有 ${pendingSkillChoices} 次强化待选择。`);
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
        description.textContent = localizeBattleText(requirement
            ? progress.minorUpgrades + 1 >= requirement
                ? `小强化：${describeSmallSkillUpgrade(skill, progress)}。本次升阶将解锁：${describeSkillTierEffect(skill, (progress.tier + 1))}。`
                : `小强化：${describeSmallSkillUpgrade(skill, progress)}（${progress.minorUpgrades + 1}/${requirement}），逐步解锁新的技能效果。`
            : "技能已达 3 阶；本次继续获得一项小强化。");
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
                showToast(tx(`技能强化完成：${message}`));
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
    context.fillStyle = mapTheme === "hospital" ? "#17232e"
        : mapTheme === "music" ? "#191426"
            : mapTheme === "gym" ? "#1d171b"
                : mapTheme === "airport" ? "#15202a"
                    : mapTheme === "school" ? "#172321" : "#111827";
    context.fillRect(0, 0, map.width, map.height);
    context.strokeStyle = mapTheme === "hospital" ? "#29404a"
        : mapTheme === "music" ? "#37294a"
            : mapTheme === "gym" ? "#443331"
                : mapTheme === "airport" ? "#263c50"
                    : mapTheme === "school" ? "#30463d" : "#20303a";
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
    if (mapTheme === "airport")
        drawAirportRunways();
    if (!config.duel)
        roads.forEach((road) => {
            context.fillStyle = mapTheme === "hospital" ? "#22333a"
                : mapTheme === "music" ? "#292039"
                    : mapTheme === "gym" ? "#302528"
                        : mapTheme === "school" ? "#263034" : "#1a2530";
            context.fillRect(road.x, road.y, road.w, road.h);
            if (randomEventWarning > 0 && mapTheme === "city") {
                context.fillStyle = Math.floor(randomEventWarning * 5) % 2 ? "#7a2938aa" : "#1a2530";
                context.fillRect(road.x, road.y, road.w, road.h);
            }
            context.strokeStyle = mapTheme === "hospital" ? "#52777b"
                : mapTheme === "music" ? "#755386"
                    : mapTheme === "gym" ? "#76504b"
                        : mapTheme === "school" ? "#60705d" : "#34434b";
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
            context.fillStyle = mapTheme === "hospital" ? "#354651"
                : mapTheme === "music" ? "#443653"
                    : mapTheme === "gym" ? "#4a3839"
                        : mapTheme === "airport" ? "#3a4b5a"
                            : mapTheme === "school" ? "#35463f" : "#252d3c";
            context.fill();
            context.strokeStyle = mapTheme === "hospital" ? "#70a2a5"
                : mapTheme === "music" ? "#b47dcb"
                    : mapTheme === "gym" ? "#c26d58"
                        : mapTheme === "airport" ? "#93adbe"
                            : mapTheme === "school" ? "#a5c27d" : "#465365";
            context.lineWidth = 4;
            context.stroke();
            context.fillStyle = mapTheme === "hospital" ? "#45616b"
                : mapTheme === "music" ? "#644b74"
                    : mapTheme === "gym" ? "#654745"
                        : mapTheme === "airport" ? "#506579"
                            : mapTheme === "school" ? "#4a5b4c" : "#313c4d";
            context.fillRect(obstacle.x + 12, obstacle.y + 12, obstacle.w - 24, 28);
            context.fillStyle = mapTheme === "hospital" ? "#d3eff0"
                : mapTheme === "music" ? "#f0d8ff"
                    : mapTheme === "gym" ? "#ffe1cf"
                        : mapTheme === "airport" ? "#e0efff"
                            : mapTheme === "school" ? "#e5f1cf" : "#738091";
            context.font = "13px sans-serif";
            context.fillText(locale.battle.obstacles[obstacle.name] || obstacle.name, obstacle.x + 22, obstacle.y + 31);
            context.strokeStyle = mapTheme === "hospital"
                ? index % 2 ? "#4f8988" : "#5680a0"
                : mapTheme === "music"
                    ? index % 2 ? "#8855a0" : "#b06b9c"
                    : mapTheme === "gym"
                        ? index % 2 ? "#9c5049" : "#7c5b47"
                        : mapTheme === "airport"
                            ? index % 2 ? "#5d819c" : "#7e9cae"
                            : mapTheme === "school"
                                ? index % 2 ? "#77885b" : "#526d61"
                                : index % 2 ? "#31585a" : "#4c3e65";
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
            if (mapTheme === "hospital") {
                context.fillStyle = "#9ef6ed";
                context.fillRect(obstacle.x + obstacle.w - 42, obstacle.y + 17, 4, 18);
                context.fillRect(obstacle.x + obstacle.w - 49, obstacle.y + 24, 18, 4);
            }
        });
    if (mapTheme === "airport")
        drawAirportTerminalSign();
    if (mapTheme === "school")
        drawSchoolOfficeSign();
    trafficCars.forEach(drawTrafficCar);
    harpFields.forEach(drawHarpField);
    gymRushers.forEach(drawGymRusher);
    airportPlanes.forEach(drawAirportPlane);
    supplies.forEach((supply) => {
        if (!supply.collected)
            drawSupply(supply);
    });
    enemies.filter((enemy) => !enemy.gymRusher).forEach(drawEnemy);
    pipaMinions.forEach(drawPipaMinion);
    drawFloatingTexts();
    context.strokeStyle = "#49e6e0";
    context.lineWidth = 8;
    context.strokeRect(4, 4, map.width - 8, map.height - 8);
}
function drawAirportRunways() {
    context.save();
    airportRunways.forEach((runway, index) => {
        context.strokeStyle = "#334654";
        context.lineWidth = 78;
        context.beginPath();
        context.moveTo(runway.x, runway.y);
        context.lineTo(runway.endX, runway.endY);
        context.stroke();
        context.strokeStyle = "#8ea6a9";
        context.lineWidth = 2;
        context.setLineDash([34, 28]);
        context.beginPath();
        context.moveTo(runway.x, runway.y);
        context.lineTo(runway.endX, runway.endY);
        context.stroke();
        context.setLineDash([]);
        const dx = runway.endX - runway.x;
        const dy = runway.endY - runway.y;
        const length = Math.hypot(dx, dy);
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy * 25;
        const py = ux * 25;
        for (let mark = 1; mark <= 4; mark += 1) {
            const t = mark / 5;
            const x = runway.x + dx * t;
            const y = runway.y + dy * t;
            context.strokeStyle = "#dce7dc";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(x - px, y - py);
            context.lineTo(x + px, y + py);
            context.stroke();
        }
        context.fillStyle = index % 2 ? "#fb696d" : "#79efcf";
        context.beginPath();
        context.arc(runway.endX, runway.endY, 9, 0, Math.PI * 2);
        context.fill();
    });
    context.fillStyle = "#73868c";
    context.beginPath();
    context.ellipse(airportApron.x, airportApron.y, 104, 78, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#b3c4bf";
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = "#f0df91";
    context.font = "bold 15px sans-serif";
    context.textAlign = "center";
    context.fillText(tx("停机坪"), airportApron.x, airportApron.y + 5);
    context.restore();
}
function drawAirportTerminalSign() {
    const terminal = obstacles.find((obstacle) => obstacle.name === "航站楼");
    if (!terminal)
        return;
    const x = terminal.x + 20;
    const y = terminal.y + 58;
    context.save();
    roundedRect(context, x, y, terminal.w - 40, 72, 8);
    context.fillStyle = "#061621";
    context.fill();
    context.strokeStyle = "#52ded2";
    context.lineWidth = 2;
    context.stroke();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#8ff9e8";
    context.font = "bold 13px sans-serif";
    context.fillText(tx("航班时刻表"), x + 12, y + 18);
    context.fillStyle = "#e6f5ef";
    context.font = "12px sans-serif";
    context.fillText(`${tx("起飞")} ${getAirportFlightCount(true)}/${airportTakeoffsScheduled}x  ${formatFlightTime(airportFlightTimer, airportPlanes.length < airportFlightsTarget && shouldScheduleAirportTakeoff())}`, x + 12, y + 42);
    context.fillText(`${tx("降落")} ${getAirportFlightCount(false)}/${airportLandingsScheduled}x  ${formatFlightTime(airportFlightTimer, !shouldScheduleAirportTakeoff() && airportPlanes.length < airportFlightsTarget)}`, x + 178, y + 42);
    context.restore();
}
function getAirportFlightCount(takeoff) {
    return airportPlanes.filter((plane) => plane.takeoff === takeoff).length;
}
function formatFlightTime(seconds, flightNeeded) {
    if (!flightNeeded)
        return "--:--";
    const remaining = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
}
function drawSchoolOfficeSign() {
    const office = obstacles.find((obstacle) => obstacle.name === "办公室");
    if (!office)
        return;
    const x = office.x + 20;
    const y = office.y + 62;
    context.save();
    roundedRect(context, x, y, office.w - 40, 78, 7);
    context.fillStyle = "#101b16";
    context.fill();
    context.strokeStyle = schoolClassDuration > 0 ? "#ffe45c" : "#a5c27d";
    context.lineWidth = 2;
    context.stroke();
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#e7f4d2";
    context.font = "bold 13px sans-serif";
    context.fillText(tx("上课安排"), x + 12, y + 18);
    context.fillStyle = schoolClassDuration > 0 ? "#ffe45c" : "#a5c27d";
    context.font = "bold 16px sans-serif";
    context.fillText(`${tx(schoolClassDuration > 0 ? "正在上课" : "距上课")} ${formatFlightTime(schoolClassDuration > 0 ? schoolClassDuration : schoolClassTimer, true)}`, x + 12, y + 50);
    context.restore();
}
function drawHarpField(harp) {
    const remaining = Math.max(0, 5 - harp.age);
    const pulse = 1 + Math.sin(harp.age * 12) * 0.04;
    context.save();
    context.translate(harp.x, harp.y);
    context.shadowColor = "#e78cff";
    context.shadowBlur = 20;
    context.fillStyle = "#bd74ec55";
    context.beginPath();
    context.arc(0, 0, 190 * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#e99cff";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 190 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 10;
    context.strokeStyle = "#ffe7ff";
    context.lineWidth = 7;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-27, 25);
    context.lineTo(-10, -31);
    context.quadraticCurveTo(31, -51, 38, 18);
    context.stroke();
    context.lineWidth = 2;
    for (let string = 0; string < 6; string += 1) {
        const t = string / 5;
        context.beginPath();
        context.moveTo(-10 + 42 * t, -29 + 4 * t);
        context.lineTo(-26 + 54 * t, 23 - 3 * t);
        context.stroke();
    }
    context.fillStyle = "#fff1ff";
    context.font = "bold 13px sans-serif";
    context.textAlign = "center";
    context.fillText(`${tx("正在演奏")} ${remaining.toFixed(1)}s`, 0, 56);
    context.restore();
}
function drawGymRusher(rusher) {
    if (rusher.hp <= 0)
        return;
    context.save();
    context.translate(rusher.x, rusher.y);
    context.rotate(Math.atan2(rusher.vy, rusher.vx));
    context.shadowColor = "#ff654f";
    context.shadowBlur = 20;
    context.fillStyle = "#f47a59";
    context.strokeStyle = "#ffd1a1";
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(0, 0, 24, 17, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(17, -1, 12, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff1d4";
    context.beginPath();
    context.arc(21, -5, 2.5, 0, Math.PI * 2);
    context.fill();
    context.rotate(-Math.atan2(rusher.vy, rusher.vx));
    context.fillStyle = "#10131e";
    context.fillRect(-24, -31, 48, 5);
    context.fillStyle = "#ff795d";
    context.fillRect(-24, -31, 48 * Math.max(0, rusher.hp / rusher.maxHp), 5);
    drawEffectIndicators(0, -49, rusher.effects);
    context.restore();
}
function drawAirportPlane(plane) {
    const angle = Math.atan2(plane.endY - plane.startY, plane.endX - plane.startX);
    const planeColor = plane.takeoff ? "#c9edf0" : "#ffd28a";
    context.save();
    context.translate(plane.x, plane.y);
    context.rotate(angle);
    context.shadowColor = plane.takeoff ? "#b8f7ff" : "#ffae57";
    context.shadowBlur = 22;
    context.fillStyle = planeColor;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(43, 0);
    context.lineTo(8, -8);
    context.lineTo(-24, plane.takeoff ? -30 : -24);
    context.lineTo(-15, plane.takeoff ? -7 : -11);
    context.lineTo(-40, -5);
    context.lineTo(-40, 5);
    context.lineTo(-15, 7);
    context.lineTo(-24, plane.takeoff ? 30 : 24);
    context.lineTo(8, 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
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
function drawTrafficCar(car) {
    context.save();
    context.translate(car.x, car.y);
    const horizontal = car.width > car.height;
    if (!horizontal)
        context.rotate(Math.PI / 2);
    context.shadowColor = "#ff4968";
    context.shadowBlur = 20;
    roundedRect(context, -car.width / 2, -car.height / 2, car.width, car.height, 9);
    context.fillStyle = "#a62d45";
    context.fill();
    context.strokeStyle = "#ff8897";
    context.lineWidth = 3;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#bdeaff";
    roundedRect(context, -car.width * 0.18, -car.height * 0.34, car.width * 0.34, car.height * 0.68, 5);
    context.fill();
    const forward = horizontal ? car.vx > 0 : car.vy > 0;
    context.fillStyle = "#ffe169";
    context.fillRect(forward ? car.width / 2 - 5 : -car.width / 2 + 1, -car.height / 2 + 4, 4, 7);
    context.fillStyle = "#ff314f";
    context.fillRect(forward ? -car.width / 2 + 1 : car.width / 2 - 5, car.height / 2 - 11, 4, 7);
    context.restore();
}
function drawEffectIndicators(x, y, effects) {
    const negativeEffects = ["眩晕", "禁锢", "减速", "强力减速", "中毒", "狂舞"]
        .filter((effect) => (effects[effect] || 0) > 0);
    if (!negativeEffects.length)
        return;
    const colorsByEffect = {
        "眩晕": "#ffe45c",
        "禁锢": "#b7ef55",
        "减速": "#70d8ff",
        "强力减速": "#e99cff",
        "中毒": "#9cff65",
        "狂舞": "#f1b95b",
    };
    context.save();
    context.font = "bold 12px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    negativeEffects.forEach((effect, index) => {
        const label = `${locale.battle.effects[effect] || effect} ${Math.ceil(effects[effect])}s`;
        const width = context.measureText(label).width + 16;
        const xOffset = (index - (negativeEffects.length - 1) / 2) * (width + 4);
        roundedRect(context, x + xOffset - width / 2, y - 16, width, 22, 6);
        context.fillStyle = "#090d16eF";
        context.fill();
        context.strokeStyle = colorsByEffect[effect] || "#ffffff";
        context.lineWidth = 1.5;
        context.stroke();
        context.fillStyle = colorsByEffect[effect] || "#ffffff";
        context.fillText(label, x + xOffset, y - 5);
    });
    context.restore();
}
function drawPipaMinion(minion) {
    if (minion.hp <= 0)
        return;
    context.save();
    context.translate(minion.x, minion.y);
    context.shadowColor = "#f1b95b";
    context.shadowBlur = 15;
    context.fillStyle = "#422d20";
    context.strokeStyle = "#f1b95b";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#fff0b8";
    context.font = "bold 14px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(locale.code === "en" ? "M" : "兵", 0, 1);
    context.fillStyle = "#10131e";
    context.fillRect(-17, -24, 34, 4);
    context.fillStyle = "#f1b95b";
    context.fillRect(-17, -24, 34 * minion.hp / minion.maxHp, 4);
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
        drawEffectIndicators(0, -56, enemy.effects);
        context.restore();
        return;
    }
    if (enemy.anesthetist) {
        context.save();
        context.translate(enemy.x, enemy.y);
        context.shadowColor = "#86f6ec";
        context.shadowBlur = 18;
        context.fillStyle = "#dffbff";
        context.strokeStyle = "#57d8d6";
        context.lineWidth = 3;
        context.beginPath();
        context.arc(0, 0, 19, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = "#298c9c";
        context.font = "bold 20px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("+", 0, 1);
        context.fillStyle = "#effbff";
        context.font = "bold 12px sans-serif";
        context.fillText(tx("麻醉医生"), 0, -40);
        context.fillStyle = "#10131e";
        context.fillRect(-22, -29, 44, 5);
        context.fillStyle = "#7df3e6";
        context.fillRect(-22, -29, 44 * Math.max(0, enemy.hp / enemy.maxHp), 5);
        drawEffectIndicators(0, -53, enemy.effects);
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
    drawEffectIndicators(0, -size - 22, enemy.effects);
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
    floatingTexts.push({ x, y, text: localizeBattleText(text), color, life: 0.8 });
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
function spawnHospitalDoctors() {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let index = 0; index < count; index += 1) {
        let x = 80;
        let y = 80;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const edge = Math.floor(Math.random() * 4);
            x = edge < 2 ? 80 + Math.random() * (map.width - 160) : edge === 2 ? 45 : map.width - 45;
            y = edge >= 2 ? 80 + Math.random() * (map.height - 160) : edge === 0 ? 45 : map.height - 45;
            if (isSpawnPositionClear(x, y))
                break;
        }
        enemies.push({
            id: `doctor-${++eventSerial}`,
            x, y,
            hp: 110 + Math.min(50, wave * 4),
            maxHp: 110 + Math.min(50, wave * 4),
            attackTimer: 0.6 + Math.random(),
            attack: 6 + Math.min(5, wave),
            speed: 188 + Math.random() * 48,
            kind: "doctor",
            poisonDamage: 0,
            poisonTimer: 0,
            effects: {},
            experienceAwarded: false,
            anesthetist: true,
            attackedTargets: new Set(),
            lifeTimer: 26,
        });
    }
    showToast(tx(`麻醉医生突入！${count} 名高速单位已出现，击败可获得大量技能经验。`), "warning");
}
function spawnTrafficConvoy() {
    const selectedRoads = roads.slice().sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
    selectedRoads.forEach((road) => {
        const horizontal = road.w > road.h;
        const forward = Math.random() < 0.5 ? 1 : -1;
        trafficCars.push({
            x: horizontal ? (forward > 0 ? -100 : map.width + 100) : road.x + road.w / 2 + (Math.random() - 0.5) * 40,
            y: horizontal ? road.y + road.h / 2 + (Math.random() - 0.5) * 35 : (forward > 0 ? -100 : map.height + 100),
            vx: horizontal ? forward * (670 + Math.random() * 200) : 0,
            vy: horizontal ? 0 : forward * (670 + Math.random() * 200),
            width: horizontal ? 82 : 34,
            height: horizontal ? 34 : 82,
            hitTargets: new Set(),
        });
    });
    showToast(tx("车流事件开始！注意闪烁道路，车辆会冲过整条街道。"), "warning");
}
function spawnHarpFields() {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let index = 0; index < count; index += 1) {
        let x = player.x;
        let y = player.y;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            x = 140 + Math.random() * (map.width - 280);
            y = 140 + Math.random() * (map.height - 280);
            if (isSpawnPositionClear(x, y))
                break;
        }
        harpFields.push({ x, y, age: 0, tickTimer: 0 });
    }
    showToast(tx("琴弦共鸣！竖琴已落地，演奏 5 秒并伤害、减速附近单位。"), "warning");
}
function getEventTargets() {
    const targets = [{ id: "player", x: player.x, y: player.y, player: true }];
    enemies.forEach((enemy, index) => {
        if (enemy.hp <= 0)
            return;
        targets.push({
            id: enemy.id || `enemy-${index}`,
            x: enemy.x,
            y: enemy.y,
            player: false,
            unit: enemy,
        });
    });
    return targets;
}
function combatTargetRadius(target) {
    if (!target.unit)
        return player.radius;
    if (target.unit.anesthetist)
        return 19;
    return target.unit.kind === "brute" ? 25 : target.unit.kind === "runner" ? 14 : 20;
}
function applyEventDamage(target, damage) {
    if (target.player)
        return applyPlayerDamage(damage);
    if (!target.unit || target.unit.hp <= 0)
        return false;
    damageEnemyByNpc(target.unit, damage);
    return true;
}
function applyKnockback(target, directionX, directionY, distance) {
    const length = Math.hypot(directionX, directionY);
    if (!length)
        return;
    const steps = Math.ceil(distance / 8);
    for (let step = 1; step <= steps; step += 1) {
        const x = directionX / length * distance / steps;
        const y = directionY / length * distance / steps;
        if (target.player) {
            if (!collides(player.x + x, player.y))
                player.x += x;
            if (!collides(player.x, player.y + y))
                player.y += y;
        }
        else if (target.unit && target.unit.hp > 0) {
            if (!isEnemyPositionBlocked(target.unit.x + x, target.unit.y))
                target.unit.x += x;
            if (!isEnemyPositionBlocked(target.unit.x, target.unit.y + y))
                target.unit.y += y;
        }
    }
}
function updateHarpFields(dt) {
    for (let index = harpFields.length - 1; index >= 0; index -= 1) {
        const harp = harpFields[index];
        harp.age += dt;
        harp.tickTimer += dt;
        while (harp.tickTimer >= 0.5 && harp.age <= 5) {
            harp.tickTimer -= 0.5;
            getEventTargets().forEach((target) => {
                if (Math.hypot(target.x - harp.x, target.y - harp.y) > 190 + combatTargetRadius(target))
                    return;
                if (target.player)
                    statusEffects["强力减速"] = Math.max(statusEffects["强力减速"] || 0, 0.7);
                else if (target.unit)
                    target.unit.effects["强力减速"] = Math.max(target.unit.effects["强力减速"] || 0, 0.7);
                applyEventDamage(target, 2);
            });
        }
        if (harp.age >= 5)
            harpFields.splice(index, 1);
    }
}
function spawnGymRushers() {
    const gyms = obstacles.filter((obstacle) => obstacle.type === "building" &&
        ["铁拳健身馆", "力量训练中心", "肌肉工厂", "赛博拳击馆"].includes(obstacle.name));
    const count = 3 + Math.floor(Math.random() * 2);
    for (let index = 0; index < count; index += 1) {
        const gym = gyms[Math.floor(Math.random() * gyms.length)];
        const x = gym.x + gym.w / 2 + (Math.random() - 0.5) * gym.w * 0.45;
        const y = gym.y + gym.h / 2 + (Math.random() - 0.5) * gym.h * 0.45;
        const target = getEventTargets()
            .sort((left, right) => Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y))[0];
        const angle = target ? Math.atan2(target.y - y, target.x - x) : Math.random() * Math.PI * 2;
        const speed = 250 + Math.random() * 60;
        const hp = Math.round(150 * (1 + (wave - 1) * 0.16));
        const rusher = {
            id: `gym-rusher-${++eventSerial}`,
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 8,
            targetId: target?.id,
            hitTargets: new Set(),
            hp,
            maxHp: hp,
            attackTimer: 0,
            attack: 0,
            speed,
            kind: "brute",
            poisonDamage: 0,
            poisonTimer: 0,
            effects: {},
            experienceAwarded: false,
            gymRusher: true,
        };
        gymRushers.push(rusher);
        enemies.push(rusher);
    }
    showToast(tx("健身房警报！肌肉壮汉冲出建筑，正冲向附近单位；击败可获得技能经验。"), "warning");
}
function updateGymRushers(dt) {
    for (let index = gymRushers.length - 1; index >= 0; index -= 1) {
        const rusher = gymRushers[index];
        if (rusher.hp <= 0) {
            gymRushers.splice(index, 1);
            continue;
        }
        const previousX = rusher.x;
        const previousY = rusher.y;
        const targets = getEventTargets().filter((candidate) => !candidate.unit?.gymRusher);
        const target = targets.find((candidate) => candidate.id === rusher.targetId) ||
            targets.sort((left, right) => Math.hypot(left.x - rusher.x, left.y - rusher.y) - Math.hypot(right.x - rusher.x, right.y - rusher.y))[0];
        if (target && !rusher.effects["眩晕"] && !rusher.effects["禁锢"]) {
            const speed = Math.hypot(rusher.vx, rusher.vy);
            const angle = Math.atan2(target.y - rusher.y, target.x - rusher.x);
            rusher.vx = Math.cos(angle) * speed;
            rusher.vy = Math.sin(angle) * speed;
            rusher.targetId = target.id;
        }
        const slowMultiplier = rusher.effects["强力减速"] ? 0.4 : rusher.effects["减速"] ? 0.45 : 1;
        const movementMultiplier = rusher.effects["眩晕"] || rusher.effects["禁锢"] ? 0 : slowMultiplier;
        rusher.x += rusher.vx * dt * movementMultiplier;
        rusher.y += rusher.vy * dt * movementMultiplier;
        rusher.life -= dt;
        let impacted = false;
        for (const victim of targets) {
            if (rusher.hitTargets.has(victim.id))
                continue;
            if (distanceToSegment(victim.x, victim.y, previousX, previousY, rusher.x, rusher.y) >
                32 + combatTargetRadius(victim))
                continue;
            rusher.hitTargets.add(victim.id);
            const damage = 112 + Math.min(58, wave * 6);
            if (applyEventDamage(victim, damage)) {
                applyKnockback(victim, rusher.vx, rusher.vy, 150);
                addFloatingText(victim.x, victim.y - 48, tx(`肌肉冲撞 -${damage}`), "#ff795d");
                spawnImpact(victim.x, victim.y, "#ff795d");
                showToast(tx(`肌肉壮汉迎面撞击！造成 ${damage} 点巨额伤害。`), "warning");
            }
            impacted = true;
            break;
        }
        if (impacted || rusher.life <= 0 || rusher.x < -100 || rusher.y < -100 ||
            rusher.x > map.width + 100 || rusher.y > map.height + 100) {
            gymRushers.splice(index, 1);
            const enemyIndex = enemies.indexOf(rusher);
            if (enemyIndex >= 0)
                enemies.splice(enemyIndex, 1);
        }
    }
}
function scheduleAirportFlightsForWave() {
    airportFlightsTarget = Math.min(8, wave);
    airportTakeoffsScheduled = Math.ceil(airportFlightsTarget / 2);
    airportLandingsScheduled = Math.ceil(airportFlightsTarget / 2);
    airportFlightTimer = Math.max(1.5, 12 - wave * 1.2) + Math.random() * 2;
}
function shouldScheduleAirportTakeoff() {
    const takeoffsInFlight = getAirportFlightCount(true);
    const landingsInFlight = getAirportFlightCount(false);
    return takeoffsInFlight >= airportTakeoffsScheduled
        ? false
        : landingsInFlight >= airportLandingsScheduled
            ? true
            : takeoffsInFlight === landingsInFlight
                ? airportNextFlightTakeoff
                : takeoffsInFlight < landingsInFlight;
}
function getAvailableAirportRunway() {
    const occupiedRunways = new Set(airportPlanes.map((plane) => plane.runwayIndex));
    const availableRunways = airportRunways
        .map((_, index) => index)
        .filter((index) => !occupiedRunways.has(index));
    if (!availableRunways.length)
        return undefined;
    return availableRunways[Math.floor(Math.random() * availableRunways.length)];
}
function startAirportFlight(takeoff) {
    const runwayIndex = getAvailableAirportRunway();
    if (runwayIndex === undefined)
        return false;
    const runway = airportRunways[runwayIndex];
    const startX = takeoff ? runway.x : runway.endX;
    const startY = takeoff ? runway.y : runway.endY;
    const endX = takeoff ? runway.endX : runway.x;
    const endY = takeoff ? runway.endY : runway.y;
    const length = Math.hypot(endX - startX, endY - startY);
    airportPlanes.push({
        x: startX, y: startY, startX, startY, endX, endY,
        runwayIndex,
        takeoff,
        progress: 0, duration: length / 690, hitTargets: new Set(),
    });
    showToast(tx(takeoff ? "飞机即将起飞！请避开正在使用的跑道。" : "飞机即将降落！请避开正在使用的跑道。"), "warning");
    return true;
}
function triggerMapEvent() {
    if (mapTheme === "hospital")
        spawnHospitalDoctors();
    else if (mapTheme === "music")
        spawnHarpFields();
    else if (mapTheme === "gym")
        spawnGymRushers();
    else
        spawnTrafficConvoy();
    randomEventTimer = (mapTheme === "hospital" || mapTheme === "music" || mapTheme === "gym" ? 31 : 34) +
        Math.random() * 13;
}
function updateSchoolClass(dt) {
    if (schoolClassDuration > 0) {
        schoolClassDuration = Math.max(0, schoolClassDuration - dt);
        if (schoolClassDuration === 0) {
            schoolClassTimer = 35 + Math.random() * 15;
            showToast(tx("下课了！全场单位恢复正常状态。"));
        }
        return;
    }
    schoolClassTimer = Math.max(0, schoolClassTimer - dt);
    if (schoolClassTimer === 0) {
        schoolClassDuration = 10;
        showToast(tx("上课时间到了！全场移速降低 60%、攻速和伤害降低 50%/20%，持续 10 秒。"), "warning");
    }
}
function updateAirportFlights(dt) {
    const interval = Math.max(0.18, 1.4 - wave * 0.16);
    if (airportPlanes.length < airportFlightsTarget) {
        airportFlightTimer -= dt;
        const nextTakeoff = shouldScheduleAirportTakeoff();
        if (airportFlightTimer <= 0 && startAirportFlight(nextTakeoff)) {
            airportNextFlightTakeoff = !airportNextFlightTakeoff;
            airportFlightTimer = interval;
        }
    }
    for (let index = airportPlanes.length - 1; index >= 0; index -= 1) {
        const plane = airportPlanes[index];
        const previousX = plane.x;
        const previousY = plane.y;
        plane.progress = Math.min(1, plane.progress + dt / plane.duration);
        plane.x = plane.startX + (plane.endX - plane.startX) * plane.progress;
        plane.y = plane.startY + (plane.endY - plane.startY) * plane.progress;
        for (const target of getEventTargets()) {
            if (plane.hitTargets.has(target.id))
                continue;
            if (distanceToSegment(target.x, target.y, previousX, previousY, plane.x, plane.y) >
                38 + combatTargetRadius(target))
                continue;
            plane.hitTargets.add(target.id);
            const damage = 96 + Math.min(54, wave * 5);
            if (applyEventDamage(target, damage)) {
                applyKnockback(target, plane.startX - plane.endX, plane.startY - plane.endY, 230);
                addFloatingText(target.x, target.y - 50, tx(`飞机撞击 -${damage}`), "#ffe68a");
                spawnImpact(target.x, target.y, "#ffe68a");
                showToast(tx(`飞机撞击！受到 ${damage} 点重击并被强力击退。`), "warning");
            }
            break;
        }
        if (plane.progress >= 1)
            airportPlanes.splice(index, 1);
    }
}
function updateRandomMapEvents(dt) {
    if (config.duel || runEnded)
        return;
    if (mapTheme === "school") {
        updateSchoolClass(dt);
        return;
    }
    if (config.multiplayer || waveState !== "active")
        return;
    if (mapTheme === "airport") {
        updateAirportFlights(dt);
    }
    else {
        if (randomEventWarning > 0) {
            randomEventWarning = Math.max(0, randomEventWarning - dt);
            if (randomEventWarning === 0)
                triggerMapEvent();
        }
        else {
            randomEventTimer -= dt;
            if (randomEventTimer <= 0) {
                randomEventWarning = 3.5;
                const warning = mapTheme === "hospital"
                    ? "警报：麻醉医生正在赶来！注意躲避注射。"
                    : mapTheme === "music"
                        ? "音乐警报！竖琴即将坠落，请及时离开音场。"
                        : mapTheme === "gym"
                            ? "健身房警报！建筑里有肌肉壮汉正在集结。"
                            : "警报：道路车流即将冲出！离开闪烁车道。";
                showToast(tx(warning), "warning");
            }
        }
        if (mapTheme === "music")
            updateHarpFields(dt);
        if (mapTheme === "gym")
            updateGymRushers(dt);
    }
    for (let index = trafficCars.length - 1; index >= 0; index -= 1) {
        const car = trafficCars[index];
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        let hit = false;
        if (!car.hitTargets.has("player") &&
            Math.abs(car.x - player.x) < car.width / 2 + player.radius &&
            Math.abs(car.y - player.y) < car.height / 2 + player.radius) {
            car.hitTargets.add("player");
            const damage = 72 + Math.min(42, wave * 4);
            if (applyPlayerDamage(damage)) {
                statusEffects["眩晕"] = Math.max(statusEffects["眩晕"] || 0, 2.4);
                addFloatingText(player.x, player.y - 52, tx("车祸眩晕 2.4 秒"), "#ffdc63");
                showToast(tx(`车辆撞中你！受到 ${damage} 点重击并眩晕 2.4 秒。`), "warning");
            }
            hit = true;
        }
        if (!hit) {
            for (const enemy of enemies) {
                if (enemy.hp <= 0 || car.hitTargets.has(enemy.id || ""))
                    continue;
                const radius = enemy.kind === "brute" ? 25 : enemy.kind === "doctor" ? 18 : 20;
                if (Math.abs(car.x - enemy.x) < car.width / 2 + radius &&
                    Math.abs(car.y - enemy.y) < car.height / 2 + radius) {
                    car.hitTargets.add(enemy.id || "");
                    const damage = 105 + Math.min(65, wave * 6);
                    damageEnemyByNpc(enemy, damage);
                    enemy.effects["眩晕"] = Math.max(enemy.effects["眩晕"] || 0, 2.4);
                    addFloatingText(enemy.x, enemy.y - 36, tx("车辆撞击 · 眩晕 2.4 秒"), "#ffdc63");
                    hit = true;
                    break;
                }
            }
        }
        if (hit ||
            car.x < -180 || car.y < -180 || car.x > map.width + 180 || car.y > map.height + 180)
            trafficCars.splice(index, 1);
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
const pathCellSize = 64;
const pathColumns = Math.ceil(map.width / pathCellSize);
const pathRows = Math.ceil(map.height / pathCellSize);
function isEnemyPositionBlocked(x, y, radius = 24) {
    if (x < radius || y < radius || x > map.width - radius || y > map.height - radius)
        return true;
    return obstacles.some((obstacle) => {
        const nearestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.w));
        const nearestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.h));
        return (x - nearestX) ** 2 + (y - nearestY) ** 2 < radius ** 2;
    });
}
function findEnemyPath(startX, startY, targetX, targetY) {
    const cellCount = pathColumns * pathRows;
    const startColumn = Math.max(0, Math.min(pathColumns - 1, Math.floor(startX / pathCellSize)));
    const startRow = Math.max(0, Math.min(pathRows - 1, Math.floor(startY / pathCellSize)));
    let goalColumn = Math.max(0, Math.min(pathColumns - 1, Math.floor(targetX / pathCellSize)));
    let goalRow = Math.max(0, Math.min(pathRows - 1, Math.floor(targetY / pathCellSize)));
    const isBlockedCell = (column, row) => column < 0 || row < 0 || column >= pathColumns || row >= pathRows ||
        isEnemyPositionBlocked(column * pathCellSize + pathCellSize / 2, row * pathCellSize + pathCellSize / 2);
    if (isBlockedCell(goalColumn, goalRow)) {
        let foundGoal = false;
        for (let radius = 1; radius <= 4 && !foundGoal; radius += 1) {
            for (let y = -radius; y <= radius && !foundGoal; y += 1) {
                for (let x = -radius; x <= radius; x += 1) {
                    if (Math.max(Math.abs(x), Math.abs(y)) !== radius)
                        continue;
                    if (!isBlockedCell(goalColumn + x, goalRow + y)) {
                        goalColumn += x;
                        goalRow += y;
                        foundGoal = true;
                        break;
                    }
                }
            }
        }
        if (!foundGoal)
            return [];
    }
    const start = startRow * pathColumns + startColumn;
    const goal = goalRow * pathColumns + goalColumn;
    const previous = new Int32Array(cellCount);
    previous.fill(-1);
    const queue = new Int32Array(cellCount);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    previous[start] = start;
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < tail && previous[goal] === -1) {
        const current = queue[head++];
        const column = current % pathColumns;
        const row = Math.floor(current / pathColumns);
        for (const [dx, dy] of directions) {
            const nextColumn = column + dx;
            const nextRow = row + dy;
            if (isBlockedCell(nextColumn, nextRow))
                continue;
            const next = nextRow * pathColumns + nextColumn;
            if (previous[next] !== -1)
                continue;
            previous[next] = current;
            queue[tail++] = next;
        }
    }
    if (previous[goal] === -1)
        return [];
    const path = [];
    for (let cell = goal; cell !== start; cell = previous[cell]) {
        path.push({
            x: (cell % pathColumns) * pathCellSize + pathCellSize / 2,
            y: Math.floor(cell / pathColumns) * pathCellSize + pathCellSize / 2,
        });
    }
    path.reverse();
    return path;
}
function moveEnemyToward(enemy, target, distance, dt) {
    const directDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    let blockedAhead = false;
    const steps = Math.max(1, Math.ceil(Math.min(distance, directDistance) / 24));
    for (let step = 1; step <= steps; step += 1) {
        const fraction = step / steps;
        if (isEnemyPositionBlocked(enemy.x + (target.x - enemy.x) * fraction, enemy.y + (target.y - enemy.y) * fraction)) {
            blockedAhead = true;
            break;
        }
    }
    let destination = { x: target.x, y: target.y };
    if (blockedAhead) {
        const targetColumn = Math.floor(target.x / pathCellSize);
        const targetRow = Math.floor(target.y / pathCellSize);
        enemy.pathTimer = Math.max(0, (enemy.pathTimer || 0) - dt);
        if (!enemy.path || enemy.pathTimer <= 0 || enemy.pathTargetId !== target.id ||
            Math.floor((enemy.pathTargetX || 0) / pathCellSize) !== targetColumn ||
            Math.floor((enemy.pathTargetY || 0) / pathCellSize) !== targetRow) {
            enemy.path = findEnemyPath(enemy.x, enemy.y, target.x, target.y);
            enemy.pathIndex = 0;
            enemy.pathTimer = 0.65;
            enemy.pathTargetId = target.id;
            enemy.pathTargetX = target.x;
            enemy.pathTargetY = target.y;
        }
        const path = enemy.path || [];
        let pathIndex = enemy.pathIndex || 0;
        while (pathIndex < path.length && Math.hypot(path[pathIndex].x - enemy.x, path[pathIndex].y - enemy.y) < 16) {
            pathIndex += 1;
        }
        enemy.pathIndex = pathIndex;
        destination = path[pathIndex] || target;
    }
    else {
        enemy.path = undefined;
        enemy.pathIndex = 0;
        enemy.pathTimer = 0;
    }
    const dx = destination.x - enemy.x;
    const dy = destination.y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (!length)
        return;
    const travel = Math.min(distance, length);
    const nextX = enemy.x + dx / length * travel;
    const nextY = enemy.y + dy / length * travel;
    if (!isEnemyPositionBlocked(nextX, enemy.y))
        enemy.x = nextX;
    if (!isEnemyPositionBlocked(enemy.x, nextY))
        enemy.y = nextY;
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
    const experience = enemy.anesthetist ? 160 : enemy.kind === "brute" ? 30 : enemy.kind === "runner" ? 18 : 10;
    grantSkillExperience(experience, enemy.x, enemy.y);
}
function damageEnemyByNpc(enemy, damage) {
    if (enemy.hp <= 0)
        return;
    if (schoolClassDuration > 0)
        damage *= 0.8;
    const actualDamage = Math.min(enemy.hp, Math.max(1, Math.round(damage)));
    enemy.hp = Math.max(0, enemy.hp - actualDamage);
    addFloatingText(enemy.x, enemy.y - 28, `-${actualDamage}`, "#ffdc63");
    spawnImpact(enemy.x, enemy.y, "#ffdc63");
    if (enemy.hp <= 0) {
        if (enemy.duelBot)
            finishDuelRound(true);
        else if (!enemy.friendlySummon)
            addEnemyLoot(enemy);
    }
}
function getEnemyTarget(enemy) {
    if (enemy.effects["狂舞"] > 0) {
        const otherEnemy = enemies
            .filter((candidate) => candidate !== enemy && !candidate.friendlySummon && candidate.hp > 0)
            .sort((left, right) => Math.hypot(left.x - enemy.x, left.y - enemy.y) -
            Math.hypot(right.x - enemy.x, right.y - enemy.y))[0];
        const target = otherEnemy || enemy;
        return {
            id: target.id || `enemy-${enemies.indexOf(target)}`,
            x: target.x,
            y: target.y,
            player: false,
            unit: target,
        };
    }
    const candidates = [];
    if (!enemy.anesthetist || !anesthetizedTargets.has("player")) {
        candidates.push({ id: "player", x: player.x, y: player.y, player: true });
    }
    enemies.forEach((candidate) => {
        if (candidate === enemy || candidate.hp <= 0)
            return;
        if (enemy.anesthetist) {
            if (candidate.anesthetist || anesthetizedTargets.has(candidate.id || ""))
                return;
        }
        else if (!candidate.anesthetist && !candidate.friendlySummon) {
            return;
        }
        candidates.push({
            id: candidate.id || `enemy-${enemies.indexOf(candidate)}`,
            x: candidate.x,
            y: candidate.y,
            player: false,
            unit: candidate,
        });
    });
    pipaMinions.forEach((minion, index) => {
        if (minion.hp <= 0)
            return;
        candidates.push({
            id: minion.id || `pipa-minion-${index}`,
            x: minion.x,
            y: minion.y,
            player: false,
            unit: minion,
        });
    });
    if (!candidates.length)
        return undefined;
    candidates.sort((left, right) => {
        const leftDistance = Math.hypot(left.x - enemy.x, left.y - enemy.y) *
            (!enemy.anesthetist && left.unit?.anesthetist ? 0.65 : 1);
        const rightDistance = Math.hypot(right.x - enemy.x, right.y - enemy.y) *
            (!enemy.anesthetist && right.unit?.anesthetist ? 0.65 : 1);
        return leftDistance - rightDistance;
    });
    return candidates[0];
}
function attackEnemyTarget(attacker, target) {
    if (target.player) {
        const landed = applyPlayerDamage(attacker.attack, attacker);
        if (landed && attacker.anesthetist && !anesthetizedTargets.has(target.id)) {
            anesthetizedTargets.add(target.id);
            statusEffects["眩晕"] = Math.max(statusEffects["眩晕"] || 0, 2);
            addFloatingText(player.x, player.y - 54, tx("麻药注射 · 眩晕 2 秒"), "#f5f7ff");
            showToast(tx("麻醉医生给你注射麻药：眩晕 2 秒！之后医生不会再追击你。"), "warning");
        }
        return;
    }
    const victim = target.unit;
    if (!victim)
        return;
    damageEnemyByNpc(victim, attacker.attack);
    if (attacker.anesthetist && !anesthetizedTargets.has(target.id)) {
        anesthetizedTargets.add(target.id);
        victim.effects["眩晕"] = Math.max(victim.effects["眩晕"] || 0, 2);
        addFloatingText(victim.x, victim.y - 42, tx("麻药注射 · 眩晕 2 秒"), "#f5f7ff");
    }
}
function hitEnemy(enemy, damage, effect = "", effectTurns = 0) {
    if (enemy.hp <= 0)
        return 0;
    if (schoolClassDuration > 0)
        damage *= 0.8;
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
    return actualDamage;
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
        return false;
    }
    if (Math.random() < playerState.dodgeChance) {
        addFloatingText(player.x, player.y - 34, "闪避", "#8c9aff");
        return false;
    }
    if (schoolClassDuration > 0)
        damage *= 0.8;
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
    if (thornArmor && attacker) {
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
    return true;
}
function updateDuelBot(bot, dt) {
    if (!duelRoundActive || bot.hp <= 0)
        return;
    const distance = distanceTo(bot.x, bot.y);
    const rangeByAccent = { tech: 330, blue: 300, green: 150, pipa: 200, pink: 95 };
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
    else if (skill.action === "pipa_yangchun") {
        const range = skill.cast_range || 420;
        const targetCount = skill.target_count || 3;
        const victims = enemies
            .filter((enemy) => enemy.hp > 0 && distanceTo(enemy.x, enemy.y) <= range)
            .sort((left, right) => distanceTo(left.x, left.y) - distanceTo(right.x, right.y))
            .slice(0, targetCount);
        const pvpVictims = remotePlayersInRange(range)
            .sort((left, right) => distanceTo(left.x, left.y) - distanceTo(right.x, right.y))
            .slice(0, targetCount);
        const rootDuration = skill.effect_turns;
        let damageDealt = 0;
        victims.forEach((enemy) => {
            addSkillVisual(skill, enemy);
            damageDealt += hitEnemy(enemy, skill.damage, "禁锢", rootDuration);
        });
        queuePvpAttack("skill", pvpVictims, skill.id);
        const healed = Math.min(playerState.maxHp - playerState.hp, Math.floor(damageDealt * 0.2));
        if (healed > 0) {
            playerState.hp += healed;
            addFloatingText(player.x, player.y - 42, `+${healed}`, "#9cff65");
            updateHud();
        }
        if (!victims.length && !pvpVictims.length) {
            showToast(`${skill.name}未命中：周围 ${range} 距离内没有敌人。`, "warning");
        }
        else {
            showToast(`${skill.name}命中 ${victims.length + pvpVictims.length} 个敌人，禁锢 ${rootDuration} 秒并回复 ${healed} 点生命。`);
        }
    }
    else if (skill.action === "pipa_shimian") {
        const spawned = spawnPipaMinions();
        addSkillVisual(skill);
        showToast(`${skill.name}召出 ${spawned} 名小兵，开始追击敌人。`);
    }
    else if (skill.action === "pipa_kinsnake") {
        const radius = skill.radius || 360;
        const victims = enemies
            .filter((enemy) => enemy.hp > 0 && distanceTo(enemy.x, enemy.y) <= radius)
            .sort((left, right) => right.hp - left.hp)
            .slice(0, 3);
        const pvpVictims = nearbyPvpTargets(player.x, player.y, radius)
            .sort((left, right) => right.hp - left.hp)
            .slice(0, 3);
        const frenzyDuration = (config.duel || config.multiplayer ? 2 : 5) +
            (skill.frenzy_duration_bonus || 0);
        victims.forEach((enemy) => {
            hitEnemy(enemy, skill.damage, "狂舞", frenzyDuration);
            skillVisuals.push({
                type: "aura", x: enemy.x, y: enemy.y, targetX: enemy.x, targetY: enemy.y,
                age: 0, duration: 0.72, color: "#f1b95b",
            });
        });
        queuePvpAttack("skill", pvpVictims, skill.id);
        addSkillVisual(skill);
        showToast(`${skill.name}命中 ${victims.length + pvpVictims.length} 个高生命敌人，${frenzyDuration} 秒内陷入狂舞。`);
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
    return locale.battle.effects[effect] || effect;
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
    const range = getPlayerAttackRange();
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
        showToast(`普攻未命中：${config.accent === "tech" ? "将敌人保持在 330" : config.accent === "blue" ? "将敌人保持在 300" : config.accent === "green" ? "将敌人保持在 150" : config.accent === "pipa" ? "将敌人保持在 200" : "靠近敌人至 95"} 距离内再攻击。`, "warning");
        return;
    }
    basicAttackTimer = getBasicAttackCooldown();
    const wasEmpowered = empoweredAttack;
    const empoweredSkill = config.skills.find((skill) => skill.action === "empower_attack");
    const damage = wasEmpowered
        ? empoweredSkill?.empowered_damage || 34
        : config.accent === "tech" ? 14 : config.accent === "green" ? 12 : config.accent === "blue" ? 15 : config.accent === "pipa" ? 13 : 16;
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
                    : config.accent === "pipa"
                        ? `琵琶音刃命中，造成 ${damage} 点伤害。`
                        : `普攻命中，造成 ${damage} 点伤害，回复 5 点能量。`);
    updateHud();
}
function getPlayerAttackRange() {
    if (config.accent === "pipa")
        return 200;
    if (config.accent === "tech")
        return 330;
    if (config.accent === "blue")
        return 300;
    if (config.accent === "green")
        return 150;
    return 95;
}
function spawnPipaMinions() {
    let spawned = 0;
    const skill = config.skills.find((item) => item.action === "pipa_shimian");
    const count = skill?.minion_count || 5;
    const hp = Math.round(15 * (skill?.minion_hp_multiplier || 1) + skillExperienceLevel * 2 + wave * 2);
    for (let index = 0; index < count; index += 1) {
        const angle = Math.PI * 2 * index / count;
        let x = player.x + Math.cos(angle) * 62;
        let y = player.y + Math.sin(angle) * 62;
        if (isEnemyPositionBlocked(x, y, 14)) {
            x = player.x;
            y = player.y;
            for (let attempt = 0; attempt < 8 && isEnemyPositionBlocked(x, y, 14); attempt += 1) {
                const fallbackAngle = angle + attempt * Math.PI / 4;
                x = player.x + Math.cos(fallbackAngle) * 78;
                y = player.y + Math.sin(fallbackAngle) * 78;
            }
        }
        if (isEnemyPositionBlocked(x, y, 14))
            continue;
        pipaMinions.push({
            id: `pipa-${eventSerial++}`,
            x,
            y,
            hp,
            maxHp: hp,
            attackTimer: 0.4 + Math.random() * 0.4,
            attack: 12,
            speed: 188,
            kind: "runner",
            poisonDamage: 0,
            poisonTimer: 0,
            effects: {},
            experienceAwarded: false,
            friendlySummon: true,
        });
        spawned += 1;
    }
    return spawned;
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
    basicAttackTimer = Math.max(0, basicAttackTimer - dt * (schoolClassDuration > 0 ? 0.5 : 1));
    if (hasPlayerEffect("狂舞")) {
        pipaFrenzyAttackTimer = Math.max(0, pipaFrenzyAttackTimer - dt * pipaFrenzyAttackSpeedMultiplier());
        if (pipaFrenzyAttackTimer === 0) {
            queuePvpSelfAttack();
            pipaFrenzyAttackTimer = 0.65;
        }
    }
    else {
        pipaFrenzyAttackTimer = 0;
    }
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
    updateRandomMapEvents(dt);
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
        if (enemy.anesthetist && enemy.lifeTimer !== undefined) {
            enemy.lifeTimer -= dt;
            if (enemy.lifeTimer <= 0) {
                enemy.hp = 0;
                addFloatingText(enemy.x, enemy.y - 28, tx("医生撤离"), "#c9f4ff");
                return;
            }
        }
        if (enemy.poisonDamage > 0) {
            enemy.poisonTimer -= dt;
            if (enemy.poisonTimer <= 0) {
                enemy.poisonTimer = 1;
                const damage = schoolClassDuration > 0 ? enemy.poisonDamage * 0.8 : enemy.poisonDamage;
                const poisonDamage = Math.min(enemy.hp, damage);
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
        if (enemy.gymRusher)
            return;
        if (enemy.duelBot) {
            if (enemy.effects["狂舞"] > 0)
                updateDuelBotFrenzy(enemy, dt);
            else
                updateDuelBot(enemy, dt);
            return;
        }
        const target = getEnemyTarget(enemy);
        if (!target)
            return;
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        const attackRange = enemy.anesthetist ? 54 : enemy.kind === "brute" ? 70 : 48;
        if (distance > attackRange && !enemy.effects["禁锢"] && !enemy.effects["眩晕"]) {
            const speed = enemy.speed * (enemy.effects["强力减速"] ? 0.4 : enemy.effects["减速"] ? 0.45 : 1) *
                (schoolClassDuration > 0 ? 0.4 : 1) * dt;
            moveEnemyToward(enemy, target, speed, dt);
        }
        const frenzySpeed = enemy.effects["狂舞"] > 0 ? pipaFrenzyAttackSpeedMultiplier() : 1;
        enemy.attackTimer = Math.max(0, enemy.attackTimer - dt * (schoolClassDuration > 0 ? 0.5 : 1) * frenzySpeed);
        if (distance < attackRange && enemy.attackTimer === 0 && !enemy.effects["眩晕"]) {
            enemy.attackTimer = enemy.anesthetist ? 1.3 : enemy.kind === "runner" ? 1.05 : 1.35;
            attackEnemyTarget(enemy, target);
        }
    });
    updatePipaMinions(dt);
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
    drawEffectIndicators(0, -56, statusEffects);
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
        drawEffectIndicators(0, 48, remote.effects);
        context.restore();
    });
    if (config.multiplayer) {
        peerList.hidden = remotePlayers.size === 0;
        peerList.textContent = remotePlayers.size
            ? tx(`同局玩家 ${remotePlayers.size} 人：${[...remotePlayers.values()].map((item) => item.name).join("、")}`)
            : tx("等待其他玩家同步位置…");
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
                if (effect === "眩晕" || effect === "禁锢" || effect === "狂舞")
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
    if (mapTheme === "airport") {
        miniContext.strokeStyle = "#8ea6a9";
        miniContext.lineWidth = 1;
        airportRunways.forEach((runway) => {
            miniContext.beginPath();
            miniContext.moveTo(runway.x * sx, runway.y * sy);
            miniContext.lineTo(runway.endX * sx, runway.endY * sy);
            miniContext.stroke();
        });
    }
    miniContext.fillStyle = "#7d8797";
    obstacles.forEach((item) => miniContext.fillRect(item.x * sx, item.y * sy, item.w * sx, item.h * sy));
    miniContext.fillStyle = "#ffca62";
    supplies.filter((supply) => !supply.collected).forEach((supply) => {
        miniContext.fillRect(supply.x * sx - 1, supply.y * sy - 1, 3, 3);
    });
    enemies.filter((enemy) => enemy.hp > 0 && !enemy.gymRusher).forEach((enemy) => {
        miniContext.fillStyle = enemy.anesthetist ? "#82f2e8" : "#ff637c";
        miniContext.fillRect(enemy.x * sx - (enemy.anesthetist ? 2 : 1), enemy.y * sy - (enemy.anesthetist ? 2 : 1), enemy.anesthetist ? 5 : 3, enemy.anesthetist ? 5 : 3);
    });
    trafficCars.forEach((car) => {
        miniContext.fillStyle = "#ffe45c";
        miniContext.fillRect(car.x * sx - 2, car.y * sy - 2, 5, 5);
    });
    harpFields.forEach((harp) => {
        miniContext.fillStyle = "#e99cff";
        miniContext.fillRect(harp.x * sx - 2, harp.y * sy - 2, 4, 4);
    });
    gymRushers.forEach((rusher) => {
        if (rusher.hp <= 0)
            return;
        miniContext.fillStyle = "#ff795d";
        miniContext.fillRect(rusher.x * sx - 2, rusher.y * sy - 2, 4, 4);
    });
    airportPlanes.forEach((plane) => {
        miniContext.fillStyle = "#fff1a3";
        miniContext.fillRect(plane.x * sx - 2, plane.y * sy - 2, 4, 4);
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
    if (!mapTransitionComplete && mapTransition) {
        const elapsed = performance.now() - mapTransitionStartedAt;
        if (elapsed >= 4250 && !mapTransitionLeaving) {
            mapTransitionLeaving = true;
            mapTransition.classList.add("leaving");
            mapTransitionFallbackTimer = window.setTimeout(finishMapTransition, 1000);
        }
    }
    const dt = Math.min((timestamp - (lastFrameTime || timestamp)) / 1000, 0.04);
    lastFrameTime = timestamp;
    if (mapTransitionComplete)
        updateDuelBreak(dt);
    if (mapTransitionComplete && !runEnded && !skillIsPaused()) {
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
            ((statusEffects["强力减速"] || 0) > 0 ? 0.4 : (statusEffects["减速"] || 0) > 0 ? 0.55 : 1) *
            (schoolClassDuration > 0 ? 0.4 : 1);
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
    if (!mapTransitionComplete) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }
}, true);
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
window.addEventListener("blur", () => {
    keys.clear();
    touchKeys.clear();
});
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
touchModeToggle.addEventListener("click", () => {
    const enabled = document.body.classList.toggle("touch-mode-active");
    touchModeToggle.setAttribute("aria-pressed", String(enabled));
    if (!enabled)
        touchKeys.clear();
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
    mapMode.textContent = tx(`局域网房间 ${config.multiplayer.room_id}`);
    peerList.hidden = false;
}
if (config.duel) {
    mapMode.textContent = tx("人机对抗");
    startDuelRound();
    showToast(tx("人机对抗开始！先赢下 4 分获胜，SPACE 普攻，Q / E / R 释放技能。"));
}
else {
    mapMode.textContent = tx(mapTheme === "hospital" ? "赛博医院"
        : mapTheme === "music" ? "赛博琴房"
            : mapTheme === "gym" ? "赛博体育馆"
                : mapTheme === "airport" ? "赛博机场" : "霓虹城区");
    showToast(tx("探索提示：靠近闪光物资后按 F 收集；Q / E / R 释放技能。"));
}
drawMap();
requestAnimationFrame(drawFrame);
