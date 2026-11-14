/**
 * 飞索超人的空间判定单测（纯函数，不依赖浏览器）。
 *
 * 运行：npm run test:grapple
 * 依赖：build/grapple.js（npm run build:grapple 生成，不提交）
 *
 * 重点验证三个容易算错的地方：
 * 1. 飞索射线到底先命中建筑还是先命中敌人；
 * 2. 「站在建筑上方」覆盖整个屋顶区域，不只是矩形上边缘；
 * 3. 万重飞索「在建筑上就拉到建筑边缘」夹取的是最近那条边。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const grapplePath = path.join(__dirname, "..", "build", "grapple.js");
if (!fs.existsSync(grapplePath)) {
  throw new Error("缺少 build/grapple.js，请先运行 npm run build:grapple");
}

const grappleCode = fs.readFileSync(grapplePath, "utf8");
vm.runInThisContext(`${grappleCode}\nglobalThis.__grapple = { castGrappleRay, findRooftopUnder, clampToBuildingEdge, advanceGrapplePassive, grappleEnergyRegenScale, advanceGrappleCharges };`);
const {
  castGrappleRay,
  findRooftopUnder,
  clampToBuildingEdge,
  advanceGrapplePassive,
  grappleEnergyRegenScale,
  advanceGrappleCharges,
} = globalThis.__grapple;

assert.equal(typeof castGrappleRay, "function", "castGrappleRay 未正确导出");

const BUILDING = { x: 100, y: 100, w: 200, h: 100, type: "building" };

test("飞索朝右命中建筑", () => {
  const hit = castGrappleRay(0, 150, 1, 0, 600, [BUILDING], []);
  assert.ok(hit, "应该命中");
  assert.equal(hit.kind, "building");
  assert.equal(hit.x, 100);
  assert.equal(hit.y, 150);
});

test("飞索先命中挡在前面的敌人，而不是后面的建筑", () => {
  const targets = [{ id: "e1", x: 50, y: 150, radius: 20 }];
  const hit = castGrappleRay(0, 150, 1, 0, 600, [BUILDING], targets);
  assert.equal(hit.kind, "enemy");
  assert.equal(hit.targetId, "e1");
  assert.ok(hit.distance < 100, `敌人距离应小于建筑，实际 ${hit.distance}`);
});

test("3 阶只锁定建筑，穿透敌人", () => {
  const targets = [{ id: "e1", x: 50, y: 150, radius: 20 }];
  const hit = castGrappleRay(0, 150, 1, 0, 600, [BUILDING], targets, true);
  assert.equal(hit.kind, "building");
  assert.equal(hit.x, 100);
});

test("没有目标时命中地图边缘", () => {
  const hit = castGrappleRay(0, 150, -1, 0, 600, [], []);
  assert.equal(hit.kind, "edge");
  assert.equal(hit.x, 0);
  assert.equal(hit.y, 150);
});

test("朝下的飞索命中下边界而不是上边界", () => {
  const hit = castGrappleRay(1500, 2000, 0, 1, 600, [], []);
  assert.equal(hit.kind, "edge");
  assert.equal(hit.y, 2400, `应命中下边界 2400，实际 ${hit.y}`);
});

test("超出射程时不命中边缘", () => {
  // 起点离边界 500 像素，射程只有 50 —— 不该命中。
  const hit = castGrappleRay(500, 150, -1, 0, 50, [], []);
  assert.equal(hit === undefined, true);
});

test("起点贴在边界上朝外射，算命中边缘（距离 0）", () => {
  const hit = castGrappleRay(0, 150, -1, 0, 600, [], []);
  assert.equal(hit.kind, "edge");
  assert.equal(hit.x, 0);
  assert.equal(hit.distance, 0);
});

test("建筑后方还有建筑时命中更近的那个", () => {
  const far = { x: 500, y: 100, w: 100, h: 100, type: "building" };
  const hit = castGrappleRay(0, 150, 1, 0, 900, [BUILDING, far], []);
  assert.equal(hit.x, 100, "应命中更近的建筑");
});

test("站在建筑上方：脚部位于屋顶区域", () => {
  const rooftop = findRooftopUnder(150, 100, [BUILDING]);
  assert.ok(rooftop, "应该识别出屋顶");
  assert.equal(rooftop.y, 100);
});

test("落在建筑屋顶内部也算站在屋顶", () => {
  const rooftop = findRooftopUnder(150, 180, [BUILDING]);
  assert.ok(rooftop, "屋顶内部应该被识别");
  assert.equal(rooftop.y, 100);
});

test("不在建筑水平范围内不算站在屋顶", () => {
  assert.equal(findRooftopUnder(400, 100, [BUILDING]), undefined);
});

test("脚部离开屋顶区域不算站在屋顶", () => {
  assert.equal(findRooftopUnder(150, 220, [BUILDING]), undefined);
});

test("站在地面上不会被误判为站在建筑上方", () => {
  assert.equal(findRooftopUnder(150, 300, [BUILDING]), undefined);
});

test("万重飞索：点在上方时夹到屋顶边", () => {
  const point = clampToBuildingEdge(150, 50, BUILDING);
  assert.equal(point.x, 150);
  assert.equal(point.y, 100);
});

test("万重飞索：点在右方时夹到右边缘", () => {
  const point = clampToBuildingEdge(400, 150, BUILDING);
  assert.equal(point.x, 300);
  assert.equal(point.y, 150);
});

test("万重飞索：点在下方时夹到底边", () => {
  const point = clampToBuildingEdge(150, 300, BUILDING);
  assert.equal(point.x, 150);
  assert.equal(point.y, 200);
});

/* ---------- 被动：能量层数规则 ---------- */

