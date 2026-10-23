# 🏆 2DFight Arena 2.0.0 is HERE!

**Six versions in one drop.** Since 1.5.0 nothing was published individually, so 2.0.0 bundles everything from 1.6.0 through 1.9.0 — **four new heroes**, a new arena, the coin/save/shop economy, the equipment system, a rebuilt home screen — plus a battle-rendering overhaul and a full animation pass. If you have been playing 1.5.0, this is a different game.

* * *

## 🎒 1. Equipment System — 5 Slots, 5 Rarities (1.9.0)

* ✅ **5 slots**: Weapon · Helmet · Armor · Boots · Accessory
* ✅ **5 rarities**: Common · Uncommon · Rare · Epic · Legendary
* ✅ Draw a random piece for **100 coins** on the Equipment page; view, equip, unequip or dismantle on the Backpack page
* ✅ Gear bonuses apply in combat:

| Slot | Bonus |
|------|-------|
| Weapon | Attack |
| Helmet | Defense |
| Armor | Max HP |
| Boots | Movement speed |
| Accessory | Max energy |

* ✅ The test save ships with all **25 pieces** (5 slots × 5 rarities) and legendary gear equipped in every slot

## 🛹 2. New Hero — Skater Boy (1.9.0, 1000 coins)

Street-skateboard brawler, melee, 100 attack range.

* **Passive · Momentum** — every basic attack permanently grants **+0.5% movement speed**; attacks also deal bonus damage equal to *(current speed / base speed − 1) × base damage*
* **Q · Rad Skateboard** — hurl the board like a boomerang, piercing buildings and damaging + stunning for 1s on both the outbound and return path; you move 30% slower while it flies. *T2:* range 350 → 500. *T3:* no self-slow, plus 2 extra boards at the nearest enemies
* **E · Hard Skateboard** — slam the ground for damage and a 20% slow for 3s in a 200 radius. *T2:* slow 20% → 30%. *T3:* radius 200 → 270
* **R · Skate Flight** — 5s of **+30% speed** with other skills locked. SPACE stops being an attack: you go invulnerable, gain another **+20% speed**, leap, and crash down after 1s for damage and heavy knockback. *T2:* 5s → 7s. *T3:* the crash also stuns for 1s

## 🏀 3. New Hero — Basketball Boy (1.9.0, 1500 coins)

Court shooter, ranged, 200 attack range.

* **Passive · Magazine Shooter** — basic attacks become basketball shots. Magazine starts at **10**, **+1 capacity every 5 kills**, fires at 5 shots/s. An empty magazine cannot attack
* **Q · Fast Crossover** — dash through the **5 nearest enemies** in 0.5s (invulnerable), then deal heavy damage 1s later. *T2:* the hit also stuns for 1s. *T3:* 5 → 10 targets
* **E · Layup** — dash up to 350 forward in 1s (invulnerable, blocked by buildings), damaging and stunning enemies at the endpoint for 1s. *T2:* stun +1s. *T3:* two consecutive dashes and strikes
* **R · Sharpshooter** — for 3s your magazine counts as **infinite**. *T2:* fire rate 5/s → 10/s. *T3:* duration +2s and basic attacks ignore range (still blocked by buildings)

## 🌸 4. New Hero — Sakura Girl (1.6.0)

Pink-firework mage, ranged, 250 attack range.

* **Passive · Ignite** — skill hits ignite the target for **5% of your max HP per second** for 3s. Hitting a burning target again raises the burn by **+10% per hit (up to 4×)** and refreshes the duration
* **Q · Sakura Song** — 3s of **+50% movement speed** while taking **no damage**; enemies you run into are damaged and knocked back. *T2:* +1s. *T3:* touched enemies also eat a Sakura Storm
* **E · Summer Festival** — open a festival zone at your basic-attack range; enemies inside take a hit every 0.5s for 3s. *T2:* +1s. *T3:* ticks every 0.25s
* **R · Sakura Storm** — spawn a radius-200 storm on the nearest enemy, pulling everything to the center over 0.5s, then dealing damage and a 1s stun. *T2:* an extra 50% slow for 3s after the stun. *T3:* pull time becomes 1s

