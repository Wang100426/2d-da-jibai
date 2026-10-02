# 2D大击败 / 2DFight Arena

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
| `Space` | 普通攻击 |
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

## Windows 桌面版 1.4.0-preview

构建 Windows x64 安装程序:

```powershell
npm install
npm run dist:win
```

安装程序生成在 `release-installer/`。便携版可通过 `npm run dist:portable` 构建到 `release-portable/`。桌面程序自带并启动 Flask 服务;作为局域网房主时,请保持桌面程序运行,并允许 Windows 防火墙访问网络。

## 开发

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

---

<a id="2dfight-arena"></a>

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
| `Space` | Basic attack |
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

### Windows desktop release 1.4.0-preview

Build the Windows x64 installer:

```powershell
npm install
npm run dist:win
```

The installer is written to `release-installer/`. Build a portable application with `npm run dist:portable`; its output goes to `release-portable/`. The desktop app bundles and starts Flask. Keep it running while hosting a LAN room, and allow network access through Windows Firewall.

### Development

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
