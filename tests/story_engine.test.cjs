/**
 * 剧情引擎关键流程测试（node:test，无第三方依赖）。
 *
 * 运行：npm run test:story
 * 依赖：build/story_engine.js（npm run build:story-engine 生成，不提交）
 * 数据：tests/fixtures/chapters.zh.json（由 story_script.py 导出的真实内容）
 *
 * 测试按「节点类型」而不是硬编码 id 定位，章节改结构时只需保证节点齐全。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const enginePath = path.join(__dirname, "..", "build", "story_engine.js");
if (!fs.existsSync(enginePath)) {
  throw new Error("缺少 build/story_engine.js，请先运行 npm run build:story-engine");
}

const engineCode = fs.readFileSync(enginePath, "utf8");
vm.runInThisContext(`${engineCode}\nglobalThis.__StoryEngine = StoryEngine;`);
const StoryEngine = globalThis.__StoryEngine;
assert.equal(typeof StoryEngine, "function", "StoryEngine 未正确导出");

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "chapters.zh.json"), "utf8"),
);
const sections = fixture.sections;
const cards = fixture.cards;
const byId = Object.fromEntries(sections.map((section) => [section.id, section]));

const p0 = byId["rc001-p0"];      // 序幕：对话 / 分支 / 战斗 / 奖励 / 结束
const p1 = byId["rc001-p1"];      // 第一幕：带真正阻塞的 objective
const p3 = byId["rc001-p3"];      // 终幕：三波战斗 + 双结局
const heroSection = byId["hero-volt-01"];

assert.ok(p0 && p1 && p3 && heroSection, "fixture 缺少 RC-001 分区");

const clone = (value) => JSON.parse(JSON.stringify(value));
const nodeOf = (section, type) => section.nodes.find((node) => node.type === type);
const nodesOf = (section, type) => section.nodes.filter((node) => node.type === type);

const p0Intro = nodesOf(p0, "dialogue")[0];
const p0Choice = nodeOf(p0, "choice");
const p0Battle = nodeOf(p0, "battle");
const p0Reward = nodeOf(p0, "reward");
const p1Objective = nodeOf(p1, "objective");

/* ---------- 结构与校验 ---------- */

test("全部真实分区通过校验并以 entry 开场", () => {
  for (const section of sections) {
    const engine = new StoryEngine(clone(section));
    assert.equal(engine.isValid, true, `${section.id} 校验失败：${JSON.stringify(engine.issues)}`);
    assert.equal(engine.currentNode().id, section.entry);
  }
});

test("RC-001 有四个分区且按顺序排列", () => {
  const card = cards.find((item) => item.id === "RC-001");
  assert.ok(card, "缺少 RC-001");
  assert.deepEqual(
    card.sections.map((section) => section.id),
    ["rc001-p0", "rc001-p1", "rc001-p2", "rc001-p3"],
  );
});

test("初始只有第一个分区解锁，其余锁定", () => {
  const card = cards.find((item) => item.id === "RC-001");
  assert.equal(card.sections[0].locked, false);
  assert.equal(card.sections[1].locked, true);
  assert.equal(card.sections[2].locked, true);
  assert.equal(card.sections[3].locked, true);
});

test("英雄剧情的分区是解锁状态", () => {
  const card = cards.find((item) => item.id === "RC-H01");
  assert.equal(card.sections[0].locked, false);
  assert.equal(card.sections[0].hero, "volt");
});

/* ---------- 节点跳转 ---------- */

test("对话框按 next 推进", () => {
  const engine = new StoryEngine(clone(p0));
  const first = engine.currentNode();
  assert.equal(first.type, "dialogue");
  const step = engine.goTo(first.next);
  assert.equal(step.ok, true);
  assert.equal(step.node.id, p0Intro.next);
});

test("分支选择记录选择并跳转", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Choice.id });
  const option = p0Choice.options[1];
  const step = engine.choose(1);
  assert.equal(step.ok, true);
  assert.equal(step.node.id, option.next);
  assert.equal(engine.progress.choices[p0Choice.id], option.id);
});