## 🗡️ 5. New Hero — Knight-Errant (1.7.0, 1000 coins)

Gold swordsman, melee, 150 attack range.

* **Passive · One-Strike Execution** — for every 1% of health the target is missing, each of your attacks against it gains **+0.6% chance to execute** it instantly
* **Q · Knight-Errant Song** — become **invulnerable** and dash to the nearest enemy within 300 every 0.5s, striking up to 5 times. It never hits the same enemy twice in a row unless that enemy is the only one in range, and stops immediately when the area is empty — unused dashes refund cooldown proportionally. *T2:* each dash also stuns for 0.5s. *T3:* interval 0.25s and up to 10 dashes
* **E · Swordsman's Edge** — empower your next 3 basic attacks with **+20% damage and 10% lifesteal**. *T2:* +20% → +40%. *T3:* lifesteal 10% → 25%
* **R · Sword Flight** — **+50% movement speed and +50% dodge** for 3s. *T2:* 3s → 5s. *T3:* speed +50% → +100%

## 🚉 6. New Map — Neon Station (1.6.0)

Five tracks, six platforms. The waiting hall shows train arrival times and each platform shows the next train.

* ✅ Trains stop for **10 seconds**; a stopped train **blocks movement like a building**, then departs
* ⚠️ Getting clipped by a **moving** train knocks you back and deals heavy damage — mind the schedule

## 🗺️ 7. Map Codex (1.6.5)

* ✅ A dedicated page listing all **7 arenas** at once
* ✅ To-scale layout preview, terrain notes, the map's random event, and building/barrier counts
* ✅ Reachable from the **Codex** entry in the new bottom bar

## 🪙 8. Coins, Save System & Hero Shop (1.7.0)

* ✅ Every single-player roguelike run now banks coins when it ends — on death, or when you quit to hero select
* ✅ Reward: **waves reached × 10 + kills × 1**, capped at **500** per run. AI duels and LAN matches earn nothing
* ✅ Save stores coins and unlocked fighters. Dev builds use `<repo>/save/profile.json`; packaged builds use `%LOCALAPPDATA%/2d-da-jibai/save.json`
* ✅ **Hero Shop** — open it from the coin pill on the home and select screens. Locked fighters can still be inspected, but must be bought first (the enter button becomes "GO TO SHOP")
* ✅ **Save management** panel — review coins and unlocked fighters, export a JSON backup, import one to overwrite the save, and reset behind a two-step confirmation

## 🏠 9. Home Screen & Mode Selection Rebuilt (1.9.0)

* ✅ **Square mode selector on the left, rectangular Start Game button flush against the right wall**
* ✅ New **bottom bar**: Shop · Equipment · Codex · Backpack
* ✅ Mode selection is its own page (`/mode`) with the same sidebar + detail layout as hero select, plus a trapezoid **Confirm** button that saves your pick and returns home
* ✅ Start Game routes to the mode you picked: roguelike → hero select, LAN → lobby, AI duel → duel select

## 🎮 10. Pause Menu & Combat UX (1.7.5)

* ✅ The battle screen's top-right button is now a single **Pause** control (ESC does the same, no more separate "back to select" link)
* ✅ The pause panel shows a full run overview — wave reached, kills this run and passive kills, damage multiplier, attack speed, damage reduction, lifesteal, dodge, attack range, energy regen, supplies collected
* ✅ Two matching buttons: **Resume** and **Exit Run**. Exiting still settles this run's coins
* ✅ Sakura Girl's skill keys were corrected to the universal order: **Q = ultimate, E = first ability, R = second**

## ⚡ 11. Rendering Overhaul (2.0.0)

* ✅ Static map geometry (grid, roads, buildings) is now rasterized **once** instead of being repainted every frame
* ✅ Fixed particle, tablet-projectile and afterimage effects so they draw in the right place at the right time
* ✅ The render loop pauses while the page is hidden and resumes smoothly when you come back
* ✅ Simplified the screen-transition blur to cut paint cost on weaker GPUs

## ✨ 12. Animation Pass (1.7.5)

