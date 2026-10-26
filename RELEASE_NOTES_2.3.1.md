# ⚔️ 2DFight Arena 2.3.1 — SWORD RAIN & A CLEANER LAN LOBBY

Two fixes for the things that felt off: Jianghu's kit was too weak, and the LAN lobby made you do too much before you could actually play together.

* * *

## 🌧️ 1. Jianghu's E Is Now Sword Rain

Swordsman's Edge is gone. In its place: a blade wave you actually aim.

* ✅ **Sword Rain** pushes a **200-wide** wave of swords along your facing direction
* ✅ Travels **420 units**, cutting every enemy in its path for **30 damage**
* ✅ One hit per enemy per wave — the wave sweeps the whole path, no double-dipping
* ✅ Passes through buildings; it never blocks your own movement
* ✅ **Tier 2**: width 200 → **300**
* ✅ **Tier 3**: the blades **linger for 3 seconds** after landing, continuing to damage and slow anything that walks in
* ✅ New animation: a row of swords falls from above along the wave, sticks in the ground for a beat, then fades out

## 🎮 2. LAN Lobby: Two Buttons, Then Play

The old flow asked you to pick a hero, then create a room, then wait for a list to refresh. Now:

* ✅ Just a **nickname** plus **Create** and **Join**
* ✅ **Join** reveals a room-code field — no public room list to scroll
* ✅ **Pick your hero inside the room**, where you can actually see who else is coming
* ✅ Locked heroes stay greyed out; switching a hero resets your ready state

## ⏱️ 3. The 30-Second Prep Phase

* ✅ Pressing **Start** as host kicks the room into a **30-second prep countdown**, shown to everyone
* ✅ Pick a hero, then hit **Ready**
* ✅ **The battle starts the instant everyone is ready** — no need to wait out the clock
* ✅ If the 30 seconds run out, it starts anyway, using whatever each player has selected. One idle player can't hold the room hostage
* ✅ If the room drops to a single player during prep, it falls back to the lobby instead of counting down at nothing

## 🤝 4. No More Friendly Fire

Co-op means co-op.

* 🐛 **Root cause**: every remote player was registered as a PvP target, so basic attacks and targeted skills would lock onto **teammates** — and the server happily settled the damage
* ✅ The client no longer collects teammates as attack targets
* ✅ The server now discards **every** player-to-player damage packet
* ✅ Teammate rendering, position sync and HP display are untouched

# 🚀 Download 2DFight Arena 2.3.1!

Grab the **installer** or the **portable build** from the Assets section below.

---

# ⚔️ 2D大击败 2.3.1 正式发布 —— 剑雨，和更清爽的联机大厅

这版修两个手感问题：江湖客太弱，联机大厅开打前的步骤太多。

* * *

## 🌧️ 1. 江湖客 E 技能重做为剑雨

「剑客之刃」删了，换成一道真正要瞄准的剑气波。

* ✅ **剑雨**沿你面朝的方向推出一道 **宽 200** 的剑浪
* ✅ 推进 **420** 距离，路径上的每个敌人吃 **30 点伤害**
* ✅ 同一道剑雨对同一目标只结算一次，整条路径都扫得到，不会重复扣血
* ✅ 穿透建筑，也不会挡住你自己的移动
* ✅ **2 阶**：宽度 200 → **300**
* ✅ **3 阶**：剑气落地后**保留 3 秒**，走进去的敌人持续掉血并被减速
* ✅ 新动画：一排剑沿着剑气波从天而降，插进地面停一瞬，再淡出

## 🎮 2. 联机大厅：两个按钮，然后开打

以前要先选英雄、再建房、再等列表刷新。现在：

* ✅ 只要**昵称** + **「创建」「加入」**
* ✅ 点**加入**才展开房间码输入，不再有公开房间列表要翻
* ✅ **在房间里选英雄**，能看清都有谁在
* ✅ 未解锁的英雄仍然置灰；换英雄会重置你的准备状态