test("无效节点跳转被拒绝且不改变当前状态", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Intro.id });
  const step = engine.goTo("does-not-exist");
  assert.equal(step.ok, false);
  assert.equal(step.error.code, "unknown_node");
  assert.equal(engine.currentNode().id, p0Intro.id);
});

/* ---------- 战斗胜负 ---------- */

test("战斗胜利走 on_win", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Battle.id });
  const step = engine.applyBattleResult("win");
  assert.equal(step.ok, true);
  assert.equal(step.node.id, p0Battle.on_win);
  assert.equal(engine.progress.flags[`battle:${p0Battle.id}`], true);
});

test("战斗失败回到重试节点", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Battle.id });
  const step = engine.applyBattleResult("lose");
  assert.equal(step.ok, true);
  assert.equal(step.node.id, p0Battle.on_lose);
  assert.equal(engine.progress.flags[`battle:${p0Battle.id}`], undefined);
});

test("失败后重试可以打赢", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Battle.id });
  engine.applyBattleResult("lose");
  assert.equal(engine.currentNode().id, p0Battle.id);
  const retry = engine.applyBattleResult("win");
  assert.equal(retry.ok, true);
  assert.equal(retry.node.id, p0Battle.on_win);
});

test("终幕战斗是三波", () => {
  assert.equal(nodeOf(p3, "battle").battle.target_waves, 3);
});

test("非战斗节点收到战斗结果会报错", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Intro.id });
  const step = engine.applyBattleResult("win");
  assert.equal(step.ok, false);
  assert.equal(step.error.code, "wrong_node_type");
});

/* ---------- 存档恢复 ---------- */

test("存档恢复节点、选择、目标与 flags", () => {
  const engine = new StoryEngine(clone(p1));
  engine.goTo(nodeOf(p1, "choice").id);
  engine.choose(0);
  engine.setObjective(p1Objective.goals[0].id, true);
  const snapshot = engine.snapshot();

  const restored = new StoryEngine(clone(p1), snapshot);
  assert.equal(restored.progress.node, snapshot.node);
  assert.equal(restored.progress.choices[nodeOf(p1, "choice").id], "scan");
  assert.equal(restored.progress.objectives[p1Objective.goals[0].id], true);
  assert.equal(restored.progress.flags[p1Objective.goals[0].done_flag], true);
});

test("坏存档回退到 entry 且不抛错", () => {
  const engine = new StoryEngine(clone(p0), { node: "ghost-node", flags: "not-an-object" });
  assert.equal(engine.currentNode().id, p0.entry);
  assert.deepEqual(engine.progress.flags, {});
  assert.deepEqual(engine.progress.claimed_rewards, []);
});

test("旧存档：只有 node 字段也能恢复", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Choice.id });
  assert.equal(engine.currentNode().id, p0Choice.id);
  assert.deepEqual(engine.progress.choices, {});
});

test("旧存档：结构不符回退到 entry", () => {
  const engine = new StoryEngine(clone(p0), { version: 0, chapters: { "rc001-p0": { node: p0Choice.id } } });
  assert.equal(engine.currentNode().id, p0.entry);
});

test("旧存档：字段类型全错也不抛错", () => {
  const engine = new StoryEngine(clone(p0), {
    node: 42,
    flags: ["a", "b"],
    objectives: "nope",
    choices: 1,
    claimed_rewards: ["ok", 3, null],
  });
  assert.equal(engine.currentNode().id, p0.entry);
  assert.deepEqual(engine.progress.flags, {});
  assert.deepEqual(engine.progress.claimed_rewards, ["ok"]);
});

/* ---------- 完成状态不能被复活 ---------- */

test("已完成分区重新进入仍保持完成", () => {
  const engine = new StoryEngine(clone(p0), { node: nodeOf(p0, "chapter_end").id, completed: true });
  assert.equal(engine.isCompleted(), true);
  const again = new StoryEngine(clone(p0), engine.snapshot());
  assert.equal(again.isCompleted(), true);
});

test("节点被删除后回退 entry，但已完成标记保留", () => {
  const engine = new StoryEngine(clone(p0), { node: "removed-node", completed: true });
  assert.equal(engine.currentNode().id, p0.entry);
  assert.equal(engine.isCompleted(), true);
});