* ✅ Every button and clickable pill gained a **pressed-state response** (subtle scale) with a unified easing curve
* ✅ Home, select, shop, codex and multiplayer pages gained an **entrance transition** (fade + rise)
* ✅ Hero cards, shop cards and codex cards **cascade in** one by one
* ✅ Internal navigation **fades out** before leaving — external links, downloads, new tabs and the system "reduce motion" preference are unaffected
* ✅ The select screen's roster is now an adaptive multi-column scrolling list with a slim dark scrollbar, and no longer overlaps itself in narrow windows (1.6.5)

## 🐛 13. Fixes & Polish

* 🐛 **Skater Boy's Skate Flight no longer freezes the game** when the slam lands — the flight state was cleared and then read one line later
* 🐛 Fixed the mode page where only the default option responded to clicks — a stray tsconfig inheritance was compiling the entire battle script into `mode.js`
* 🐛 Fixed a battle-load script error on the Moss Guardian caused by passive initialization order (that hero could not start a run at all)
* 🐛 Tech Man's Overclock Protocol stacks are now **permanent**
* 🐛 Fixed untranslated skill-rank labels and missing English text for basic-attack hit messages
* 🐛 Combat text now runs on a **placeholder template system**, killing the mixed Chinese/English lines such as `受到damage降低 45%`

## 🖼️ 14. New Key Art & Launch Screen (2.0.0)

* ✅ The home screen now uses a new **cyber-city arena key art** — neon skyline, a giant VS billboard, reflective plaza
* ✅ New **launch screen**: white background, the publisher logo fades in, then the **48-character Healthy Gaming notice** (6 characters per line × 8 lines) fades in below it, and the home screen appears after about 3 seconds
* ✅ It plays **once per app session** — returning home from a battle skips straight through

# 🚀 Download 2DFight Arena 2.0.0!

Grab the **installer** or the **portable build** from the Assets section below.

---

# 🎉 2D大击败 2.0.0 正式发布！

**六个版本一次交付。** 1.5.0 之后没有单独发过任何版本，所以 2.0.0 把 1.6.0 到 1.9.0 的内容全部打包了 —— **四个新英雄**、一张新地图、金币/存档/商店经济、装备系统、重做的主页 —— 外加一次战斗渲染重构和一整轮动画打磨。如果你还停在 1.5.0，这基本是另一个游戏了。

* * *

## 🎒 1. 装备系统 · 5 个位置，5 种品质（1.9.0）

* ✅ **5 个位置**：武器 · 头盔 · 护甲 · 靴子 · 饰品
* ✅ **5 种品质**：普通 · 精良 · 稀有 · 史诗 · 传说
* ✅ 在装备页花 **100 金币**抽一件；在背包页查看、装备、卸下或分解
* ✅ 装备加成带进战斗：

| 位置 | 加成 |
|------|------|
| 武器 | 攻击 |
| 头盔 | 防御 |
| 护甲 | 生命上限 |
| 靴子 | 移速 |
| 饰品 | 能量上限 |

* ✅ 测试存档自带全部 **25 件**（5 位置 × 5 品质），并且每个位置都装了传说品质

## 🛹 2. 新英雄 · 滑板小子（1.9.0，1000 金币）

街头滑手，近战，普攻距离 100。

* **被动 · 越滑越快** —— 每次普攻永久 **+0.5% 移速**；普攻额外造成 *（当前移速 / 基础移速 − 1）× 基础伤害* 的伤害
* **Q · 炫酷滑板** —— 把滑板当回旋镖扔出去，穿透建筑，来回两段都造成伤害和 1 秒眩晕；滑板飞行期间自身移速 −30%。*2 阶：* 距离 350 → 500。*3 阶：* 自身不减速，并额外向最近 2 个敌人各扔一块滑板
* **E · 坚硬滑板** —— 砸向地面，对 200 范围内的敌人造成伤害并减速 20%，持续 3 秒。*2 阶：* 减速 20% → 30%。*3 阶：* 范围 200 → 270
* **R · 滑板能飞** —— 5 秒内 **+30% 移速**，其他技能锁定。空格不再是普攻：进入无敌、再 **+20% 移速**、跳起，1 秒后砸向地面造成伤害和强力击退。*2 阶：* 5 秒 → 7 秒。*3 阶：* 砸地额外眩晕 1 秒