## ⏱️ 3. 30 秒准备阶段

* ✅ 房主点**开始**后，全房间进入 **30 秒准备读秒**
* ✅ 选好英雄，点**准备**
* ✅ **全员就绪立刻开打**，不用等读秒走完
* ✅ 30 秒到点也会自动开始，用各自当前选的英雄 —— 一个挂机的人拖不住整间房
* ✅ 准备阶段掉到只剩一人会退回大厅，不对着空气读秒

## 🤝 4. 队友之间不再互相伤害

协作就是协作。

* 🐛 **根因**：所有远程玩家都被登记成 PvP 目标，普攻和指向技能会把**队友**当成敌人锁定，服务端还老老实实结算伤害
* ✅ 前端不再把队友收进攻击目标
* ✅ 服务端丢弃**所有**玩家之间的伤害包
* ✅ 队友渲染、位置同步、血量显示全部保留

# 🚀 快来下载《2D大击败》2.3.1！

**安装包**和**便携版**都在下方 Assets 里。

---

# ⚔️ 2D大撃破 2.3.1 リリース —— 剣雨と、すっきりした LAN ロビー

今回は手触りの気になった 2 点を修正。江湖客が弱すぎたこと、そして LAN ロビーの手順が多すぎたことです。

* * *

## 🌧️ 1. 江湖客の E スキルを「剣雨」に刷新

「剣客の刃」は廃止し、狙って放つ剣気の波に置き換えました。

* ✅ **剣雨**は向いている方向へ **幅 200** の剣の波を放ちます
* ✅ **420** 進み、経路上の全ての敵に **30 ダメージ**
* ✅ 同じ敵は 1 回の波で 1 度だけ。経路全体を薙ぎ払い、二重ヒットはしません
* ✅ 建物を貫通し、自分の移動も妨げません
* ✅ **2 段階**：幅 200 → **300**
* ✅ **3 段階**：着地後 **3 秒間残り**、入った敵に継続ダメージと減速
* ✅ 新しい演出：波に沿って剣が次々と降り、地面に刺さってから消えます

## 🎮 2. LAN ロビー：ボタン 2 つで遊べる

以前はヒーロー選択 → ルーム作成 → 一覧の更新待ち、と手順が多すぎました。現在は：

* ✅ **ニックネーム**と **「作成」「参加」** だけ
* ✅ 「参加」を押すとルームコード入力が展開。公開ルーム一覧は廃止
* ✅ **ルーム内でヒーローを選択**。誰が来ているか見ながら決められます
* ✅ 未解放のヒーローはグレー表示のまま。変更すると準備状態は解除されます

## ⏱️ 3. 30 秒の準備フェーズ

* ✅ ホストが**開始**を押すと、全員に **30 秒のカウントダウン**が表示されます
* ✅ ヒーローを選んで**準備**を押す
* ✅ **全員そろえば即開始**。カウントダウンを待つ必要はありません
* ✅ 30 秒経過でも自動開始。各自が選んでいるヒーローで始まるため、放置プレイヤーに足止めされません
* ✅ 準備中に 1 人になった場合はロビーへ戻ります

## 🤝 4. 味方同士のダメージを廃止

協力プレイは協力プレイのままに。

* 🐛 **原因**：全てのリモートプレイヤーが PvP 対象として登録されていたため、通常攻撃や対象指定スキルが**味方**にロックし、サーバーもそのダメージを精算していました
* ✅ クライアントは味方を攻撃対象として収集しなくなりました
* ✅ サーバーはプレイヤー間のダメージパケットを**全て**破棄します
* ✅ 味方の描画、位置同期、HP 表示はそのまま

# 🚀 2D大撃破 2.3.1 をダウンロード！

**インストーラー**と**ポータブル版**は下の Assets から。

---

## ⭐ Support Us

If you enjoy the game, a **Star** on this repo keeps the arena running.

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v2.3.0...v2.3.1