test("完成 + 已领奖励的存档重进不会复活奖励", () => {
  const engine = new StoryEngine(clone(p0), {
    node: nodeOf(p0, "chapter_end").id,
    completed: true,
    claimed_rewards: [p0Reward.reward_id],
  });
  assert.equal(engine.isCompleted(), true);
  engine.goTo(p0Reward.id);
  assert.equal(engine.pendingReward(), null);
});

/* ---------- 奖励防重 ---------- */

test("奖励只能领取一次", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Reward.id });
  const pending = engine.pendingReward();
  assert.equal(pending.reward_id, p0Reward.reward_id);
  assert.equal(engine.markRewardClaimed(pending.reward_id), true);
  assert.equal(engine.pendingReward(), null);
  assert.equal(engine.markRewardClaimed(pending.reward_id), false);

  const restored = new StoryEngine(clone(p0), engine.snapshot());
  assert.equal(restored.pendingReward(), null);
});

test("领奖后离开再回来不会重复", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Reward.id });
  const reward = engine.pendingReward();
  engine.markRewardClaimed(reward.reward_id);
  engine.goTo(nodeOf(p0, "chapter_end").id);
  engine.goTo(p0Reward.id);
  assert.equal(engine.pendingReward(), null);
  assert.equal(
    engine.progress.claimed_rewards.filter((id) => id === reward.reward_id).length,
    1,
  );
});

test("双重结局各自有独立 reward_id", () => {
  const rewards = nodesOf(p3, "reward").map((node) => node.reward_id);
  assert.equal(new Set(rewards).size, rewards.length, "两个结局不能共用 reward_id");
});

/* ---------- objective ---------- */

test("objective 未完成时阻塞", () => {
  assert.equal(p1Objective.allow_skip, false);
  const engine = new StoryEngine(clone(p1), { node: p1Objective.id });
  assert.equal(engine.canLeaveObjective(), false);
  engine.setObjective(p1Objective.goals[0].id, true);
  assert.equal(engine.canLeaveObjective(), false, "只完成一个目标不应放行");
  engine.setObjective(p1Objective.goals[1].id, true);
  assert.equal(engine.canLeaveObjective(), true);
});

/* ---------- 校验器 ---------- */

test("battle 缺少分支会被校验拦下", () => {
  const broken = clone(p0);
  delete nodeOf(broken, "battle").on_win;
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "missing_config"));
});

test("battle 目标波次非法会被校验拦下", () => {
  const broken = clone(p0);
  nodeOf(broken, "battle").battle.target_waves = 0;
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "missing_config"));
});

test("跳转到不存在的节点会被校验拦下", () => {
  const broken = clone(p0);
  nodesOf(broken, "dialogue")[0].next = "nowhere";
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "invalid_transition"));
});

test("重复节点 id 会被校验拦下", () => {
  const broken = clone(p0);
  broken.nodes.push({ ...broken.nodes[0] });
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "duplicate_node"));
});

test("entry 指向不存在的节点会被校验拦下", () => {
  const broken = clone(p0);
  broken.entry = "missing-entry";
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "unknown_node"));
  assert.equal(engine.start().ok, false);
});

/* ---------- 重复上报 ---------- */

test("重复上报胜利不会二次推进", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Battle.id });
  engine.applyBattleResult("win");
  const second = engine.applyBattleResult("win");
  assert.equal(second.ok, false);
  assert.equal(second.error.code, "wrong_node_type");
  assert.equal(engine.currentNode().id, p0Battle.on_win);
  assert.equal(engine.progress.claimed_rewards.length, 0, "推进本身不应发奖");
});

test("胜利后再失败不会倒退节点", () => {
  const engine = new StoryEngine(clone(p0), { node: p0Battle.id });
  engine.applyBattleResult("win");
  const back = engine.applyBattleResult("lose");
  assert.equal(back.ok, false);
  assert.equal(engine.currentNode().id, p0Battle.on_win);
});

/* ---------- 英雄剧情绑定 ---------- */

test("英雄剧情绑定英雄", () => {
  assert.equal(heroSection.hero, "volt");
  const battle = nodeOf(heroSection, "battle");
  assert.equal(battle.battle.hero, "volt");
});