## 🏀 3. 新英雄 · 篮球少年（1.9.0，1500 金币）

球场射手，远程，普攻距离 200。

* **被动 · 弹夹射手** —— 普攻改为投篮。弹夹初始 **10** 发，**每击杀 5 个敌人 +1 发上限**，以 5 发/秒射出。弹夹为空时无法普攻
* **Q · 快速过人** —— 0.5 秒内穿透 **最近 5 个敌人**（期间无敌），1 秒后造成大额伤害。*2 阶：* 命中同时眩晕 1 秒。*3 阶：* 5 → 10 个目标
* **E · 三步上篮** —— 1 秒内向前冲刺最多 350（期间无敌，会被建筑挡住），终点对敌人造成伤害并眩晕 1 秒。*2 阶：* 眩晕 +1 秒。*3 阶：* 连续两次冲刺与攻击
* **R · 投篮高手** —— 3 秒内弹夹视为 **无限**。*2 阶：* 射速 5/秒 → 10/秒。*3 阶：* 时长 +2 秒，且普攻无视距离（仍会被建筑挡住）

## 🌸 4. 新英雄 · 樱花少女（1.6.0）

粉色花火法师，远程，普攻距离 250。

* **被动 · 引燃** —— 技能命中即引燃目标，每秒造成**自身最大生命值 5%** 的伤害，持续 3 秒。灼烧期间再次被技能命中，每秒伤害 **+10%（最高 4 倍）** 并刷新持续时间
* **Q · 樱花之歌** —— 3 秒内 **+50% 移速**且**免疫伤害**；撞到的敌人被击退并受到伤害。*2 阶：* +1 秒。*3 阶：* 撞到的敌人同时被施加樱花风暴
* **E · 夏日祭** —— 在自身普攻范围展开祭典区域，范围内敌人每 0.5 秒受到一次伤害，持续 3 秒。*2 阶：* +1 秒。*3 阶：* 每 0.25 秒跳一次
* **R · 樱花风暴** —— 在最近敌人处生成半径 200 的风暴，0.5 秒内把范围内敌人卷向中心，随后造成伤害并眩晕 1 秒。*2 阶：* 眩晕后额外减速 50% 持续 3 秒。*3 阶：* 吸引时间延长至 1 秒

## 🗡️ 5. 新英雄 · 江湖客（1.7.0，1000 金币）

金色侠客，近战，普攻距离 150。

* **被动 · 一剑封喉** —— 目标每损失 1% 生命，你每次攻击它都 **+0.6% 概率直接斩杀**
* **Q · 侠客行** —— 进入**无敌**，每 0.5 秒向半径 300 内最近的敌人位移并攻击一次，最多 5 次。不会连续攻击同一个敌人（除非范围内只剩它一个）；范围内没人时立即停止，未用完的位移次数按比例返还冷却。*2 阶：* 每次位移额外眩晕 0.5 秒。*3 阶：* 间隔缩短至 0.25 秒、次数提升到 10 次
* **E · 剑客之刃** —— 强化接下来 3 次普攻，**伤害 +20%、吸血 10%**。*2 阶：* +20% → +40%。*3 阶：* 吸血 10% → 25%
* **R · 御剑飞行** —— 3 秒内 **+50% 移速、+50% 闪避**。*2 阶：* 3 秒 → 5 秒。*3 阶：* 移速 +50% → +100%

## 🚉 6. 新地图 · 霓虹火车站（1.6.0）

5 条铁轨、6 个站台。候车厅显示列车到达时间，每个站台提示下一班列车。

* ✅ 列车进站停靠 **10 秒**，停靠期间**视作建筑无法穿过**，随后驶离
* ⚠️ 被**行驶中**的列车撞到会被击退并受到高额伤害 —— 看好时刻表

## 🗺️ 7. 地图图鉴（1.6.5）

* ✅ 独立页面一次看完全部 **7 张赛场**
* ✅ 按实机布局绘制的缩略图、地形特点、该图随机事件，以及建筑 / 路障数量
* ✅ 从新版底部栏的**图鉴**入口进入

## 🪙 8. 金币、存档系统与英雄商店（1.7.0）

