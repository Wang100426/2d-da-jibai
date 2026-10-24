/**
 * 剧情引擎（纯逻辑，不碰 DOM）。
 *
 * 职责边界：
 * - **数据**：章节与节点来自 `story_script.py`，文本已按语言合并好。
 * - **执行**：本文件只做状态机（节点跳转、选择记录、任务状态、奖励防重）。
 * - **渲染**：全部在 `story.ts`。所以这里可以直接放进 Node 跑测试。
 *
 * 不做的事：不发请求、不读 localStorage、不改存档 —— 存档由 `story.ts` 调后端接口。
 */

interface StoryPalette {
  main: string;
  light: string;
  dark: string;
}

interface StoryNodeBase {
  id: string;
  type: string;
  next?: string | null;
}

interface StoryDialogueNode extends StoryNodeBase {
  type: "dialogue";
  speaker?: string;
  text?: string;
  initial?: string;
  accent?: string;
  palette?: StoryPalette;
}

interface StoryChoiceOption {
  id: string;
  label?: string;
  next: string;
}

interface StoryChoiceNode extends StoryNodeBase {
  type: "choice";
  prompt?: string;
  options: StoryChoiceOption[];
}

interface StoryBattleConfig {
  hero?: string | null;
  target_waves?: number;
  map_theme?: string;
}

interface StoryBattleNode extends StoryNodeBase {
  type: "battle";
  title?: string;
  brief?: string;
  waves?: unknown[];
  battle?: StoryBattleConfig;
  on_win?: string;
  on_lose?: string;
}

interface StoryGoal {
  id: string;
  label?: string;
  done_flag?: string;
}

interface StoryObjectiveNode extends StoryNodeBase {
  type: "objective";
  title?: string;
  description?: string;
  goals?: StoryGoal[];
  allow_skip?: boolean;
}

interface StoryRewardNode extends StoryNodeBase {
  type: "reward";
  title?: string;
  description?: string;
  reward_id?: string;
  coins?: number;
}

interface StoryChapterEndNode extends StoryNodeBase {
  type: "chapter_end";
  title?: string;
  text?: string;
}

type StoryNode =
  | StoryDialogueNode
  | StoryChoiceNode
  | StoryBattleNode
  | StoryObjectiveNode
  | StoryRewardNode
  | StoryChapterEndNode;

interface StoryChapter {
  id: string;
  category: string;
  category_name?: string;
  title: string;
  summary?: string;
  background?: string;
  hero: string | null;
  entry: string;
  nodes: StoryNode[];
}

interface StoryProgress {
  node: string | null;
  flags: Record<string, boolean>;
  objectives: Record<string, boolean>;
  choices: Record<string, string>;
  claimed_rewards: string[];
  completed: boolean;
}

type StoryErrorCode =
  | "duplicate_node"
  | "unknown_node"
  | "missing_config"
  | "invalid_transition"
  | "wrong_node_type"
  | "invalid_option"
  | "empty_chapter";

interface StoryError {
  code: StoryErrorCode;
  message: string;
  node?: string;
}

interface StoryStep {
  ok: boolean;
  node: StoryNode | null;
  error?: StoryError;
}

function emptyProgress(entry: string | null): StoryProgress {
  return {
    node: entry,
    flags: {},
    objectives: {},
    choices: {},
    claimed_rewards: [],
    completed: false,
  };
}

/** 把外部（存档/接口）返回的进度整理成引擎可用的形状。 */
function normalizeProgress(raw: unknown, chapter: StoryChapter, known: Map<string, StoryNode>): StoryProgress {
  const base = emptyProgress(chapter.entry);
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Partial<StoryProgress>;

  const node = typeof source.node === "string" && known.has(source.node) ? source.node : chapter.entry;
  const boolMap = (value: unknown): Record<string, boolean> => {
    const result: Record<string, boolean> = {};
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        if (key) result[key] = Boolean(item);
      });
    }
    return result;
  };
  const stringMap = (value: unknown): Record<string, string> => {
    const result: Record<string, string> = {};
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        if (key && typeof item === "string") result[key] = item;
      });
    }
    return result;
  };

  return {
    node,
    flags: boolMap(source.flags),
    objectives: boolMap(source.objectives),
    choices: stringMap(source.choices),
    claimed_rewards: Array.isArray(source.claimed_rewards)
      ? source.claimed_rewards.filter((item): item is string => typeof item === "string")
      : [],
    completed: Boolean(source.completed),
  };
}

