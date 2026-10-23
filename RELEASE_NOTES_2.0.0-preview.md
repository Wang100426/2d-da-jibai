# 🏆 2DFight Arena 2.0.0-preview is HERE!

A big one. **2.0.0-preview** folds the never-published 1.9.0 work — the equipment system, two new fighters and a rebuilt home screen — together with a battle-rendering overhaul. Fewer pixels redrawn per frame, more things to collect.

* * *

## ⚡ 1. Rendering Overhaul — Fewer Draw Calls, Smoother Fights

* ✅ Static map geometry (grid, roads, buildings) is now rasterized **once** instead of being repainted every frame
* ✅ Fixed particle, tablet-projectile and afterimage effects so they draw in the right place at the right time
* ✅ The render loop pauses while the page is hidden and resumes smoothly when you come back
* ✅ Simplified the screen-transition blur to cut paint cost on weaker GPUs

## 🎒 2. Equipment System — 5 Slots, 5 Rarities

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

## 🛹 3. New Hero — Skater Boy (1000 coins)

Street-skateboard brawler, melee, 100 attack range.

* **Passive · Momentum** — every basic attack permanently grants **+0.5% movement speed**; attacks also deal bonus damage equal to *(current speed / base speed − 1) × base damage*
* **Q · Rad Skateboard** — hurl the board like a boomerang, piercing buildings and damaging + stunning for 1s on both the outbound and return path; you move 30% slower while it flies. *Tier 2:* range 350 → 500. *Tier 3:* no self-slow, plus 2 extra boards at the nearest enemies
* **E · Hard Skateboard** — slam the ground for damage and a 20% slow for 3s in a 200 radius. *Tier 2:* slow 20% → 30%. *Tier 3:* radius 200 → 270
* **R · Skate Flight** — 5s of **+30% speed**, other skills locked. SPACE stops being an attack: you go invulnerable, gain another **+20% speed**, leap, and crash down after 1s for damage and heavy knockback. *Tier 2:* 5s → 7s. *Tier 3:* the crash also stuns for 1s

## 🏀 4. New Hero — Basketball Boy (1500 coins)

Court shooter, ranged, 200 attack range.

* **Passive · Magazine Shooter** — basic attacks become basketball shots. Magazine starts at **10**, **+1 capacity every 5 kills**, fires at 5 shots/s. An empty magazine cannot attack
* **Q · Fast Crossover** — dash through the **5 nearest enemies** in 0.5s (invulnerable), then deal heavy damage 1s later. *Tier 2:* the hit also stuns for 1s. *Tier 3:* 5 → 10 targets
* **E · Layup** — dash up to 350 forward in 1s (invulnerable, blocked by buildings), damaging and stunning enemies at the endpoint for 1s. *Tier 2:* stun +1s. *Tier 3:* two consecutive dashes and strikes
* **R · Sharpshooter** — for 3s your magazine counts as **infinite**. *Tier 2:* fire rate 5/s → 10/s. *Tier 3:* duration +2s and basic attacks ignore range (still blocked by buildings)

## 🏠 5. Home Screen & Mode Selection Rebuilt

* ✅ **Square mode selector on the left, rectangular Start Game button flush against the right wall**
* ✅ New **bottom bar**: Shop · Equipment · Codex · Backpack
* ✅ Mode selection is now its own page (`/mode`) with the same sidebar + detail layout as hero select, and a trapezoid **Confirm** button that saves your pick and returns home
* ✅ The Start Game button routes to the mode you picked: roguelike → hero select, LAN → lobby, AI duel → duel select

## 🐛 6. Fixes & Polish

* 🐛 **Skater Boy's Skate Flight no longer freezes the game** when the slam lands — the flight state was cleared and then read one line later
* 🐛 Fixed the mode page where only the default option responded to clicks — a stray tsconfig inheritance was compiling the entire battle script into `mode.js`
* 🎮 The battle screen's top-right button is now a single **Pause** button (ESC does the same), and the pause panel shows a full stats overview with matching **Resume** / **Exit Run** buttons
* 🎨 Sakura Girl's skill keys were corrected to the universal order: Q = ultimate, E = first ability, R = second

# 🚀 Download 2DFight Arena 2.0.0-preview!

Grab the **installer** or the **portable build** from the Assets section below.

---

# 🎉 2D大击败 2.0.0-preview 正式发布！

这次是大的。**2.0.0-preview** 把一直没单独发过的 1.9.0 —— 装备系统、两个新英雄、重做的主页 —— 和一次战斗渲染重构合到了一起。每帧重绘的东西更少，能收集的东西更多。

