# 2D大击败 / 2DFight Arena
[![GitHub stars](https://img.shields.io/github/stars/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/stargazers) [![GitHub forks](https://img.shields.io/github/forks/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/network/members) [![GitHub issues](https://img.shields.io/github/issues/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/issues) [![GitHub release](https://img.shields.io/github/v/release/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/releases)

**中文** | [English](#2dfight-arena)

《2D大击败》是一款基于 Flask、HTML、CSS 和 TypeScript 的赛博风 2D 战斗竞技场游戏。选择英雄,在霓虹废墟中迎战敌人、挑战 AI,或与局域网好友组队。游戏支持中英文界面,英文名称为 **2DFight Arena**。主页采用精简设计,以全新背景和单一入口整合所有游戏玩法,可一键进入游戏。

## 游戏模式

- **单机肉鸽**:挑战不断增强的敌潮,每波结束后选择战斗强化。击败敌人可获得技能经验,升级时可强化英雄技能;肉鸽战斗支持暂停。
- **随机地图事件**:每局随机进入霓虹城区、赛博医院、赛博琴房、赛博体育馆、赛博机场或赛博校园。地图事件包括高速车流、麻醉医生、音场竖琴、健身房冲锋者和机场航班。
  - **赛博校园**:不定期上课,每次持续 10 秒;上课期间所有人(包括敌人)的移动速度、攻击速度和造成的伤害都会大幅降低。
  - **机场航班调度**:航班随波次持续循环放行,同时在途飞机逐波增加,最多可让八条跑道全部运行;每架飞机离场后会安排后续航班,跑道不会被起降飞机同时占用。
- **战场过渡页**:使用全屏战场概览图,展示地图和特殊事件,左下角显示出战角色;淡入淡出与右下角加载动画持续 5 秒。
- **人机对抗**:与 AI 一对一较量,先赢得四分获胜。每回合结束后可选择强化,十秒后开始下一回合。
- **局域网联机**:创建或加入房间,与同一局域网的玩家共同战斗。玩家位置、玩家间攻击伤害、生命、能量和控制效果由 Flask 房间服务同步。

## 操作

| 按键 | 操作 |
| --- | --- |
| `WASD` / 方向键 | 移动 |
| `Q`、`E`、`R` | 施放英雄技能 |
| `Space`（可按住） | 普通攻击，按住连续攻击 |
| `F` | 拾取附近物资 |
| `P` / `Esc` | 暂停或继续单机肉鸽战斗 |
| 触控模式 | 在战斗页右上角开启方向键、技能与普攻触控按钮 |

普通攻击基础攻速为每秒两次,可通过强化提升。英雄拥有不同技能和防御能力;琵琶女可召唤小兵吸引敌人注意力,并使用「金蛇狂舞」使敌人陷入混乱、互相攻击。肉鸽强化还包括攻击、防御、吸血、闪避、移动速度、能量恢复和冷却缩减。击败敌人可获得技能经验,技能通过小强化逐步升阶并解锁新效果。

## 本地运行

需要 Python、Node.js 和 npm。安装依赖、构建前端并启动 Flask:

```powershell
pip install -r requirements.txt
npm install
npm run build
python app.py
```

也可以运行 `python server_gui.py` 启动带局域网地址显示的服务。局域网玩家连接同一网络后,可在浏览器中打开主机显示的地址。房间状态保存在内存中,服务停止后会清除。

## Windows 桌面版 1.4.0

构建 Windows x64 安装程序:

```powershell
npm install
npm run dist:win
```

安装程序生成在 `release-installer/`。便携版可通过 `npm run dist:portable` 构建到 `release-portable/`。桌面程序自带并启动 Flask 服务;作为局域网房主时,请保持桌面程序运行,并允许 Windows 防火墙访问网络。

## 开发

- `app.py` 的 `HEROES`:英雄的唯一数据源,包含配色、战斗数值与技能
- `frontend/map.ts`:地图与战斗逻辑
- `frontend/select.ts`:英雄选择页面
- `frontend/multiplayer.ts`:联机大厅
- `locale/zh.json`、`locale/en.json`:中英文语言包
- `static/app.js`、`static/select.js`、`static/multiplayer.js`:由 TypeScript 编译生成,请修改对应的 `frontend/*.ts` 源文件

```powershell
npm run typecheck
npm run build
```

浏览器标签页和桌面窗口图标会随所选语言切换。中文图标为 `assets/2d_da_jibai_ico.ico`,英文图标为 `assets/2d_da_jibai_ico_en.ico`。新增或修改界面、英雄、强化、战斗提示和联机大厅文案时,请保持两份语言包的键结构一致。

### 英雄被动

每位英雄都有一个被动技能，在选人页展示。被动数值配置在 `app.py` 对应英雄的 `passive` 字段：

| 英雄 | 被动 | 效果 |
| --- | --- | --- |
| 霓虹拳王 | 突破极限 | 每普攻 1 次，攻速 +0.05 次/秒，对该英雄取消攻速上限 |
| 苔藓守卫 | 苔藓馈赠 | 初始吸血 10%，每次击杀 +1% 吸血，对该英雄取消吸血上限 |
| 月蚀术士 | 月相扩张 | 每次击杀普攻范围 +5（无上限）；每击杀 20 次，下一次大招额外降落一颗陨石 |
| 科技男 | 超频协议 | 每击杀 20 次，下一次施放的技能获得强化：二技能多 1 次往返、一技能多发射 1 块击退平板、大招伤害 +20% |
| 琵琶女 | 弦音不绝 | 每通过狂舞击杀 3 次或小兵击杀 10 次后，**十面埋伏此后每次施放都多召唤 1 名小兵**（可叠加层数）；大招狂舞时间 +1 秒 |
| 电音人 | 共鸣 | 被技能击中 3 次的敌人陷入 3 秒狂舞；对狂舞中的敌人伤害 +50% |

月蚀术士的额外陨石会落在**施法范围内不是最近的那个敌人**身上；若范围内没有第二个目标则不投放。
科技男的强化是一次性的「窗口」，用错技能不会浪费，下次施放对应技能时仍然生效。

**新增被动**只需在 `HEROES` 里加 `passive` 字段，字段含义：

```python
"passive": {
    "id": "volt_limit_break",
    "init": {"lifesteal": 0.1},        # 开局即生效
    "on_basic_attack": {"attack_speed": 0.05},   # 每次普攻
    "on_kill": {"lifesteal": 0.01},    # 每次击杀
    "uncapped": ["attack_speed"],      # 取消这些属性的上限
    "every_kills": 20,                 # 每 N 次击杀授予一次强化窗口
    "every_kills_effect": "extra_meteor",   # 窗口对应的效果 id
    "frenzy_kills": 3,                 # 阈值型：狂舞击杀累计到 N 时触发
    "minion_kills": 10,                # 阈值型：小兵击杀累计到 N 时触发
    "threshold_effect": "extra_minion",     # 触发后授予的**永久**加成
    "minion_bonus": 1,                 # 每次触发增加的层数
}
```

「阈值型」被动（`threshold_effect`）与「窗口型」（`every_kills_effect`）的区别：
窗口型是**一次性**的，用掉即结束（`consumeBurst`）；阈值型是**永久叠加**的，
层数记在 `passiveState.minionBonus`，每次技能施放都生效。两者不要混用。

属性名用 snake_case，与 `playerState` 字段的对应关系由前端的 `PASSIVE_STAT_FIELDS` 显式声明。

### 电音人

第六位英雄，紫色电音主题，远程型。

| 技能 | 效果 | 2 阶 | 3 阶 |
| --- | --- | --- | --- |
| 音浪冲击 | 朝移动方向射出音浪，命中造成伤害并击退；撞到建筑原地爆炸造成范围伤害 | 飞行更远（420 → 550） | 穿过建筑，击中 2 个敌人后自爆 |
| 低音震荡 | 强化下次普攻，伤害 +50% 并附加 3 秒狂舞（**不计入被动层数**） | 伤害变为 200% | 计入被动层数；若此击叠满 3 层则立即消耗，狂舞延长至 9 秒 |
| 碟片风暴 | 向最近的敌人连续投出 10 枚追踪唱片，每枚造成伤害与小击退 | 唱片数量 +4 | 唱片伤害 +50% |

「同一次施法对同一敌人只记 1 层被动」由 `resonanceCasts` 集合保证——
碟片风暴一次扔 10 枚，但每张碟片共用同一个 `castId`，所以对单个敌人只 +1 层。
需要 3 次**施法**才能叠满。

### 新增英雄

英雄的机制全部集中在 `app.py` 的 `HEROES` 列表,新增一位英雄通常只需要改这一个文件,加上两份语言包。

**1. 在 `HEROES` 里追加一条记录**

```python
{
    "id": "nova",                    # 唯一标识,联机协议与 URL 使用
    "name": "nova",                  # 中文名(会被语言包覆盖)
    "class_name": "定位名",
    "tagline": "一句话介绍",
    "initial": "词",                  # 头像里的单字
    "accent": "nova",                # 主题色键,只用于 CSS 与配色索引
    "palette": {"main": "#..", "light": "#..", "dark": "#.."},
    "stats": {"攻击": 80, "防御": 60, "机动": 70},
    "combat": {
        "speed": 235,                # 移动速度
        "basic_range": 120,          # 普攻距离
        "basic_damage": 15,          # 普攻伤害
        "basic_effect": "",          # 普攻附带状态(禁锢/减速/眩晕…),空为无
        "basic_effect_turns": 0,
        "basic_beam": None,          # 普攻光效 {"color": "#..", "duration": 0.24}
        "basic_restore_label": "MELEE_RESTORE",   # 普攻按钮副标题的语言包键
        "bot_skill_effect": "眩晕",  # 人机对手的技能效果与倍率
        "bot_skill_effect_turns": 0.8,
        "bot_skill_damage_scale": 2.2,
        "thorns_damage": 0,          # 反伤数值,0 为无反伤
    },
    "skills": [ /* 三个技能,顺序即 Q / E / R */ ],
}
```

**2. 技能的 2 / 3 阶效果写在技能自身的 `tier_effects`**

```python
"tier_effects": {
    2: {"label": "作用范围 +40", "patch": {"radius": {"add": 40}}},
    3: {"label": "伤害提高 30%", "patch": {"damage": {"scale": 1.3}}},
}
```

`patch` 的键是技能字段名,支持 `add`(相加)、`scale`(相乘,默认取整,`"round": False` 保留小数)、
`set`(直接赋值)、`base`(字段不存在时的初值)。若效果要改玩家状态而非技能,用 `player_patch`,
例如苔藓守卫 3 阶的荆棘反伤:

```python
3: {"label": "减伤提升,荆棘反伤提高至 20",
    "player_patch": {"thornDamageMultiplier": {"set": 0.3}, "thornReturnDamage": {"set": 20}}}
```

**3. 在两份语言包里补条目**

- `heroes.<id>`:`name`、`class_name`、`tagline`、`initial`、`stats`(三项标签的翻译)、`skills.<skill_id>`
  的 `name` / `description` / `detail_description` / `kind`
- `tier_labels`:升阶文案。`zh.json` 保持中文原文(键值相同),`en.json` 写英文翻译
- `battle.basic_hit.<id>`:该英雄的普攻命中提示,`{damage}` 为伤害占位符
- 若技能使用了新的状态效果,还需补 `battle.effects`(效果名)、`battle.messages`(提示文案),
  并在 `frontend/map.ts` 的 `negativeEffects` 与 `colorsByEffect` 中登记

**4. 技能逻辑**

技能的 `action` 字段决定前端如何执行。复用现有 `action`(如 `dash_aoe`、`luna_moonfall`)时无需改动前端;
若要新增一种技能表现,在 `frontend/map.ts` 的 `castSkill()` 中加一个分支,并同步
`app.py` 的 `apply_player_attack()` 让联机模式能正确校验与结算。

**配色说明**:`palette` 会以 `--hero-main` / `--hero-light` / `--hero-dark` 三个 CSS 变量注入,
`static/style.css`、`static/map.css`、`static/multiplayer.css` 中的头像样式已基于这些变量,
因此新英雄无需额外编写 CSS。变量只作为兜底,`.roster-choice.green` 这类旧类名仍可覆盖它。

**注意事项**:`stats` 中只有「防御」直接影响数值(`min(0.6, 防御 / 250)` 减伤),
「攻击」和「机动」目前仅用于选人页展示。

---

<a id="2dfight-arena"></a>

[![GitHub stars](https://img.shields.io/github/stars/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/stargazers) [![GitHub forks](https://img.shields.io/github/forks/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/network/members) [![GitHub issues](https://img.shields.io/github/issues/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/issues) [![GitHub release](https://img.shields.io/github/v/release/Wang100426/2d-da-jibai?style=flat-square)](https://github.com/Wang100426/2d-da-jibai/releases)

## 2DFight Arena

**English** | [中文](#2d大击败--2dfight-arena)

2DFight Arena is a cyberpunk 2D combat arena built with Flask, HTML, CSS, and TypeScript. Pick a hero, fight through neon ruins, challenge an AI opponent, or battle with friends over a local network. The interface is available in English and Chinese. The redesigned home page has a new background and brings all game modes together under one button for one-click entry.

### Game modes

- **Roguelike**: Survive escalating enemy waves and choose a combat upgrade after each wave. Defeating enemies grants skill experience; leveling up lets you improve a hero skill. Solo runs can be paused.
- **Random map events**: Each run randomly takes place in the Neon District, Cyber Hospital, Cyber Music Hall, Cyber Gymnasium, Cyber Airport, or Cyber Campus. Events include traffic surges, anesthetists, damaging harp fields, charging bruisers, and runway flights.
  - **Class time**:Classes occur irregularly at Cyber Campus and last 10 seconds; during class, everyone's movement speed, attack speed, and damage are greatly reduced, including enemies.
  - **Airport traffic**: Flights cycle continuously and the number of active aircraft rises with each wave, up to all eight runways in use. Departures and arrivals share no runway while it is occupied.
- **Battle transition**: A full-screen arena overview shows the map and special event, with the selected fighter in the lower-left corner and a loading animation at lower right for 5 seconds.
- **AI duel**: Fight one-on-one against an AI opponent. The first fighter to win four rounds takes the match. Choose an upgrade between rounds; the next round starts after ten seconds.
- **LAN multiplayer**: Create or join a room and play with people on the same local network. The Flask room service synchronizes player positions, PvP damage, health, energy, and crowd-control effects.

### Controls

| Key | Action |
| --- | --- |
| `WASD` / Arrow keys | Move |
| `Q`, `E`, `R` | Cast hero skills |
| `Space` (holdable) | Basic attack; hold to attack continuously |
| `F` | Collect nearby supplies |
| `P` / `Esc` | Pause or resume a solo roguelike run |
| Touch mode | Enable the movement pad, skills, and basic-attack button from the battle screen |

Basic attacks start at two attacks per second and can be improved with upgrades. Heroes have distinct skills and defenses; Pipa Girl can summon minions to draw enemy attention, then use “Golden Snake Dance” to confuse enemies and make them attack one another. Roguelike upgrades can also improve attack, defense, lifesteal, dodge, movement, energy regeneration, and cooldown reduction. Skill upgrades unlock new effects as skills rank up.

### Run locally

Install Python and Node.js, then install dependencies, build the frontend, and start Flask:

```powershell
pip install -r requirements.txt
npm install
npm run build
python app.py
```

Alternatively, run `python server_gui.py` to start the server with a LAN address display. Players must be on the same network to join using the host's address. Room state is kept in memory and is cleared when the server stops.

### Windows desktop release 1.4.0

Build the Windows x64 installer:

```powershell
npm install
npm run dist:win
```

The installer is written to `release-installer/`. Build a portable application with `npm run dist:portable`; its output goes to `release-portable/`. The desktop app bundles and starts Flask. Keep it running while hosting a LAN room, and allow network access through Windows Firewall.

### Development

- `app.py` `HEROES`: the single source of truth for heroes, holding palettes, combat stats, and skills
- `frontend/map.ts`: map and combat logic
- `frontend/select.ts`: hero selection page
- `frontend/multiplayer.ts`: multiplayer lobby
- `locale/zh.json`, `locale/en.json`: Chinese and English language packs
- `static/app.js`, `static/select.js`, `static/multiplayer.js`: generated TypeScript outputs; edit the corresponding `frontend/*.ts` files instead

```powershell
npm run typecheck
npm run build
```

The browser-tab and desktop-window icons follow the selected language. The Chinese icon is `assets/2d_da_jibai_ico.ico`; the English icon is `assets/2d_da_jibai_ico_en.ico`. Keep the two locale files' key structures aligned when adding or changing UI, hero, upgrade, battle, or lobby text.

### Hero passives

Every hero has a passive shown on the selection page. Passive values live in the `passive` field of each
hero in `app.py`:

| Hero | Passive | Effect |
| --- | --- | --- |
| Neon Champion | Limit Break | +0.05 attack speed per basic attack; this hero has no attack-speed cap |
| Moss Guardian | Moss Gift | Starts with 10% lifesteal, +1% per kill; this hero has no lifesteal cap |
| Moon-Eclipse Sorcerer | Lunar Expansion | +5 basic attack range per kill (no cap); every 20 kills your next ultimate drops an extra meteor |
| Tech Man | Overclock Protocol | Every 20 kills your next skill cast is empowered: +1 afterimage round trip, +1 knockback tablet, and +20% ultimate damage |
| Pipa Girl | Endless Strings | After 3 frenzy kills or 10 minion kills, **Ten Ambush summons one extra minion on every cast from then on** (stacks); frenzy lasts +1s |
| DJ Volt | Resonance | Enemies hit by your skills 3 times enter 3s frenzy; +50% damage to frenzied enemies |

Lunar Expansion drops the extra meteor on an enemy **inside cast range that is not the nearest one**; if
there is no second target in range, no extra meteor is dropped. Overclock Protocol is a single-use window —
casting the wrong skill does not waste it, and the buff still applies to the next matching cast.

**Adding a passive** only requires a `passive` field in `HEROES`:

```python
"passive": {
    "id": "volt_limit_break",
    "init": {"lifesteal": 0.1},                    # applied at run start
    "on_basic_attack": {"attack_speed": 0.05},     # per basic attack
    "on_kill": {"lifesteal": 0.01},                # per kill
    "uncapped": ["attack_speed"],                  # lift the cap on these stats
    "every_kills": 20,                             # grant a buff window every N kills
    "every_kills_effect": "extra_meteor",          # effect id the window applies to
    "frenzy_kills": 3,                             # threshold for one kill source
    "minion_kills": 10,                            # threshold for the other source
    "threshold_effect": "extra_minion",            # grants a permanent stacking bonus
    "minion_bonus": 1,                             # bonus amount granted per threshold
}
```

「阈值型」被动（`threshold_effect`）与「窗口型」（`every_kills_effect`）的区别：
窗口型是**一次性**的，用掉即结束（`consumeBurst`）；阈值型是**永久叠加**的，
层数记在 `passiveState.minionBonus`，每次技能施放都生效。两者不要混用。

Stat names are snake_case; the mapping to `playerState` fields is declared explicitly in the frontend's
`PASSIVE_STAT_FIELDS`.

### DJ Volt

The sixth hero, a ranged purple-audio fighter.

| Skill | Effect | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Sound Wave | Fires a wave along your movement direction, dealing damage and heavy knockback; it explodes on buildings for area damage | Travels further (420 → 550) | Phases through buildings and self-destructs after hitting 2 enemies |
| Bass Boost | Empowers your next basic attack for +50% damage plus 3s frenzy (**does not count as a skill hit**) | Damage becomes 200% | Counts as a skill hit; if it completes 3 stacks the stacks are consumed instantly and frenzy lasts 9s |
| Disc Storm | Hurls 10 homing records at nearby enemies, each dealing damage with light knockback | +4 records | Record damage +50% |

"Each cast counts only 1 stack per enemy" is enforced by the `resonanceCasts` set: Disc Storm throws
10 records but all of them share one `castId`, so a single enemy only gains 1 stack. It takes
**3 casts** to fill the meter.

### Adding a hero

Hero mechanics live entirely in the `HEROES` list in `app.py`, so a new hero usually means editing that one file plus the two language packs.

**1. Append an entry to `HEROES`**

```python
{
    "id": "nova",                    # unique id used by the multiplayer protocol and URLs
    "name": "nova",                  # Chinese name (overridden by the language pack)
    "class_name": "role",
    "tagline": "one-line pitch",
    "initial": "glyph",              # single character shown in the portrait
    "accent": "nova",                # theme key, used only for CSS and palette lookup
    "palette": {"main": "#..", "light": "#..", "dark": "#.."},
    "stats": {"攻击": 80, "防御": 60, "机动": 70},
    "combat": {
        "speed": 235,                # movement speed
        "basic_range": 120,          # basic attack range
        "basic_damage": 15,          # basic attack damage
        "basic_effect": "",          # status applied on hit (禁锢/减速/眩晕…), empty for none
        "basic_effect_turns": 0,
        "basic_beam": None,          # hit beam {"color": "#..", "duration": 0.24}
        "basic_restore_label": "MELEE_RESTORE",   # locale key for the attack button subtitle
        "bot_skill_effect": "眩晕",  # AI opponent skill effect and multipliers
        "bot_skill_effect_turns": 0.8,
        "bot_skill_damage_scale": 2.2,
        "thorns_damage": 0,          # thorn retaliation damage, 0 for none
    },
    "skills": [ /* three skills, in Q / E / R order */ ],
}
```

**2. Declare tier 2 and 3 effects on each skill's own `tier_effects`**

```python
"tier_effects": {
    2: {"label": "作用范围 +40", "patch": {"radius": {"add": 40}}},
    3: {"label": "伤害提高 30%", "patch": {"damage": {"scale": 1.3}}},
}
```

`patch` keys are skill field names and accept `add`, `scale` (rounded by default; pass `"round": False`
to keep decimals), `set`, and `base` (the value used when the field is absent). To change player state
rather than the skill, use `player_patch` — for example Moss Guardian's tier 3 thorns:

```python
3: {"label": "减伤提升,荆棘反伤提高至 20",
    "player_patch": {"thornDamageMultiplier": {"set": 0.3}, "thornReturnDamage": {"set": 20}}}
```

**3. Add locale entries to both packs**

- `heroes.<id>`: `name`, `class_name`, `tagline`, `initial`, `stats` (the three stat labels), and each
  `skills.<skill_id>` entry with `name` / `description` / `detail_description` / `kind`
- `tier_labels`: tier-up text. `zh.json` keeps the Chinese source (key equals value); `en.json` holds the translation
- `battle.basic_hit.<id>`: that hero's basic-attack hit message, with `{damage}` as the damage placeholder
- If a skill introduces a new status effect, also add `battle.effects` (the effect name) and
  `battle.messages` (toast text), then register it in `negativeEffects` and `colorsByEffect`
  in `frontend/map.ts`

**4. Skill logic**

A skill's `action` field decides how the frontend runs it. Reusing an existing `action` (such as
`dash_aoe` or `luna_moonfall`) requires no frontend change. To add a new kind of skill behaviour,
add a branch in `castSkill()` in `frontend/map.ts` and mirror it in `apply_player_attack()` in
`app.py` so multiplayer validates and resolves it correctly.

**Palette note:** `palette` is injected as the CSS variables `--hero-main`, `--hero-light`, and
`--hero-dark`. Portrait styling in `static/style.css`, `static/map.css`, and
`static/multiplayer.css` is already built on those variables, so a new hero needs no extra CSS.
The variables act as a fallback, and legacy class names like `.roster-choice.green` can still override them.

**Caveat:** only the 防御 stat affects real numbers (`min(0.6, defense / 250)` damage reduction);
攻击 and 机动 are currently display-only on the selection page.