class StoryEngine {
  readonly chapter: StoryChapter;
  private readonly nodes = new Map<string, StoryNode>();
  private readonly problems: StoryError[] = [];
  private state: StoryProgress;

  constructor(chapter: StoryChapter, saved?: unknown) {
    this.chapter = chapter;
    this.indexNodes();
    this.validate();
    this.state = normalizeProgress(saved, chapter, this.nodes);
  }

  /* ---------- 初始化与校验 ---------- */

  private indexNodes(): void {
    (this.chapter.nodes || []).forEach((node) => {
      if (!node || typeof node.id !== "string" || !node.id) {
        this.problems.push({ code: "missing_config", message: "节点缺少 id" });
        return;
      }
      if (this.nodes.has(node.id)) {
        this.problems.push({ code: "duplicate_node", message: `节点 id 重复：${node.id}`, node: node.id });
        return;
      }
      this.nodes.set(node.id, node);
    });
  }

  private validate(): void {
    if (!this.nodes.size) {
      this.problems.push({ code: "empty_chapter", message: `章节 ${this.chapter.id} 没有节点` });
      return;
    }
    if (!this.nodes.has(this.chapter.entry)) {
      this.problems.push({
        code: "unknown_node",
        message: `entry 指向不存在的节点：${this.chapter.entry}`,
        node: this.chapter.entry,
      });
    }
    this.nodes.forEach((node, id) => {
      const targets: Array<string | null | undefined> = [];
      if (node.next) targets.push(node.next);
      if (node.type === "choice") {
        const options = node.options || [];
        if (!options.length) {
          this.problems.push({ code: "missing_config", message: "choice 没有可选项", node: id });
        }
        options.forEach((option) => targets.push(option.next));
      }
      if (node.type === "battle") {
        if (!node.on_win || !node.on_lose) {
          this.problems.push({ code: "missing_config", message: "battle 缺少 on_win / on_lose", node: id });
        }
        const waves = node.battle?.target_waves;
        if (typeof waves !== "number" || waves < 1) {
          this.problems.push({ code: "missing_config", message: "battle.target_waves 必须是正整数", node: id });
        }
        targets.push(node.on_win, node.on_lose);
      }
      if (node.type === "reward" && !node.reward_id) {
        this.problems.push({ code: "missing_config", message: "reward 缺少 reward_id", node: id });
      }
      targets.forEach((target) => {
        if (target && !this.nodes.has(target)) {
          this.problems.push({
            code: "invalid_transition",
            message: `跳转到不存在的节点：${target}`,
            node: id,
          });
        }
      });
    });
  }

  /* ---------- 只读状态 ---------- */

  get issues(): StoryError[] {
    return [...this.problems];
  }

  get progress(): StoryProgress {
    return this.state;
  }

  get isValid(): boolean {
    return this.problems.length === 0;
  }

  getNode(id: string): StoryNode | null {
    return this.nodes.get(id) || null;
  }

  currentNode(): StoryNode | null {
    return this.state.node ? this.getNode(this.state.node) : null;
  }

  isCompleted(): boolean {
    return this.state.completed;
  }

  hasFlag(flag: string): boolean {
    return Boolean(this.state.flags[flag]);
  }

  /* ---------- 状态变更 ---------- */

  /** 进入章节：优先回到存档节点，存档节点不可用则回 entry。 */
  start(): StoryStep {
    if (!this.isValid) {
      return {
        ok: false,
        node: null,
        error: this.problems[0] || { code: "empty_chapter", message: "章节不可用" },
      };
    }
    const target = this.state.node && this.nodes.has(this.state.node) ? this.state.node : this.chapter.entry;
    return this.enter(target);
  }