* * *

## ⚡ 1. 渲染重构 · 更少的绘制，更顺的战斗

* ✅ 地图静态几何（网格、道路、建筑）现在只光栅化**一次**，不再逐帧重绘
* ✅ 修复粒子、平板投射物与残影的绘制位置和时机，特效现在跟战斗帧对得上
* ✅ 页面隐藏时暂停渲染循环，回到页面平滑续播
* ✅ 简化过场模糊，降低弱显卡上的绘制开销

## 🎒 2. 装备系统 · 5 个位置，5 种品质

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

## 🛹 3. 新英雄 · 滑板小子（1000 金币）

街头滑手，近战，普攻距离 100。

* **被动 · 越滑越快** —— 每次普攻永久 **+0.5% 移速**；普攻额外造成 *（当前移速 / 基础移速 − 1）× 基础伤害* 的伤害
* **Q · 炫酷滑板** —— 把滑板当回旋镖扔出去，穿透建筑，来回两段都造成伤害和 1 秒眩晕；滑板飞行期间自身移速 −30%。*2 阶：* 距离 350 → 500。*3 阶：* 自身不减速，并额外向最近 2 个敌人各扔一块滑板
* **E · 坚硬滑板** —— 砸向地面，对 200 范围内的敌人造成伤害并减速 20%，持续 3 秒。*2 阶：* 减速 20% → 30%。*3 阶：* 范围 200 → 270
* **R · 滑板能飞** —— 5 秒内 **+30% 移速**，其他技能锁定。空格不再是普攻：进入无敌、再 **+20% 移速**、跳起，1 秒后砸向地面造成伤害和强力击退。*2 阶：* 5 秒 → 7 秒。*3 阶：* 砸地额外眩晕 1 秒

## 🏀 4. 新英雄 · 篮球少年（1500 金币）

球场射手，远程，普攻距离 200。

* **被动 · 弹夹射手** —— 普攻改为投篮。弹夹初始 **10** 发，**每击杀 5 个敌人 +1 发上限**，以 5 发/秒射出。弹夹为空时无法普攻
* **Q · 快速过人** —— 0.5 秒内穿透 **最近 5 个敌人**（期间无敌），1 秒后造成大额伤害。*2 阶：* 命中同时眩晕 1 秒。*3 阶：* 5 → 10 个目标
* **E · 三步上篮** —— 1 秒内向前冲刺最多 350（期间无敌，会被建筑挡住），终点对敌人造成伤害并眩晕 1 秒。*2 阶：* 眩晕 +1 秒。*3 阶：* 连续两次冲刺与攻击
* **R · 投篮高手** —— 3 秒内弹夹视为 **无限**。*2 阶：* 射速 5/秒 → 10/秒。*3 阶：* 时长 +2 秒，且普攻无视距离（仍会被建筑挡住）

## 🏠 5. 主页与模式选择重做

* ✅ **左侧方形模式入口，右侧长方形「开始游戏」紧贴右墙**
* ✅ 新增**底部栏**：商店 · 装备 · 图鉴 · 背包
* ✅ 模式选择独立成页（`/mode`），和选人页一样的侧栏 + 详情布局，右下角梯形**「选定」**按钮，选完存下选择并返回主页
* ✅ 「开始游戏」会按你选的模式跳转：肉鸽 → 选人，联机 → 大厅，人机 → 人机选人

## 🐛 6. 修复与打磨

* 🐛 **滑板小子「滑板能飞」砸地后不再卡死** —— 飞行状态被清空后，下一行又去读了它
* 🐛 修复模式页只有默认项能点的问题 —— tsconfig 的继承把整份战斗脚本编译进了 `mode.js`
* 🎮 战斗页右上角统一为一个**暂停**按钮（ESC 同效），暂停面板显示完整属性总览，配同风格的**继续** / **退出本局**
* 🎨 樱花少女的技能键位修正为统一顺序：Q = 大招，E = 一技能，R = 二技能

# 🚀 快来下载《2D大击败》2.0.0-preview！

**安装包**和**便携版**都在下方 Assets 里。

---

# 🎌 2D大撃破 2.0.0-preview リリース！

大きなアップデートです。**2.0.0-preview** は、単独では公開されていなかった 1.9.0 —— 装備システム、2 人の新ヒーロー、刷新されたホーム画面 —— と、戦闘描画のリファクタリングを統合したものです。毎フレーム描き直す量が減り、集められるものが増えました。

* * *

## ⚡ 1. 描画リファクタリング · 描画回数を削減し、戦闘を滑らかに

