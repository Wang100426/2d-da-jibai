/**
 * 静态建筑/路障的随机布局：把「建筑不能压道路、不能压出生点、不能互相重叠」
 * 收敛成纯函数，`map.ts` 只负责传入主题配置和消费结果。
 *
 * 为什么要单独一份：
 * - 2.8.2 之前的 fallback 从 (70,70) 全栅格扫描起步，多个找不到位置的建筑
 *   会被塞进同一个左上角格子并互相重叠 —— 必须能在 Node 里直接测这种几何问题；
 * - 随机源可注入，测试里用固定 seed 就能复现任意一次布局。
 *
 * 判定顺序（每个建筑独立）：
 * 1. 48 次随机抖动：在设计位置附近找第一个安全点；
 * 2. 从设计位置向外的螺旋网格搜索：找离设计位置最近的安全点；
 * 3. 保底回退设计坐标：最差也只是压到路/出生点，绝不堆叠到左上角。
 */

/** 与 `map.ts` 的 Obstacle 保持一致的字段（纯函数不关心其它属性）。 */
interface ObstacleLayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "building" | "barrier";
  name: string;
}

interface ObstacleLayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ObstacleLayoutConfig {
  mapTheme: string;
  width: number;
  height: number;
  roads: ObstacleLayoutRect[];
  /** 出生点周围的保护矩形，默认与 battle_space.ts 的普通地图出生点 (1600,1200) 对应。 */
  spawnRect?: ObstacleLayoutRect;
  /** 注入随机源（返回 [0,1)），默认 Math.random。 */
  random?: () => number;
}

/** 地图边缘留白，与旧逻辑一致。 */
const OBSTACLE_LAYOUT_MARGIN = 70;
/** 建筑之间的最小缝隙，避免贴边看起来像堆叠。 */
const OBSTACLE_LAYOUT_GAP = 16;
/** 螺旋搜索的网格步长。 */
const OBSTACLE_LAYOUT_STEP = 60;
/** 默认出生点保护区域（出生点 (1600,1200) 周围 ±60）。 */
const DEFAULT_SPAWN_RECT: ObstacleLayoutRect = { x: 1570, y: 1170, w: 60, h: 60 };

function obstacleRectsOverlap(a: ObstacleLayoutRect, b: ObstacleLayoutRect, gap = 0): boolean {
  return a.x - gap < b.x + b.w
    && a.x + a.w + gap > b.x
    && a.y - gap < b.y + b.h
    && a.y + a.h + gap > b.y;
}

function clampLayout(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * 从设计位置向外按正方形环搜索最近的安全点。
 * 这样建筑会留在它原本被设计的区域，而不是全跑到地图左上角。
 */
function searchNearDesign(
  item: ObstacleLayoutItem,
  config: ObstacleLayoutConfig,
  minX: number, minY: number, maxX: number, maxY: number,
  isSafe: (x: number, y: number) => boolean,
): { x: number; y: number } | undefined {
  const baseX = clampLayout(item.x, minX, maxX);
  const baseY = clampLayout(item.y, minY, maxY);
  const maxRing = Math.ceil(Math.max(config.width, config.height) / OBSTACLE_LAYOUT_STEP);
  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        // 只走当前正方形环的边，避免重复扫描内圈
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = clampLayout(baseX + dx * OBSTACLE_LAYOUT_STEP, minX, maxX);
        const y = clampLayout(baseY + dy * OBSTACLE_LAYOUT_STEP, minY, maxY);
        if (isSafe(x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

/**
 * 给一组建筑/路障计算随机布局。返回新数组，不修改入参。
 */
function randomizeObstacleLayout(
  source: ObstacleLayoutItem[],
  config: ObstacleLayoutConfig,
): ObstacleLayoutItem[] {
  const random = config.random || Math.random;
  const spawnRect = config.spawnRect || DEFAULT_SPAWN_RECT;
  const layout: ObstacleLayoutItem[] = [];

  source.forEach((item) => {
    // 机场布局是围绕跑道手工调过的，抖动会重新侵占跑道，原样保留。
    if (config.mapTheme === "airport") {
      layout.push({ ...item });
      return;
    }

    const jitter = item.type === "building" ? 76 : 48;
    const minX = OBSTACLE_LAYOUT_MARGIN;
    const minY = OBSTACLE_LAYOUT_MARGIN;
    const maxX = Math.max(minX, config.width - item.w - OBSTACLE_LAYOUT_MARGIN);
    const maxY = Math.max(minY, config.height - item.h - OBSTACLE_LAYOUT_MARGIN);

    // 硬约束：不压出生点、不和已放好的建筑重叠。任何情况下都不能破。
    const isHardSafe = (x: number, y: number): boolean => {
      const rect: ObstacleLayoutRect = { x, y, w: item.w, h: item.h };
      if (obstacleRectsOverlap(rect, spawnRect)) return false;
      return !layout.some((placed) => obstacleRectsOverlap(rect, placed, OBSTACLE_LAYOUT_GAP));
    };
    // 软约束：建筑尽量不压道路。路障本来就是摆在路上的，不检查。
    // 医院地图的道路把地图切成窄条，680×350 的大建筑在净空里放不下，
    // 若把「不压路」当硬约束会逼它回退堆叠——所以找不到位置时只放宽这一条。
    const isStrictSafe = (x: number, y: number): boolean => {
      if (!isHardSafe(x, y)) return false;
      if (item.type !== "building") return true;
      return !config.roads.some((road) =>
        obstacleRectsOverlap({ x, y, w: item.w, h: item.h }, road));
    };

    let position: { x: number; y: number } | undefined;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const x = clampLayout(item.x + (random() * 2 - 1) * jitter, minX, maxX);
      const y = clampLayout(item.y + (random() * 2 - 1) * jitter, minY, maxY);
      if (isStrictSafe(x, y)) {
        position = { x, y };
        break;
      }
    }
    if (!position) {
      position = searchNearDesign(item, config, minX, minY, maxX, maxY, isStrictSafe);
    }
    if (!position) {
      position = searchNearDesign(item, config, minX, minY, maxX, maxY, isHardSafe);
    }
    // 保底：留在设计位置。最差压到道路，但绝不和别的建筑叠在左上角。
    const finalX = position ? position.x : clampLayout(item.x, minX, maxX);
    const finalY = position ? position.y : clampLayout(item.y, minY, maxY);
    layout.push({ ...item, x: finalX, y: finalY });
  });

  return layout;
}