* ✅ 每局单机肉鸽结束时（阵亡，或中途退出返回选人页）都会结算金币
* ✅ 公式：**到达波次 × 10 + 击杀数 × 1**，单局上限 **500**；人机对抗与联机不结算
* ✅ 存档记录金币与已解锁英雄。开发环境在 `<仓库>/save/profile.json`，打包后在 `%LOCALAPPDATA%/2d-da-jibai/save.json`
* ✅ **英雄商店** —— 主页与选人页右上角的金币胶囊都能进入。未解锁英雄仍可查看详情，但要先去商店买下（按钮变为「前往商店」）
* ✅ **存档管理**面板 —— 查看金币与已解锁英雄、导出 JSON 备份、导入覆盖、两步确认后重置

## 🏠 9. 主页与模式选择重做（1.9.0）

* ✅ **左侧方形模式入口，右侧长方形「开始游戏」紧贴右墙**
* ✅ 新增**底部栏**：商店 · 装备 · 图鉴 · 背包
* ✅ 模式选择独立成页（`/mode`），和选人页一样的侧栏 + 详情布局，右下角梯形**「选定」**按钮，选完存下选择并返回主页
* ✅ 「开始游戏」按你选的模式跳转：肉鸽 → 选人，联机 → 大厅，人机 → 人机选人

## 🎮 10. 暂停面板与战斗操作（1.7.5）

* ✅ 战斗页右上角统一为一个**暂停**按钮（ESC 同效，不再有单独的「返回选人」链接）
* ✅ 暂停面板显示完整战况 —— 到达波次、本局与被动累计击杀、伤害倍率、攻速、减伤、吸血、闪避、普攻范围、能量回复、补给拾取
* ✅ 两个同风格按钮：**继续游戏** / **退出本局**。退出同样结算本局金币
* ✅ 樱花少女的技能键位修正为统一顺序：**Q = 大招，E = 一技能，R = 二技能**

## ⚡ 11. 渲染重构（2.0.0）

* ✅ 地图静态几何（网格、道路、建筑）现在只光栅化**一次**，不再逐帧重绘
* ✅ 修复粒子、平板投射物与残影的绘制位置和时机，特效现在跟战斗帧对得上
* ✅ 页面隐藏时暂停渲染循环，回到页面平滑续播
* ✅ 简化过场模糊，降低弱显卡上的绘制开销

## ✨ 12. 动画打磨（1.7.5）

* ✅ 全站按钮与可点击小件新增**按下反馈**（轻微缩放），并统一默认过渡曲线
* ✅ 主页、选人、商店、图鉴与联机页新增**入场过场**（淡入 + 上浮）
* ✅ 英雄卡、商品卡、图鉴卡改为**逐个瀑布式**进入
* ✅ 站内跳转**离场淡出** —— 外链、下载、新标签页与系统「减少动态效果」偏好不受影响
* ✅ 选人页英雄列表改为自适应多列滚动卡片（细的暗色滚动条），修掉窗口变窄时卡片重叠（1.6.5）

## 🐛 13. 修复与打磨

* 🐛 **滑板小子「滑板能飞」砸地后不再卡死** —— 飞行状态被清空后，下一行又去读了它
* 🐛 修复模式页只有默认项能点的问题 —— tsconfig 的继承把整份战斗脚本编译进了 `mode.js`
* 🐛 修复苔藓守卫因被动初始化顺序导致的战斗加载报错（该英雄此前根本无法开局）
* 🐛 科技男「超频协议」的层数改为**永久叠加**
* 🐛 补齐技能阶级的英文翻译，以及各英雄普攻命中的英文提示
* 🐛 战斗文案改用**占位符模板系统**，彻底干掉 `受到damage降低 45%` 这类中英混排

## 🖼️ 14. 全新主视觉与启动画面（2.0.0）

* ✅ 主页换成全新的**赛博都市竞技场主视觉** —— 霓虹天际线、巨型 VS 广告牌、镜面广场
* ✅ 新增**启动画面**：白色背景，发行公司图标渐入，下方**健康游戏公约**（每行 6 字 × 8 行，共 48 字）渐入，约 3 秒后进入主页
* ✅ 每个应用会话只播放**一次** —— 从战斗返回主页直接跳过

