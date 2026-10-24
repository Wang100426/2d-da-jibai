/**
 * 剧情战斗的波次配置：只放**纯数据与纯函数**。
 *
 * 为什么单独一个文件：
 * - `map.ts` 是整页战斗脚本，无法在 Node 里直接跑；把「波次展开 / 敌人数值 /
 *   技能归一化」抽成不依赖 DOM 的纯函数，才能写真正的单测。
 * - 数值只来自 `story_script.py` 的结构化 waves，文案（波次名、技能名）由
 *   `localized_chapter()` 从 `locale/*.json` 合并进来，这里只做兜底。
 *
 * 编译：`tsconfig.json` 把它和 `map.ts` 一起打进 `static/app.js`；
 * `tsconfig.story-wave.json` 单独输出 `build/story_wave.js` 供测试使用。
 */

interface StoryWaveEnemySpec {
  hero: string;
  count: number;
  /** 展示用文案，例如「生命 ×1.6 · 伤害 ×1.3」，不参与计算。 */
  mod?: string;
  hp_scale?: number;
  damage_scale?: number;
  speed_scale?: number;
  /** 减伤比例 0-0.6，对应 EnemyUnit.defenseReduction。 */
  armor?: number;
  kind?: "grunt" | "runner" | "brute";
}

interface StoryWaveSkillSpec {
  name?: string;
  description?: string;
  damage?: number;
  cooldown?: number;
  effect?: string;
  effect_turns?: number;
  radius?: number;
}

interface StoryWaveHazardSpec {
  interval: number;
  damage: number;
  effect?: string;
  effect_turns?: number;
}

interface StoryWaveSpec {
  label?: string;
  note?: string;
  event?: string;
  enemies?: StoryWaveEnemySpec[];
  skills?: StoryWaveSkillSpec[];
  hazard?: StoryWaveHazardSpec | null;
}

interface StoryHeroCombatLike {
  speed?: number;
  basic_damage?: number;
  basic_range?: number;
  defense?: number;
}

interface StoryEnemyStats {
  kind: "grunt" | "runner" | "brute";
  hp: number;
  attack: number;
  speed: number;
  armor: number;
}

interface NormalizedStorySkill {
  name: string;
  damage: number;
  cooldown: number;
  radius: number;
  effect: string;
  effectTurns: number;
}

/** 上限用于挡住手改/脏数据：单波最多 8 只一组、合计 24 只。 */
const STORY_WAVE_LIMITS = {
  maxPerGroup: 8,
  maxUnitsPerWave: 24,
  maxWaves: 12,
  minHp: 30,
  maxHp: 6000,
  minAttack: 3,
  maxAttack: 150,
  minSpeed: 26,
  maxSpeed: 120,
  minCooldown: 2,
  maxCooldown: 60,
  minRadius: 60,
  maxRadius: 420,
  minArmor: 0,
  maxArmor: 0.6,
};

const STORY_ENEMY_BASE: Record<"grunt" | "runner" | "brute", { hp: number; speed: number; attackFactor: number }> = {
  grunt: { hp: 95, speed: 54, attackFactor: 0.75 },
  runner: { hp: 66, speed: 84, attackFactor: 0.6 },
  brute: { hp: 145, speed: 44, attackFactor: 1.0 },
};

function storyClamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(number) ? number : fallback;
  return Math.min(max, Math.max(min, safe));
}

/** 没有显式 kind 时按英雄轮廓推断：厚甲近战→重装，远程→杂兵，其余→快速。 */
function storyEnemyKind(spec: StoryWaveEnemySpec, hero?: StoryHeroCombatLike): "grunt" | "runner" | "brute" {
  if (spec.kind === "grunt" || spec.kind === "runner" || spec.kind === "brute") return spec.kind;
  const defense = hero?.defense ?? 0;
  const range = hero?.basic_range ?? 120;
  if (defense >= 80) return "brute";
  if (range >= 200) return "grunt";
  if (range >= 150) return "runner";
  return "brute";
}