* ✅ マップの静的ジオメトリ（グリッド、道路、建物）を**一度だけ**ラスタライズし、毎フレームの再描画を廃止
* ✅ パーティクル、タブレット投射物、残像の描画位置とタイミングを修正し、戦闘フレームと正しく同期
* ✅ ページが非表示の間は描画ループを停止し、復帰時に滑らかに再開
* ✅ 画面遷移のぼかしを簡略化し、低スペック GPU での描画負荷を軽減

## 🎒 2. 装備システム · 5 スロット、5 レアリティ

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

## 🛹 3. 新ヒーロー · スケーターボーイ（1000 コイン）

ストリートスケートの近接ファイター、通常攻撃距離 100。

* **パッシブ · モーメンタム** —— 通常攻撃 1 回ごとに移動速度が永続 **+0.5%**。さらに通常攻撃に *（現在速度 / 基礎速度 − 1）× 基礎ダメージ* の追加ダメージ
* **Q · ラッドスケートボード** —— ボードをブーメランのように投げ、建物を貫通。往路・復路の両方でダメージと 1 秒スタン。投擲中は自身の移動速度 −30%。*2 段階目：* 飛距離 350 → 500。*3 段階目：* 自身の減速なし＋最寄りの敵 2 体に追加ボード
* **E · ハードスケートボード** —— 地面に叩きつけ、半径 200 の敵にダメージと 20% 減速（3 秒）。*2 段階目：* 減速 20% → 30%。*3 段階目：* 半径 200 → 270
* **R · スケートフライト** —— 5 秒間 **+30% 移動速度**、他のスキルは使用不可。SPACE は通常攻撃ではなくなり、無敵＋さらに **+20% 移動速度**でジャンプし、1 秒後に着地してダメージと強力なノックバック。*2 段階目：* 5 秒 → 7 秒。*3 段階目：* 着地時に 1 秒スタン追加

## 🏀 4. 新ヒーロー · バスケットボーイ（1500 コイン）

コートシューター、遠距離、通常攻撃距離 200。

* **パッシブ · マガジンシューター** —— 通常攻撃がシュートに。マガジンは初期 **10** 発、**敵を 5 体倒すごとに上限 +1**、毎秒 5 発で射出。空弾時は攻撃不可
* **Q · ファストクロスオーバー** —— 0.5 秒で**最寄りの敵 5 体**を貫通（無敵）、1 秒後に大ダメージ。*2 段階目：* 命中時に 1 秒スタン。*3 段階目：* 5 → 10 体
* **E · レイアップ** —— 1 秒で最大 350 前方へダッシュ（無敵、建物でブロック）。終点の敵にダメージと 1 秒スタン。*2 段階目：* スタン +1 秒。*3 段階目：* 2 連続ダッシュ＆攻撃
* **R · シャープシューター** —— 3 秒間マガジンが**無限**扱い。*2 段階目：* 射速 5/秒 → 10/秒。*3 段階目：* 持続 +2 秒、通常攻撃が距離を無視（建物は貫通不可）

## 🏠 5. ホーム画面とモード選択を刷新

* ✅ **左に四角いモード入口、右壁際に長方形の「ゲーム開始」**
* ✅ 新**ボトムバー**：ショップ · 装備 · 図鑑 · バックパック
* ✅ モード選択は独立ページ（`/mode`）に。ヒーロー選択と同じサイドバー＋詳細レイアウトで、右下の台形**「決定」**ボタンで選択を保存してホームへ戻る
* ✅ 「ゲーム開始」は選んだモードへ遷移：ローグ → ヒーロー選択、LAN → ロビー、CPU 対戦 → 対戦選択

## 🐛 6. 修正と調整

* 🐛 **スケーターボーイの「スケートフライト」着地後にフリーズしなくなった** —— 飛行状態をクリアした直後の行で参照していた
* 🐛 モード画面で既定の項目しかクリックできなかった問題を修正 —— tsconfig の継承が戦闘スクリプト全体を `mode.js` に混入させていた
* 🎮 戦闘画面の右上を単一の**ポーズ**ボタンに統一（ESC も同じ）。ポーズパネルにステータス概要と同スタイルの**続ける** / **リタイア**を配置
* 🎨 桜少女のスキルキーを統一順に修正：Q = アルティメット、E = スキル 1、R = スキル 2

# 🚀 2D大撃破 2.0.0-preview をダウンロード！

**インストーラー**と**ポータブル版**は下の Assets から。

---

## ⭐ Support Us

If you enjoy the game, a **Star** on this repo keeps the arena running.

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v1.5.0...v2.0.0-preview
