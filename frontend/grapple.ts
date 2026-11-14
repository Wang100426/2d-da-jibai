/**
 * 飞索超人的空间判定：把「建筑顶部在哪」「飞索射线会打中什么」收敛成纯函数，
 * `map.ts` 只做消费和状态推进。
 *
 * 为什么要单独一份：
 * - 「站在建筑上方」需要一套独立的坐标语义（屋顶平台 = 建筑矩形覆盖的区域），
 *   和地面碰撞（`blockedByRects` 用圆心距离）是两套逻辑，混在一起容易算错；
 * - 纯函数能在 Node 里直接测，不用浏览器或 Canvas。
 *
 * 坐标系说明：地图是俯视 2D。建筑是矩形 `(x, y, w, h)`，
 * 「建筑上方」= 玩家脚部落在建筑矩形覆盖的屋顶区域内。
 */

/** 与 `map.ts` 的 Obstacle 保持一致（只取判定需要的字段）。 */
interface GrappleObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
}

/** 地图尺寸，与 `battle_space.ts` 的 NORMAL_SIZE 保持一致。 */
const MAP_WIDTH = 3200;
const MAP_HEIGHT = 2400;

interface GrappleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 飞索射线可能命中的三类目标。 */
type GrappleHitKind = "building" | "enemy" | "edge";

interface GrappleRayHit {
  kind: GrappleHitKind;
  /** 命中点的坐标（edge 为地图边界上的点）。 */
  x: number;
  y: number;
  /** 命中建筑时，该建筑的矩形（用于判断「建筑边缘」）。 */
  obstacle?: GrappleRect;
  /** 命中敌人时敌人的唯一标识（由调用方映射回实体）。 */
  targetId?: string;
  /** 从起点到命中点的距离。 */
  distance: number;
}

interface GrappleLanding {
  x: number;
  y: number;
}

/** 射线起点与一个圆形目标（敌人）的碰撞测试。 */
interface GrappleCircleTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
}

/** 射线与矩形（建筑）相交：返回进入点，用于判断「先打到建筑还是先打到敌人」。 */
function rayRectEntry(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  rect: GrappleRect,
): number | undefined {
  // 用 slab 法求射线与矩形的最近交点参数 t（0 表示起点在矩形内）。
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;
  const axes: [number, number, number, number][] = [
    [originX, dirX, rect.x, rect.x + rect.w],
    [originY, dirY, rect.y, rect.y + rect.h],
  ];
  for (const [origin, dir, min, max] of axes) {
    if (Math.abs(dir) < 1e-9) {
      // 与该轴平行：起点必须已经在范围内，否则不相交。
      if (origin < min || origin > max) return undefined;
      continue;
    }
    let t1 = (min - origin) / dir;
    let t2 = (max - origin) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return undefined;
  }
  if (tMax < 0) return undefined;
  return tMin;
}

/** 射线与圆的最近交点距离（未命中返回 undefined）。 */
function rayCircleEntry(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  target: GrappleCircleTarget,
): number | undefined {
  const toX = target.x - originX;
  const toY = target.y - originY;
  const projection = toX * dirX + toY * dirY;
  // 目标在射线反方向 —— 不命中。
  if (projection < 0) return undefined;
  const perpendicularSq = toX * toX + toY * toY - projection * projection;
  const radiusSq = target.radius * target.radius;
  if (perpendicularSq > radiusSq) return undefined;
  const half = Math.sqrt(Math.max(0, radiusSq - perpendicularSq));
  const entry = Math.max(0, projection - half);
  return entry;
}

/**
 * 沿方向发射飞索，返回最先命中的目标。
 *
 * @param onlyStructure 3 阶：只锁定建筑与地图边缘，穿透敌人。
 */