  /** 跳转到指定节点，非法跳转不会改变当前状态。 */
  goTo(nodeId: string): StoryStep {
    if (!nodeId) {
      return {
        ok: false,
        node: this.currentNode(),
        error: { code: "unknown_node", message: "空的节点 id" },
      };
    }
    if (!this.nodes.has(nodeId)) {
      return {
        ok: false,
        node: this.currentNode(),
        error: { code: "unknown_node", message: `节点不存在：${nodeId}`, node: nodeId },
      };
    }
    return this.enter(nodeId);
  }

  private enter(nodeId: string): StoryStep {
    this.state.node = nodeId;
    const node = this.nodes.get(nodeId) || null;
    return { ok: Boolean(node), node };
  }

  /** 分支选择：记录选择并跳到选项指向的节点。 */
  choose(optionIndex: number): StoryStep {
    const node = this.currentNode();
    if (!node || node.type !== "choice") {
      return {
        ok: false,
        node,
        error: { code: "wrong_node_type", message: "当前节点不是 choice", node: node?.id },
      };
    }
    const option = node.options?.[optionIndex];
    if (!option) {
      return {
        ok: false,
        node,
        error: { code: "invalid_option", message: `选项越界：${optionIndex}`, node: node.id },
      };
    }
    this.state.choices[node.id] = option.id;
    return this.goTo(option.next);
  }

  /** 战斗结果回传：按 on_win / on_lose 跳转。 */
  applyBattleResult(result: "win" | "lose"): StoryStep {
    const node = this.currentNode();
    if (!node || node.type !== "battle") {
      return {
        ok: false,
        node,
        error: { code: "wrong_node_type", message: "当前节点不是 battle", node: node?.id },
      };
    }
    const target = result === "win" ? node.on_win : node.on_lose;
    if (!target) {
      return {
        ok: false,
        node,
        error: { code: "missing_config", message: `battle 缺少 ${result} 分支`, node: node.id },
      };
    }
    if (result === "win") this.state.flags[`battle:${node.id}`] = true;
    return this.goTo(target);
  }

  /** 任务目标勾选。 */
  setObjective(goalId: string, done: boolean): void {
    if (!goalId) return;
    this.state.objectives[goalId] = done;
    const node = this.currentNode();
    if (node && node.type === "objective") {
      const goal = (node.goals || []).find((item) => item.id === goalId);
      if (goal?.done_flag) this.state.flags[goal.done_flag] = done;
    }
  }

  /** 当前 objective 节点是否全部达成。 */
  objectivesDone(): boolean {
    const node = this.currentNode();
    if (!node || node.type !== "objective") return true;
    return (node.goals || []).every((goal) => Boolean(this.state.objectives[goal.id]));
  }

  /** objective 节点能否继续：要么全部达成，要么该节点允许跳过。 */
  canLeaveObjective(): boolean {
    const node = this.currentNode();
    if (!node || node.type !== "objective") return true;
    return this.objectivesDone() || Boolean(node.allow_skip);
  }

  /** 当前节点是否为待领取的奖励（已领过就返回 null）。 */
  pendingReward(): StoryRewardNode | null {
    const node = this.currentNode();
    if (!node || node.type !== "reward" || !node.reward_id) return null;
    return this.state.claimed_rewards.includes(node.reward_id) ? null : node;
  }

  /** 本地标记奖励已领取；重复标记返回 false。 */
  markRewardClaimed(rewardId: string): boolean {
    if (!rewardId) return false;
    if (this.state.claimed_rewards.includes(rewardId)) return false;
    this.state.claimed_rewards.push(rewardId);
    return true;
  }

  /** 标记章节完成。 */
  finishChapter(): void {
    this.state.completed = true;
  }

  /** 导出可提交给存档接口的进度。 */
  snapshot(): StoryProgress {
    return {
      node: this.state.node,
      flags: { ...this.state.flags },
      objectives: { ...this.state.objectives },
      choices: { ...this.state.choices },
      claimed_rewards: [...this.state.claimed_rewards],
      completed: this.state.completed,
    };
  }
}
