/**
 * 剧情引擎关键流程测试（node:test，无第三方依赖）。
 *
 * 运行：npm run test:story
 * 依赖：build/story_engine.js（由 npm run build:story-engine 生成，不提交）
 * 数据：tests/fixtures/chapters.zh.json（真实章节导出，由 story_script.py 生成）
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

// tsc 的 outFile 产物是普通脚本，用 vm 执行后手动挂到 globalThis
const engineCode = fs.readFileSync(enginePath, "utf8");
vm.runInThisContext(`${engineCode}\nglobalThis.__StoryEngine = StoryEngine;`);
const StoryEngine = globalThis.__StoryEngine;
assert.equal(typeof StoryEngine, "function", "StoryEngine 未正确导出");

const chapters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "chapters.zh.json"), "utf8"),
);
const cyber = chapters.find((chapter) => chapter.id === "cyber-01");
const heroChapter = chapters.find((chapter) => chapter.id === "hero-volt-01");
assert.ok(cyber && heroChapter, "fixture 缺少章节");

const clone = (value) => JSON.parse(JSON.stringify(value));

test("真实章节通过校验并以 entry 开场", () => {
  for (const chapter of chapters) {
    const engine = new StoryEngine(clone(chapter));
    assert.equal(engine.isValid, true, `${chapter.id} 校验失败：${JSON.stringify(engine.issues)}`);
    assert.equal(engine.currentNode().id, chapter.entry);
  }
});

test("对话框按 next 推进", () => {
  const engine = new StoryEngine(clone(cyber));
  const first = engine.currentNode();
  assert.equal(first.type, "dialogue");
  const step = engine.goTo(first.next);
  assert.equal(step.ok, true);
  assert.equal(step.node.id, "c1-pick");
});

test("分支选择记录选择并跳转", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-pick" });
  const step = engine.choose(0);
  assert.equal(step.ok, true);
  assert.equal(step.node.id, "c1-battle");
  assert.equal(engine.progress.choices["c1-pick"], "direct");
});

test("第二个分支指向任务目标节点", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-pick" });
  const step = engine.choose(1);
  assert.equal(step.ok, true);
  assert.equal(step.node.id, "c1-objective");
  assert.equal(engine.progress.choices["c1-pick"], "careful");
});

test("无效节点跳转被拒绝且不改变当前状态", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-intro" });
  const step = engine.goTo("does-not-exist");
  assert.equal(step.ok, false);
  assert.equal(step.error.code, "unknown_node");
  assert.equal(engine.currentNode().id, "c1-intro");
});

test("战斗胜利走 on_win", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-battle" });
  const step = engine.applyBattleResult("win");
  assert.equal(step.ok, true);
  assert.equal(step.node.id, "c1-reward");
  assert.equal(engine.progress.flags["battle:c1-battle"], true);
});

test("战斗失败回到重试节点", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-battle" });
  const step = engine.applyBattleResult("lose");
  assert.equal(step.ok, true);
  assert.equal(step.node.id, "c1-battle");
  assert.equal(engine.progress.flags["battle:c1-battle"], undefined);
});

test("失败后重试可以打赢", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-battle" });
  engine.applyBattleResult("lose");
  assert.equal(engine.currentNode().id, "c1-battle");
  const retry = engine.applyBattleResult("win");
  assert.equal(retry.ok, true);
  assert.equal(retry.node.id, "c1-reward");
});

test("非战斗节点收到战斗结果会报错", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-intro" });
  const step = engine.applyBattleResult("win");
  assert.equal(step.ok, false);
  assert.equal(step.error.code, "wrong_node_type");
});

test("存档恢复节点、选择、flags 与已领奖励", () => {
  const engine = new StoryEngine(clone(cyber));
  engine.goTo("c1-pick");
  engine.choose(1);
  engine.setObjective("scout", true);
  const snapshot = engine.snapshot();

  const restored = new StoryEngine(clone(cyber), snapshot);
  assert.equal(restored.currentNode().id, "c1-objective");
  assert.equal(restored.progress.choices["c1-pick"], "careful");
  assert.equal(restored.progress.objectives.scout, true);
  assert.equal(restored.progress.flags.scouted, true);
});

test("坏存档回退到 entry 且不抛错", () => {
  const engine = new StoryEngine(clone(cyber), { node: "ghost-node", flags: "not-an-object" });
  assert.equal(engine.currentNode().id, "c1-intro");
  assert.deepEqual(engine.progress.flags, {});
  assert.deepEqual(engine.progress.claimed_rewards, []);
});

test("奖励只能领取一次", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-reward" });
  const pending = engine.pendingReward();
  assert.equal(pending.reward_id, "cyber-01-clear");
  assert.equal(engine.markRewardClaimed(pending.reward_id), true);
  assert.equal(engine.pendingReward(), null);
  assert.equal(engine.markRewardClaimed(pending.reward_id), false, "重复标记应返回 false");

  // 用快照重建（模拟刷新/重试）后仍然不可重复领取
  const restored = new StoryEngine(clone(cyber), engine.snapshot());
  assert.equal(restored.pendingReward(), null);
});

test("奖励发放后离开再回来也不会重复", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-reward" });
  const reward = engine.pendingReward();
  engine.markRewardClaimed(reward.reward_id);
  engine.goTo("c1-end");
  engine.goTo("c1-reward");
  assert.equal(engine.pendingReward(), null);
  assert.equal(engine.progress.claimed_rewards.filter((id) => id === reward.reward_id).length, 1);
});

test("objective 未完成且不允许跳过时阻塞", () => {
  const strict = clone(cyber);
  const objective = strict.nodes.find((node) => node.type === "objective");
  objective.allow_skip = false;
  const engine = new StoryEngine(strict, { node: "c1-objective" });

  assert.equal(engine.canLeaveObjective(), false);
  engine.setObjective(objective.goals[0].id, true);
  assert.equal(engine.canLeaveObjective(), false, "只完成一个目标不应放行");
  engine.setObjective(objective.goals[1].id, true);
  assert.equal(engine.canLeaveObjective(), true);
});

test("真实 objective 节点允许跳过", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-objective" });
  assert.equal(engine.canLeaveObjective(), true);
});

test("battle 缺少分支会被校验拦下", () => {
  const broken = clone(cyber);
  delete broken.nodes.find((node) => node.type === "battle").on_win;
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "missing_config"));
});

test("battle 目标波次非法会被校验拦下", () => {
  const broken = clone(cyber);
  broken.nodes.find((node) => node.type === "battle").battle.target_waves = 0;
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "missing_config"));
});

test("跳转到不存在的节点会被校验拦下", () => {
  const broken = clone(cyber);
  broken.nodes.find((node) => node.id === "c1-intro").next = "nowhere";
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "invalid_transition"));
});

test("重复节点 id 会被校验拦下", () => {
  const broken = clone(cyber);
  broken.nodes.push({ ...broken.nodes[0] });
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "duplicate_node"));
});

test("entry 指向不存在的节点会被校验拦下", () => {
  const broken = clone(cyber);
  broken.entry = "missing-entry";
  const engine = new StoryEngine(broken);
  assert.equal(engine.isValid, false);
  assert.ok(engine.issues.some((issue) => issue.code === "unknown_node"));
  assert.equal(engine.start().ok, false);
});

test("英雄章节绑定英雄并复用同一战斗节点", () => {
  assert.equal(heroChapter.hero, "volt");
  const engine = new StoryEngine(clone(heroChapter));
  const battle = engine.getNode("h1-battle");
  assert.equal(battle.type, "battle");
  assert.equal(battle.battle.hero, "volt");
  assert.equal(battle.battle.target_waves, 2);
});

test("章节结束标记完成", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-end" });
  assert.equal(engine.isCompleted(), false);
  engine.finishChapter();
  assert.equal(engine.isCompleted(), true);
  assert.equal(new StoryEngine(clone(cyber), engine.snapshot()).isCompleted(), true);
});

/* ---------- 旧存档迁移 ---------- */