function castGrappleRay(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  range: number,
  obstacles: GrappleObstacle[],
  targets: GrappleCircleTarget[],
  onlyStructure = false,
  mapWidth = MAP_WIDTH,
  mapHeight = MAP_HEIGHT,
): GrappleRayHit | undefined {
  const length = Math.hypot(dirX, dirY);
  if (!length) return undefined;
  const unitX = dirX / length;
  const unitY = dirY / length;

  let best: GrappleRayHit | undefined;

  // 建筑：取进入点最近的矩形。
  obstacles.forEach((obstacle) => {
    const entry = rayRectEntry(originX, originY, unitX, unitY, obstacle);
    if (entry === undefined || entry > range) return;
    if (best && best.distance <= entry) return;
    best = {
      kind: "building",
      x: originX + unitX * entry,
      y: originY + unitY * entry,
      obstacle: { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h },
      distance: entry,
    };
  });

  // 敌方英雄：取进入点最近的圆。
  if (!onlyStructure) {
    targets.forEach((target) => {
      const entry = rayCircleEntry(originX, originY, unitX, unitY, target);
      if (entry === undefined || entry > range) return;
      if (best && best.distance <= entry) return;
      best = {
        kind: "enemy",
        x: target.x,
        y: target.y,
        targetId: target.id,
        distance: entry,
      };
    });
  }

  // 地图边缘：与命中物的距离比较，取先到者。
  //
  // 注意要算「射线真正撞到边界」的距离，而不是「到某条边界线的垂距」：
  // 起点贴边时垂距会是 0（把建筑命中吃掉），而斜射时先撞到的是
  // 四条边里最近的那条。所以这里对四条边分别求交，再取最小。
  //
  // 每条边只考虑射线「朝它去」的方向：朝右射时左边界在身后，不算命中；
  // 但起点正好贴着左边界且朝外射时，仍然算命中（距离 0）。
  let edgeDistance = Number.POSITIVE_INFINITY;
  const edges: [number, number, number, boolean, number][] = [
    // [起点轴值, 方向, 边界值, 是否竖直边, 允许的射线方向符号]
    [originX, unitX, 0, false, -1],
    [originX, unitX, mapWidth, false, 1],
    [originY, unitY, 0, true, -1],
    [originY, unitY, mapHeight, true, 1],
  ];
  edges.forEach(([origin, dir, boundary, isVertical, allowedSign]) => {
    if (Math.abs(dir) < 1e-9) return;
    // 射线必须朝着这条边去，否则它在射线身后。
    if (Math.sign(dir) !== allowedSign) return;
    const distance = (boundary - origin) / dir;
    // distance == 0 表示起点本来就贴在这条边界上且朝外射 —— 算命中边缘。
    if (distance < -1e-9) return;
    // 斜射时还要确认交点落在那条边的有效范围内，否则会算出边界外的点。
    if (isVertical) {
      const cross = originY + unitY * distance;
      if (cross < -1e-9 || cross > mapHeight + 1e-9) return;
    } else {
      const cross = originX + unitX * distance;
      if (cross < -1e-9 || cross > mapWidth + 1e-9) return;
    }
    edgeDistance = Math.min(edgeDistance, Math.max(0, distance));
  });
  if (edgeDistance <= range) {
    if (!best || edgeDistance < best.distance) {
      best = {
        kind: "edge",
        x: originX + unitX * edgeDistance,
        y: originY + unitY * edgeDistance,
        distance: edgeDistance,
      };
    }
  }

  return best;
}

/**
 * Keep ground hooks from ending inside a building or beyond the map boundary.
 * Rooftop transfers still use the building hit point and are clamped to the roof
 * by the battle state machine.
 */
function resolveGrappleLanding(
  originX: number,
  originY: number,
  hit: GrappleRayHit,
  playerRadius: number,
  mapWidth = MAP_WIDTH,
  mapHeight = MAP_HEIGHT,
): GrappleLanding {
  let x = hit.x;
  let y = hit.y;
  if (hit.kind === "building" && hit.obstacle) {
    const distance = Math.hypot(x - originX, y - originY) || 1;
    const inset = playerRadius + 2;
    x -= (x - originX) / distance * inset;
    y -= (y - originY) / distance * inset;
  }
  return {
    x: Math.max(playerRadius + 2, Math.min(mapWidth - playerRadius - 2, x)),
    y: Math.max(playerRadius + 2, Math.min(mapHeight - playerRadius - 2, y)),
  };
}

/**
 * 找到玩家脚下的建筑屋顶（用于判定「是否站在建筑上方」）。
 *
 * 判定条件：建筑矩形覆盖玩家脚部位置；容差用于允许落点轻微越过边缘。
 */
function findRooftopUnder(
  x: number,
  footY: number,
  obstacles: GrappleObstacle[],
  tolerance = 6,
): GrappleRect | undefined {
  let best: GrappleRect | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  obstacles.forEach((obstacle) => {
    if (obstacle.type !== "building") return;
    if (x < obstacle.x - 2 || x > obstacle.x + obstacle.w + 2) return;
    const distance = Math.max(obstacle.y - footY, footY - (obstacle.y + obstacle.h), 0);
    if (distance > tolerance) return;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: obstacle.x, y: obstacle.y, w: obstacle.w, h: obstacle.h };
    }
  });
  return best;
}

/**
 * 飞索超人的被动状态（纯数据，便于单测）。
 */
interface GrapplePassiveState {
  /** 能量恢复加速的层数。 */
  stacks: number;
  /** 层数的累积计时（每满 2 秒 +1 层）。 */
  stackTimer: number;
  /** 离开建筑后保留层数的宽限期计时（秒）。 */
  groundGrace: number;
  /** 是否站在建筑上方。 */
  onRooftop: boolean;
}