# 🚀 快来下载《2D大击败》2.0.0！

**安装包**和**便携版**都在下方 Assets 里。

---

# 🎌 2D大撃破 2.0.0 リリース！

**6 バージョン分を一度に。** 1.5.0 以降は単独リリースがなかったため、2.0.0 には 1.6.0 から 1.9.0 までの内容がすべて入っています —— **新ヒーロー 4 体**、新マップ、コイン／セーブ／ショップ経済、装備システム、刷新されたホーム画面。さらに戦闘描画のリファクタリングとアニメーションの全面調整も含みます。1.5.0 のままだと、もはや別のゲームです。

* * *

## 🎒 1. 装備システム · 5 スロット、5 レアリティ（1.9.0）

* ✅ **5 スロット**：武器 · ヘルム · アーマー · ブーツ · アクセサリー
* ✅ **5 レアリティ**：コモン · アンコモン · レア · エピック · レジェンダリー
* ✅ 装備画面で **100 コイン**で 1 回抽選。バックパック画面で確認・装備・解除・分解
* ✅ 装備ボーナスは戦闘に反映：

| スロット | ボーナス |
|------|-------|
| 武器 | 攻撃力 |
| ヘルム | 防御力 |
| アーマー | 最大 HP |
| ブーツ | 移動速度 |
| アクセサリー | 最大エネルギー |

* ✅ テストセーブには全 **25 種**（5 スロット × 5 レアリティ）が入り、各スロットにレジェンダリーを装備済み

## 🛹 2. 新ヒーロー · スケーターボーイ（1.9.0、1000 コイン）

ストリートスケートの近接ファイター、通常攻撃距離 100。

* **パッシブ · モーメンタム** —— 通常攻撃 1 回ごとに移動速度が永続 **+0.5%**。さらに *（現在速度 / 基礎速度 − 1）× 基礎ダメージ* の追加ダメージ
* **Q · ラッドスケートボード** —— ボードをブーメランのように投げ、建物を貫通。往路・復路の両方でダメージと 1 秒スタン。投擲中は自身の移動速度 −30%。*2 段階目：* 飛距離 350 → 500。*3 段階目：* 自身の減速なし＋最寄りの敵 2 体に追加ボード
* **E · ハードスケートボード** —— 地面に叩きつけ、半径 200 の敵にダメージと 20% 減速（3 秒）。*2 段階目：* 減速 20% → 30%。*3 段階目：* 半径 200 → 270
* **R · スケートフライト** —— 5 秒間 **+30% 移動速度**、他のスキルは使用不可。SPACE は通常攻撃ではなくなり、無敵＋さらに **+20% 移動速度**でジャンプし、1 秒後に着地してダメージと強力なノックバック。*2 段階目：* 5 秒 → 7 秒。*3 段階目：* 着地時に 1 秒スタン追加

## 🏀 3. 新ヒーロー · バスケットボーイ（1.9.0、1500 コイン）

コートシューター、遠距離、通常攻撃距離 200。

* **パッシブ · マガジンシューター** —— 通常攻撃がシュートに。マガジンは初期 **10** 発、**敵を 5 体倒すごとに上限 +1**、毎秒 5 発で射出。空弾時は攻撃不可
* **Q · ファストクロスオーバー** —— 0.5 秒で**最寄りの敵 5 体**を貫通（無敵）、1 秒後に大ダメージ。*2 段階目：* 命中時に 1 秒スタン。*3 段階目：* 5 → 10 体
* **E · レイアップ** —— 1 秒で最大 350 前方へダッシュ（無敵、建物でブロック）。終点の敵にダメージと 1 秒スタン。*2 段階目：* スタン +1 秒。*3 段階目：* 2 連続ダッシュ＆攻撃
* **R · シャープシューター** —— 3 秒間マガジンが**無限**扱い。*2 段階目：* 射速 5/秒 → 10/秒。*3 段階目：* 持続 +2 秒、通常攻撃が距離を無視（建物は貫通不可）

## 🌸 4. 新ヒーロー · サクラ少女（1.6.0）

ピンクの花火メイジ、遠距離、通常攻撃距離 250。

