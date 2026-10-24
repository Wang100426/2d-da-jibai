/**
 * 剧情战斗波次的纯逻辑测试（node:test，无第三方依赖）。
 *
 * 运行：npm run test:story-wave
 * 依赖：build/story_wave.js（npm run build:story-wave 生成，不提交）
 * 数据：tests/fixtures/chapters.zh.json（story_script.py 导出的真实剧情）
 *
 * 这些断言验证的是**会真的影响战斗**的数值：波次展开、敌人面板、技能归一化。
 * 只要这里的数值变了，战斗手感就一定变了。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "..", "build", "story_wave.js");
if (!fs.existsSync(modulePath)) {
  throw new Error("缺少 build/story_wave.js，请先运行 npm run build:story-wave");
}

const code = fs.readFileSync(modulePath, "utf8");
vm.runInThisContext(`${code}
globalThis.__storyWave = {
  expandStoryWave, storyEnemyStats, storyEnemyKind, storyWaveTarget, storyWaveAt,
  normalizeStorySkill, storySkillFor, normalizeStoryHazard,
};`);
const {
  expandStoryWave, storyEnemyStats, storyEnemyKind, storyWaveTarget, storyWaveAt,
  normalizeStorySkill, storySkillFor, normalizeStoryHazard,
} = globalThis.__storyWave;

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "chapters.zh.json"), "utf8"),
);
const battleNodes = fixture.sections.flatMap((section) =>
  (section.nodes || []).filter((node) => node.type === "battle").map((node) => ({ section, node })),
);

const tech = { speed: 235, basic_damage: 14, basic_range: 330, defense: 58 };
const moss = { speed: 235, basic_damage: 12, basic_range: 150, defense: 94 };
const volt = { speed: 235, basic_damage: 16, basic_range: 95, defense: 58 };

test("波次展开：按 count 逐只生成", () => {
  const queue = expandStoryWave({ enemies: [
    { hero: "tech", count: 2, hp_scale: 1.6 },
    { hero: "moss", count: 1, armor: 0.2 },
  ] });
  assert.equal(queue.length, 3);
  assert.deepEqual(queue.map((item) => item.hero), ["tech", "tech", "moss"]);
  assert.equal(queue[0].hp_scale, 1.6, "倍率必须带到每一只");
  assert.equal(queue[2].armor, 0.2);
  assert.equal(queue[0].count, 1, "展开后每只都是 1，避免再次按组生成");
});

test("波次展开：单组上限 8、单波上限 24", () => {
  assert.equal(expandStoryWave({ enemies: [{ hero: "tech", count: 99 }] }).length, 8);
  const heavy = expandStoryWave({ enemies: Array.from({ length: 6 }, () => ({ hero: "tech", count: 8 })) });
  assert.equal(heavy.length, 24, "总量应被夹在 24 只");
});

test("波次展开：非法条目被跳过而不是抛错", () => {
  const queue = expandStoryWave({ enemies: [
    { hero: "", count: 2 },
    { count: 3 },
    { hero: "volt", count: 0 },
    null,
    { hero: "tech", count: 1 },
  ] });
  assert.equal(queue.length, 2, "count 0 会被夹到 1，空 hero 与 null 直接丢弃");
  assert.equal(queue[0].hero, "volt");
  assert.equal(queue[1].hero, "tech");
  assert.equal(expandStoryWave(undefined).length, 0);
  assert.equal(expandStoryWave({}).length, 0);
});

test("敌人数值：血量按倍率放大并夹在安全区间", () => {
  const normal = storyEnemyStats({ hero: "tech", count: 1, hp_scale: 1 }, tech);
  const heavy = storyEnemyStats({ hero: "tech", count: 1, hp_scale: 2 }, tech);
  assert.equal(heavy.hp, normal.hp * 2);
  const absurd = storyEnemyStats({ hero: "tech", count: 1, hp_scale: 999 }, tech);
  assert.ok(absurd.hp <= 6000, `血量上限失效：${absurd.hp}`);
});

test("敌人数值：远程/近战/厚甲自动选体型", () => {
  assert.equal(storyEnemyKind({ hero: "tech", count: 1 }, tech), "grunt", "射程 330 应为远程杂兵");
  assert.equal(storyEnemyKind({ hero: "jianghu", count: 1 }, { basic_range: 150, defense: 54 }), "runner");
  assert.equal(storyEnemyKind({ hero: "volt", count: 1 }, volt), "brute", "近战应为重装");
  assert.equal(storyEnemyKind({ hero: "moss", count: 1 }, moss), "brute", "高防御优先按厚甲处理");
  assert.equal(storyEnemyKind({ hero: "tech", count: 1, kind: "runner" }, tech), "runner", "显式 kind 优先");
});

test("敌人数值：攻击力跟随英雄基础伤害与倍率", () => {
  const base = storyEnemyStats({ hero: "tech", count: 1 }, tech);
  const strong = storyEnemyStats({ hero: "tech", count: 1, damage_scale: 1.5 }, tech);
  assert.ok(strong.attack > base.attack, `伤害倍率未生效：${base.attack} -> ${strong.attack}`);
  assert.ok(base.attack >= 3 && base.attack <= 150, `攻击力越界：${base.attack}`);
  const weak = storyEnemyStats({ hero: "tech", count: 1, damage_scale: 0.01 }, tech);
  assert.ok(weak.attack >= 3, "攻击力不应被压到 0");
});

test("敌人数值：移速与护甲都被限制在合理范围", () => {
  const fast = storyEnemyStats({ hero: "tech", count: 1, speed_scale: 99 }, tech);
  assert.ok(fast.speed <= 120, `移速上限失效：${fast.speed}`);
  const slow = storyEnemyStats({ hero: "tech", count: 1, speed_scale: 0.01 }, tech);
  assert.ok(slow.speed >= 26, `移速下限失效：${slow.speed}`);
  assert.equal(storyEnemyStats({ hero: "tech", count: 1, armor: 5 }, tech).armor, 0.6, "护甲应夹到 0.6");
  assert.equal(storyEnemyStats({ hero: "tech", count: 1, armor: -1 }, tech).armor, 0, "负护甲归零");
});

test("波次目标：有结构化波次时以真实波次为准", () => {
  const waves = [{ enemies: [{ hero: "tech", count: 1 }] }, { enemies: [{ hero: "moss", count: 1 }] }];
  assert.equal(storyWaveTarget(waves, 5), 2, "声明 5 波但只配了 2 波，应只打 2 波");
  assert.equal(storyWaveTarget([], 3), 3, "没有结构化波次时退回声明值");
  assert.equal(storyWaveTarget([], 0), 1, "声明值非法时至少 1 波");
  assert.equal(storyWaveTarget(Array.from({ length: 30 }, () => ({ enemies: [] })), 30), 12);
});

test("波次取值：1 起算，越界回落到首/末波", () => {
  const waves = [
    { label: "一", enemies: [{ hero: "tech", count: 1 }] },
    { label: "二", enemies: [{ hero: "moss", count: 1 }] },
  ];
  assert.equal(storyWaveAt(waves, 1).label, "一");
  assert.equal(storyWaveAt(waves, 2).label, "二");
  assert.equal(storyWaveAt(waves, 9).label, "二");
  assert.equal(storyWaveAt(waves, 0).label, "一");
  assert.equal(storyWaveAt([], 1), null);
});

test("技能归一化：缺省值与越界值都被夹住", () => {
  const blank = normalizeStorySkill({});
  assert.equal(blank.damage, 0);
  assert.equal(blank.cooldown, 8);
  assert.equal(blank.radius, 150);
  const wild = normalizeStorySkill({ damage: -20, cooldown: 0.1, radius: 9999, effect_turns: 99 });
  assert.equal(wild.damage, 0, "负伤害归零");
  assert.ok(wild.cooldown >= 2, `冷却下限失效：${wild.cooldown}`);
  assert.ok(wild.radius <= 420, `射程上限失效：${wild.radius}`);
  assert.ok(wild.effectTurns <= 10);
});

test("技能分配：多技能在敌人之间轮转", () => {
  const wave = { skills: [{ name: "甲" }, { name: "乙" }] };
  assert.equal(storySkillFor(wave, 0).name, "甲");
  assert.equal(storySkillFor(wave, 1).name, "乙");
  assert.equal(storySkillFor(wave, 2).name, "甲");
  assert.equal(storySkillFor({}, 0), null);
});

test("场地效果：非法配置视为没有", () => {
  assert.equal(normalizeStoryHazard(null), null);
  assert.equal(normalizeStoryHazard({ interval: 0, damage: 10 }), null);
  assert.equal(normalizeStoryHazard({ interval: 5, damage: 0 }), null);
  const valid = normalizeStoryHazard({ interval: 7, damage: 8, effect: "减速", effect_turns: 1 });
  assert.equal(valid.interval, 7);
  assert.equal(valid.damage, 8);
  assert.equal(valid.effect, "减速");
});

test("真实剧本：每个战斗节点都能展开出至少一只敌人", () => {
  assert.ok(battleNodes.length >= 5, `真实剧本战斗节点过少：${battleNodes.length}`);
  battleNodes.forEach(({ section, node }) => {
    const waves = node.waves || [];
    assert.ok(waves.length > 0, `${section.id}/${node.id} 没有结构化波次`);
    assert.equal(waves.length, node.battle.target_waves, `${node.id} 波次数与 target_waves 不一致`);
    waves.forEach((wave, index) => {
      assert.ok(expandStoryWave(wave).length > 0, `${node.id} 第 ${index + 1} 波展开为空`);
      assert.ok((wave.label || "").length > 0, `${node.id} 第 ${index + 1} 波缺少本地化标签`);
    });
  });
});

test("真实剧本：RC-001 序幕两波的敌人与技能对得上文案", () => {
  const target = battleNodes.find(({ node }) => node.id === "p0-battle");
  assert.ok(target, "找不到 RC-001 序幕战斗节点");
  const [first, second] = target.node.waves;
  assert.equal(expandStoryWave(first).length, 2, "第一波应为 2 只维修机器人");
  assert.equal(expandStoryWave(second).length, 2, "第二波应为维护核 + 装甲外壳");
  assert.ok(first.enemies.some((enemy) => enemy.hero === "tech"));
  assert.equal(first.skills[0].name, "扳手横扫", "技能名应来自 locale");
  assert.ok(second.hazard && second.hazard.damage > 0, "第二波应带场地放电效果");
});