const freshPassive = () => ({ stacks: 0, stackTimer: 0, groundGrace: 0, onRooftop: false });

test("被动：在建筑上每 2 秒 +1 层", () => {
  const state = freshPassive();
  advanceGrapplePassive(state, 2, true);
  assert.equal(state.stacks, 1);
  advanceGrapplePassive(state, 2, true);
  assert.equal(state.stacks, 2);
});

test("被动：不足 2 秒不涨层", () => {
  const state = freshPassive();
  advanceGrapplePassive(state, 1.9, true);
  assert.equal(state.stacks, 0);
});

test("被动：层数没有上限", () => {
  const state = freshPassive();
  for (let i = 0; i < 60; i += 1) advanceGrapplePassive(state, 2, true);
  assert.equal(state.stacks, 60, "60 层都应该保留");
});

test("被动：在建筑之间跳跃层数不变（不落地）", () => {
  const state = freshPassive();
  advanceGrapplePassive(state, 6, true);
  assert.equal(state.stacks, 3);
  // 短暂离开建筑（还没落到地面）不该扣层数。
  advanceGrapplePassive(state, 0.5, false);
  assert.equal(state.stacks, 3, "宽限期内层数保留");
});

test("被动：回到地面保留 3 秒后清空", () => {
  const state = freshPassive();
  advanceGrapplePassive(state, 6, true);
  assert.equal(state.stacks, 3);
  advanceGrapplePassive(state, 2.9, false);
  assert.equal(state.stacks, 3, "宽限期内保留");
  advanceGrapplePassive(state, 0.2, false);
  assert.equal(state.stacks, 0, "超过 3 秒清空");
});

test("被动：宽限期内回到建筑，保留一半层数", () => {
  const state = freshPassive();
  advanceGrapplePassive(state, 6, true);
  assert.equal(state.stacks, 3);
  advanceGrapplePassive(state, 1, false);
  const result = advanceGrapplePassive(state, 0.1, true);
  assert.equal(result.halved, true, "应触发减半");
  assert.equal(state.stacks, 1, "3 层的一半（向下取整）是 1 层");
});

test("被动：能量恢复倍率每层 +10%", () => {
  assert.equal(grappleEnergyRegenScale(0), 1);
  assert.equal(grappleEnergyRegenScale(1), 1.1);
  assert.equal(grappleEnergyRegenScale(5), 1.5);
});

/* ---------- 充能规则 ---------- */

test("充能：每 3 秒恢复 1 次", () => {
  let charges = 5;
  let timer = 0;
  let result = advanceGrappleCharges(charges, timer, 2.9, 5, 3);
  assert.equal(result.charges, 5, "不足 3 秒不恢复");
  result = advanceGrappleCharges(result.charges, result.timer, 0.2, 5, 3);
  assert.equal(result.charges, 5, "满充能时不再增加");
});

test("充能：消耗后按间隔恢复", () => {
  let result = advanceGrappleCharges(2, 0, 3, 5, 3);
  assert.equal(result.charges, 3);
  result = advanceGrappleCharges(result.charges, result.timer, 3, 5, 3);
  assert.equal(result.charges, 4);
});

test("充能：不超过上限", () => {
  let result = advanceGrappleCharges(5, 0, 30, 5, 3);
  assert.equal(result.charges, 5);
});