* **パッシブ · 着火** —— スキル命中で対象を着火し、毎秒**自身の最大 HP の 5%** を 3 秒間与える。燃焼中に再度スキルが命中すると毎秒ダメージ **+10%（最大 4 倍）**、持続時間も更新
* **Q · サクラソング** —— 3 秒間 **+50% 移動速度**かつ**無敵**。触れた敵はダメージとノックバック。*2 段階目：* +1 秒。*3 段階目：* 触れた敵にサクラストームも発動
* **E · 夏祭り** —— 自身の通常攻撃範囲に祭りエリアを展開し、範囲内の敵に 0.5 秒ごとにダメージを 3 秒間与える。*2 段階目：* +1 秒。*3 段階目：* 0.25 秒ごとに発生
* **R · サクラストーム** —— 最寄りの敵の位置に半径 200 の嵐を生成し、0.5 秒かけて範囲内の敵を中心へ引き寄せ、その後ダメージと 1 秒スタン。*2 段階目：* スタン後に 50% スローを 3 秒追加。*3 段階目：* 引き寄せ時間が 1 秒に

## 🗡️ 5. 新ヒーロー · 江湖客（1.7.0、1000 コイン）

金色の剣客、近接、通常攻撃距離 150。

* **パッシブ · 一撃必殺** —— 相手の HP が 1% 減るごとに、こちらの攻撃 1 回につき **+0.6% の即死確率**
* **Q · 侠客行** —— **無敵**になり、0.5 秒ごとに半径 300 内の最寄りの敵へ突進して攻撃、最大 5 回。範囲内に他に敵がいる限り同じ敵を連続攻撃せず、敵がいなければ即停止。残りクールダウンは実際の突進回数に比例して返還。*2 段階目：* 各突進に 0.5 秒スタン追加。*3 段階目：* 間隔 0.25 秒・最大 10 回
* **E · 剣客の刃** —— 次の通常攻撃 3 回を強化し、**ダメージ +20%・吸血 10%**。*2 段階目：* +20% → +40%。*3 段階目：* 吸血 10% → 25%
* **R · 御剣飛行** —— 3 秒間 **+50% 移動速度・+50% 回避**。*2 段階目：* 3 秒 → 5 秒。*3 段階目：* 移動速度 +50% → +100%

## 🚉 6. 新マップ · ネオン駅（1.6.0）

線路 5 本、ホーム 6 面。待合ホールに列車の到着時刻、各ホームに次の列車を表示。

* ✅ 列車は **10 秒間停車**し、停車中は**建物として通行を阻み**、その後発車
* ⚠️ **走行中**の列車に接触するとノックバックと大ダメージ —— 時刻表に注意

## 🗺️ 7. マップ図鑑（1.6.5）

* ✅ 全 **7 マップ**を一度に一覧できる専用ページ
* ✅ 実レイアウトを縮小したサムネイル、地形の特徴、そのマップのランダムイベント、建物／バリケード数
* ✅ 新しいボトムバーの**図鑑**入口から

## 🪙 8. コイン、セーブ、ヒーローショップ（1.7.0）

* ✅ シングルプレイのローグ 1 回が終わるたび（敗北時、または途中でヒーロー選択へ戻った時）にコインを精算
* ✅ 計算式：**到達ウェーブ × 10 ＋ 撃破数 × 1**、1 回の上限は **500**。CPU 対戦と LAN 対戦では貯まらない
* ✅ セーブにはコインと解放済みヒーローを記録。開発時は `<リポジトリ>/save/profile.json`、パッケージ版は `%LOCALAPPDATA%/2d-da-jibai/save.json`
* ✅ **ヒーローショップ** —— ホーム画面とヒーロー選択画面の右上のコイン表示から。未解放ヒーローは能力を確認できるが、先に購入が必要（ボタンが「ショップへ」に変化）
* ✅ **セーブ管理**パネル —— コインと解放済みヒーローの確認、JSON バックアップの書き出し、読み込みによる上書き、2 段階確認つきリセット

## 🏠 9. ホーム画面とモード選択を刷新（1.9.0）