/** 敌人面板：基础值 × 波次倍率，并夹在安全范围内。 */
function storyEnemyStats(spec: StoryWaveEnemySpec, hero?: StoryHeroCombatLike): StoryEnemyStats {
  const kind = storyEnemyKind(spec, hero);
  const base = STORY_ENEMY_BASE[kind];
  const hpScale = storyClamp(spec.hp_scale, 1, 0.2, 8);
  const damageScale = storyClamp(spec.damage_scale, 1, 0.2, 5);
  const speedScale = storyClamp(spec.speed_scale, 1, 0.4, 2.5);
  const basicDamage = storyClamp(hero?.basic_damage, 12, 1, 100);
  return {
    kind,
    hp: Math.round(storyClamp(base.hp * hpScale, base.hp, STORY_WAVE_LIMITS.minHp, STORY_WAVE_LIMITS.maxHp)),
    attack: Math.round(storyClamp(
      basicDamage * base.attackFactor * damageScale,
      basicDamage,
      STORY_WAVE_LIMITS.minAttack,
      STORY_WAVE_LIMITS.maxAttack,
    )),
    speed: Math.round(storyClamp(
      base.speed * speedScale,
      base.speed,
      STORY_WAVE_LIMITS.minSpeed,
      STORY_WAVE_LIMITS.maxSpeed,
    )),
    armor: storyClamp(spec.armor, 0, STORY_WAVE_LIMITS.minArmor, STORY_WAVE_LIMITS.maxArmor),
  };
}

/**
 * 把一波里的「英雄 ×N」展开成逐只的生成队列。
 * 非法条目直接跳过，不抛错：剧情配置写错不该让整场战斗白屏。
 */
function expandStoryWave(wave: StoryWaveSpec | undefined | null): StoryWaveEnemySpec[] {
  const queue: StoryWaveEnemySpec[] = [];
  const enemies = Array.isArray(wave?.enemies) ? wave!.enemies! : [];
  enemies.forEach((spec) => {
    if (!spec || typeof spec.hero !== "string" || !spec.hero) return;
    const count = Math.round(storyClamp(spec.count, 1, 1, STORY_WAVE_LIMITS.maxPerGroup));
    for (let i = 0; i < count; i += 1) {
      if (queue.length >= STORY_WAVE_LIMITS.maxUnitsPerWave) return;
      queue.push({ ...spec, count: 1 });
    }
  });
  return queue;
}

/** 实际生效的波次数：以真实波次为准，声明值只作为无波次配置时的兜底。 */
function storyWaveTarget(waves: StoryWaveSpec[] | undefined | null, declared: number): number {
  const list = Array.isArray(waves) ? waves.filter((wave) => Array.isArray(wave?.enemies)) : [];
  if (list.length > 0) return Math.min(list.length, STORY_WAVE_LIMITS.maxWaves);
  return Math.max(1, Math.min(STORY_WAVE_LIMITS.maxWaves, Math.round(storyClamp(declared, 1, 1, 99))));
}

/** 取第 index 波（1 起），越界时回落到最后一波。 */
function storyWaveAt(waves: StoryWaveSpec[] | undefined | null, index: number): StoryWaveSpec | null {
  if (!Array.isArray(waves) || waves.length === 0) return null;
  const position = Math.min(waves.length, Math.max(1, Math.round(index))) - 1;
  return waves[position] || null;
}

/** 技能归一化：缺省值、负值、离谱数值都在这里被夹住。 */
function normalizeStorySkill(skill: StoryWaveSkillSpec | undefined | null): NormalizedStorySkill {
  return {
    name: typeof skill?.name === "string" && skill.name ? skill.name : "",
    damage: Math.round(storyClamp(skill?.damage, 0, 0, 200)),
    cooldown: storyClamp(skill?.cooldown, 8, STORY_WAVE_LIMITS.minCooldown, STORY_WAVE_LIMITS.maxCooldown),
    radius: storyClamp(skill?.radius, 150, STORY_WAVE_LIMITS.minRadius, STORY_WAVE_LIMITS.maxRadius),
    effect: typeof skill?.effect === "string" ? skill.effect : "",
    effectTurns: storyClamp(skill?.effect_turns, 0, 0, 10),
  };
}

/** 第 index 只敌人拿到的技能（多技能时轮转）。 */
function storySkillFor(wave: StoryWaveSpec | undefined | null, index: number): StoryWaveSkillSpec | null {
  const skills = Array.isArray(wave?.skills) ? wave!.skills!.filter(Boolean) : [];
  if (skills.length === 0) return null;
  return skills[Math.abs(Math.round(index)) % skills.length] || null;
}

/** 场地的周期伤害配置；缺字段或数值非法视为没有场地效果。 */
function normalizeStoryHazard(hazard: StoryWaveHazardSpec | undefined | null): StoryWaveHazardSpec | null {
  if (!hazard) return null;
  const interval = storyClamp(hazard.interval, 0, 0, 120);
  const damage = storyClamp(hazard.damage, 0, 0, 200);
  if (interval <= 0 || damage <= 0) return null;
  return {
    interval,
    damage: Math.round(damage),
    effect: typeof hazard.effect === "string" ? hazard.effect : "",
    effect_turns: storyClamp(hazard.effect_turns, 0, 0, 10),
  };
}