/** 被动的每层时间：每 2 秒 +1 层。 */
const STACK_INTERVAL = 2;
/** 回到地面后保留层数的宽限期：3 秒。 */
const GROUND_GRACE = 3;

/**
 * 推进飞索超人的被动（一帧）。
 *
 * 规则：
 * - 在建筑上时每 2 秒 +1 层（无上限）；
 * - 回到地面时保留层数 3 秒，期间回到建筑上会**保留一半层数**；
 * - 在建筑之间跳跃（不落地）层数不变 —— 所以只有「真正落到地面」才扣层数。
 */
function advanceGrapplePassive(
  state: GrapplePassiveState,
  dt: number,
  onRooftop: boolean,
): { stacksChanged: boolean; halved: boolean } {
  let stacksChanged = false;
  let halved = false;

  // 从建筑落到地面：启动宽限期（层数保留 3 秒）。
  if (state.onRooftop && !onRooftop) {
    state.groundGrace = GROUND_GRACE;
  }

  if (onRooftop) {
    // 从地面回到建筑：按规则保留一半层数。
    if (state.groundGrace > 0) {
      state.stacks = Math.floor(state.stacks / 2);
      state.groundGrace = 0;
      halved = true;
      stacksChanged = true;
    }
    state.stackTimer += dt;
    while (state.stackTimer >= STACK_INTERVAL) {
      state.stackTimer -= STACK_INTERVAL;
      state.stacks += 1;
      stacksChanged = true;
    }
  } else if (state.stacks > 0) {
    // 回到地面：宽限期内层数保留，超时清空。
    if (state.groundGrace > 0) {
      state.groundGrace = Math.max(0, state.groundGrace - dt);
      if (state.groundGrace <= 0) {
        state.stacks = 0;
        state.stackTimer = 0;
        stacksChanged = true;
      }
    }
  }

  state.onRooftop = onRooftop;
  return { stacksChanged, halved };
}

/** 能量恢复速度倍率：每层 +10%。 */
function grappleEnergyRegenScale(stacks: number): number {
  if (stacks <= 0) return 1;
  return 1 + stacks * 0.1;
}

/**
 * 飞索·移的充能推进（一帧）。
 *
 * @param charges 当前充能次数（会被就地修改）。
 */
function advanceGrappleCharges(
  charges: number,
  timer: number,
  dt: number,
  maxCharges: number,
  rechargeSeconds: number,
): { charges: number; timer: number } {
  if (charges >= maxCharges) return { charges, timer: 0 };
  const nextTimer = timer + dt;
  if (nextTimer >= rechargeSeconds) {
    return { charges: Math.min(maxCharges, charges + 1), timer: nextTimer - rechargeSeconds };
  }
  return { charges, timer: nextTimer };
}

/**
 * 把点夹到建筑边缘（用于「在建筑上就拉到建筑边缘」）。
 *
 * 边缘 = 屋顶矩形的四条边里离给定点最近的那条；返回落在边上的点。
 *
 * 距离必须是「点到**边段**」的真实距离（含沿边方向的偏移），
 * 只算垂距会让矩形外侧的角点判错边，夹出来的位置也是错的。
 */
function clampToBuildingEdge(
  pointX: number,
  pointY: number,
  rect: GrappleRect,
): { x: number; y: number } {
  /** 点到轴对齐线段的最短距离，以及线段上最近的那个点。 */
  const nearestOnSegment = (
    fixed: number,
    isVertical: boolean,
    segmentStart: number,
    segmentEnd: number,
  ): { d: number; x: number; y: number } => {
    if (isVertical) {
      // 竖直边：x 固定，y 在 [segmentStart, segmentEnd] 内
      const y = Math.max(segmentStart, Math.min(pointY, segmentEnd));
      return { d: Math.hypot(pointX - fixed, pointY - y), x: fixed, y };
    }
    // 水平边：y 固定，x 在 [segmentStart, segmentEnd] 内
    const x = Math.max(segmentStart, Math.min(pointX, segmentEnd));
    return { d: Math.hypot(pointX - x, pointY - fixed), x, y: fixed };
  };

  const candidates = [
    nearestOnSegment(rect.y, false, rect.x, rect.x + rect.w),
    nearestOnSegment(rect.y + rect.h, false, rect.x, rect.x + rect.w),
    nearestOnSegment(rect.x, true, rect.y, rect.y + rect.h),
    nearestOnSegment(rect.x + rect.w, true, rect.y, rect.y + rect.h),
  ];
  candidates.sort((left, right) => left.d - right.d);
  return { x: candidates[0].x, y: candidates[0].y };
}