* ✅ **左に四角いモード入口、右壁際に長方形の「ゲーム開始」**
* ✅ 新**ボトムバー**：ショップ · 装備 · 図鑑 · バックパック
* ✅ モード選択は独立ページ（`/mode`）。ヒーロー選択と同じサイドバー＋詳細レイアウトで、右下の台形**「決定」**ボタンで選択を保存してホームへ戻る
* ✅ 「ゲーム開始」は選んだモードへ遷移：ローグ → ヒーロー選択、LAN → ロビー、CPU 対戦 → 対戦選択

## 🎮 10. ポーズパネルと戦闘操作（1.7.5）

* ✅ 戦闘画面の右上を単一の**ポーズ**ボタンに統一（ESC も同じ。「ヒーロー選択へ戻る」リンクは廃止）
* ✅ ポーズパネルに戦況の全体像 —— 到達ウェーブ、今回とパッシブの累計撃破、ダメージ倍率、攻撃速度、被ダメ軽減、吸血、回避、通常攻撃距離、エネルギー回復、補給回収
* ✅ 同スタイルの 2 ボタン：**続ける** / **リタイア**。リタイア時もコインは精算
* ✅ 桜少女のスキルキーを統一順に修正：**Q = アルティメット、E = スキル 1、R = スキル 2**

## ⚡ 11. 描画リファクタリング（2.0.0）

* ✅ マップの静的ジオメトリ（グリッド、道路、建物）を**一度だけ**ラスタライズし、毎フレームの再描画を廃止
* ✅ パーティクル、タブレット投射物、残像の描画位置とタイミングを修正し、戦闘フレームと同期
* ✅ ページが非表示の間は描画ループを停止し、復帰時に滑らかに再開
* ✅ 画面遷移のぼかしを簡略化し、低スペック GPU での負荷を軽減

## ✨ 12. アニメーション調整（1.7.5）

* ✅ 全ボタンとクリック可能な要素に**押下フィードバック**（軽い縮小）と統一イージング
* ✅ ホーム・選択・ショップ・図鑑・マルチプレイ画面に**入場トランジション**（フェード＋スライド）
* ✅ ヒーローカード、ショップカード、図鑑カードが**順番に**登場
* ✅ サイト内遷移時に**フェードアウト** —— 外部リンク、ダウンロード、新規タブ、「動きを減らす」設定は対象外
* ✅ ヒーロー選択のリストを可変多列スクロールカード（細いダークスクロールバー）に変更し、狭いウィンドウでの重なりを修正（1.6.5）

## 🐛 13. 修正と調整

* 🐛 **スケーターボーイの「スケートフライト」着地後にフリーズしなくなった** —— 飛行状態をクリアした直後の行で参照していた
* 🐛 モード画面で既定の項目しかクリックできなかった問題を修正 —— tsconfig の継承が戦闘スクリプト全体を `mode.js` に混入させていた
* 🐛 パッシブ初期化順序が原因のモスガーディアン戦闘開始時エラーを修正（このヒーローは開局できなかった）
* 🐛 テックファイター「オーバークロックプロトコル」のスタックを**永続化**
* 🐛 スキル段階ラベルの未翻訳と、通常攻撃命中メッセージの英語欠落を修正
* 🐛 戦闘テキストを**プレースホルダーのテンプレート方式**に変更し、`受到damage降低 45%` のような中国語混在を根絶

## 🖼️ 14. 新しいキービジュアルと起動画面（2.0.0）

* ✅ ホーム画面を新しい**サイバー都市アリーナのキービジュアル**に変更 —— ネオンのスカイライン、巨大な VS ビルボード、鏡面の広場
* ✅ 新**起動画面**：白い背景に発行元のロゴがフェードインし、その下に**健康ゲームのお知らせ**（1 行 6 文字 × 8 行、計 48 文字）がフェードイン、約 3 秒後にホーム画面へ
* ✅ **1 セッションにつき 1 回**のみ再生 —— 戦闘からホームへ戻る時はスキップ

# 🚀 2D大撃破 2.0.0 をダウンロード！

**インストーラー**と**ポータブル版**は下の Assets から。

---

## ⭐ Support Us

If you enjoy the game, a **Star** on this repo keeps the arena running.

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v1.5.0...v2.0.0
