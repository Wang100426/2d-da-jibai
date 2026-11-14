/**
 * 战斗场地几何：把「这张图多大、玩家从哪出生、有没有建筑/道路、补给在哪」
 * 收敛成一个纯函数，`map.ts` 只做消费。
 *
 * 为什么要单独一份：
 * - 人机对抗与剧情战斗共用 1V1 竞技场（1400×900），但两者是不同入口，
 *   以前靠散落在 `map.ts` 里的 `config.duel ? ... : ...` 判断，容易漏；
 * - 纯函数能在 Node 里直接测，不需要浏览器或 Canvas。
 *
 * 注意：这里只决定**空间与静态物件**。敌人出生点带随机性，仍在 map.ts 里算。
 */

type BattleSupplyType = "health" | "energy";

interface BattleSupply {
  x: number;
  y: number;
  type: BattleSupplyType;
}

interface BattleSpace {
  /** 是否是 1V1 竞技场（人机对抗或剧情默认场地）。 */
  arenaMode: boolean;
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  supplies: BattleSupply[];
  /** 是否铺静态建筑（竞技场没有掩体）。 */
  staticObstacles: boolean;
  /** 是否画道路（竞技场、机场、火车站及自然地貌地图都没有）。 */
  roads: boolean;
}

const ARENA_SIZE = { width: 1400, height: 900 };
const ARENA_SPAWN = { x: 430, y: 450 };
const NORMAL_SIZE = { width: 3200, height: 2400 };
/** 竞技场只留两个贴边补给，逼玩家跑位。 */
const ARENA_SUPPLIES: BattleSupply[] = [
  { x: 1120, y: 220, type: "health" },
  { x: 250, y: 680, type: "energy" },
];
const NORMAL_SUPPLIES: BattleSupply[] = [
  { x: 1180, y: 700, type: "health" },
  { x: 2040, y: 1450, type: "energy" },
  { x: 2720, y: 720, type: "health" },
  { x: 1540, y: 1370, type: "energy" },
  { x: 250, y: 1300, type: "health" },
  { x: 2970, y: 1510, type: "energy" },
];

interface BattleSpaceInput {
  duel?: boolean;
  arena?: boolean;
  mapTheme?: string;
}

function resolveBattleSpace(input: BattleSpaceInput = {}): BattleSpace {
  const arenaMode = Boolean(input.duel || input.arena);
  if (arenaMode) {
    return {
      arenaMode: true,
      width: ARENA_SIZE.width,
      height: ARENA_SIZE.height,
      spawnX: ARENA_SPAWN.x,
      spawnY: ARENA_SPAWN.y,
      // 人机对抗不刷补给；剧情竞技场保留两个，否则多波战斗没有回复手段
      supplies: input.duel ? [] : ARENA_SUPPLIES.map((supply) => ({ ...supply })),
      staticObstacles: false,
      roads: false,
    };
  }
  const theme = input.mapTheme || "city";
  return {
    arenaMode: false,
    width: NORMAL_SIZE.width,
    height: NORMAL_SIZE.height,
    spawnX: theme === "airport" ? 1840 : 1600,
    spawnY: theme === "airport" ? 1300 : 1200,
    supplies: NORMAL_SUPPLIES.map((supply) => ({ ...supply })),
    staticObstacles: true,
    roads: !["airport", "station", "ancient_town", "windy_valley", "neon_beach"].includes(theme),
  };
}