test("旧存档：只有 node 字段也能正常恢复", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-pick" });
  assert.equal(engine.currentNode().id, "c1-pick");
  assert.deepEqual(engine.progress.flags, {});
  assert.deepEqual(engine.progress.choices, {});
  assert.deepEqual(engine.progress.claimed_rewards, []);
});

test("旧存档：整份格式不对（version/chapters 结构）回退到 entry", () => {
  const engine = new StoryEngine(clone(cyber), { version: 0, chapters: { "cyber-01": { node: "c1-end" } } });
  assert.equal(engine.currentNode().id, cyber.entry);
  assert.equal(engine.isCompleted(), false);
});

test("旧存档：字段类型全错也不会抛错", () => {
  const engine = new StoryEngine(clone(cyber), {
    node: 42,
    flags: ["a", "b"],
    objectives: "nope",
    choices: 1,
    claimed_rewards: ["ok", 3, null],
  });
  assert.equal(engine.currentNode().id, cyber.entry);
  assert.deepEqual(engine.progress.claimed_rewards, ["ok"]);
});

/* ---------- 已完成状态不能被复活 ---------- */

test("已完成章节重新进入仍保持完成", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-end", completed: true });
  assert.equal(engine.isCompleted(), true);
  const again = new StoryEngine(clone(cyber), engine.snapshot());
  assert.equal(again.isCompleted(), true);
  assert.equal(again.currentNode().id, "c1-end");
});

test("节点被删除后回退 entry，但已完成标记保留", () => {
  const engine = new StoryEngine(clone(cyber), { node: "removed-node", completed: true });
  assert.equal(engine.currentNode().id, cyber.entry);
  assert.equal(engine.isCompleted(), true, "结构变更不能把已完成章节打回未完成");
});

test("完成 + 已领奖励的存档重进不会复活奖励", () => {
  const engine = new StoryEngine(clone(cyber), {
    node: "c1-end",
    completed: true,
    claimed_rewards: ["cyber-01-clear"],
  });
  assert.equal(engine.isCompleted(), true);
  engine.goTo("c1-reward");
  assert.equal(engine.pendingReward(), null);
});

/* ---------- 重复上报 ---------- */

test("重复上报胜利不会二次推进", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-battle" });
  engine.applyBattleResult("win");
  assert.equal(engine.currentNode().id, "c1-reward");
  const second = engine.applyBattleResult("win");
  assert.equal(second.ok, false);
  assert.equal(second.error.code, "wrong_node_type");
  assert.equal(engine.currentNode().id, "c1-reward");
  assert.equal(engine.progress.claimed_rewards.length, 0, "推进本身不应发奖");
});

test("胜利后再失败不会倒退节点", () => {
  const engine = new StoryEngine(clone(cyber), { node: "c1-battle" });
  engine.applyBattleResult("win");
  const back = engine.applyBattleResult("lose");
  assert.equal(back.ok, false);
  assert.equal(engine.currentNode().id, "c1-reward");
});
