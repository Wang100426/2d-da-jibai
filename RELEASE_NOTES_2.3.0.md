# 2D大击败 2.3.0 — Story Mode

## English

Version numbers skipped ahead on purpose: everything planned for 2.2.0 landed together with the story system, so this release ships the whole thing at once.

Four replay cards, thirteen memory cores, and a battle system that actually follows the script instead of rolling random waves.

* * *

### 🎴 1. Story Mode: Replay Cards → Sections → Memory Cores

Pick **Story** on the mode screen, then **Start Game** on the home screen to reach the archive.

* ✅ A **replay card** is one script. Each card splits into **sections**, and every section is a self-contained **memory core** with its own node graph and its own save slot
* ✅ Sections unlock **in order** — clear the previous one to open the next
* ✅ Two story lines: **Cyber World** (pick any fighter before each battle) and **Hero Stories** (locked to that hero, enforced server-side)
* ✅ Six node types: dialogue with a character-by-character typewriter, branching choices (number keys 1-9 work), battles, objectives, rewards, and chapter ends
* ✅ **Skip** jumps straight to the next battle node on the current route
* ✅ Locked sections stay disabled in the archive and reject direct URLs

### 📖 2. RC-001 · City Beneath

Four sections. A city that never turns its lights off, a management system called Skyvault that insists the power grid is fine, and a replay card that officially does not exist.

| Section | What happens |
| --- | --- |
| A Card That Doesn't Exist | The academy arena goes dark. Skyvault insists everything is normal. You find RC-001. The terminal AI advises you to stop holding a non-existent object |
| Platform Zero | A station erased from the city map. Unmanned security intercepts you. The archive says thousands of citizens lived here seventeen years ago — and the population database says they never existed |
| The Unregistered | The "sealed underground facility" was a real neighbourhood. One system upgrade marked every resident as bad data, then sealed the district |
| Memory Core | The deleted records were never destroyed — they were compressed into unreadable fragments. The final defence system wakes up. And the last line of the file reads: *Reader identity: match failed. Matched subject: the current reader* |

### 🥊 3. Three Hero Stories, Three Sections Each

| Card | Hero | Sections | Final boss |
| --- | --- | --- | --- |
| RC-H01 The Champion's Debt | Neon Champion | The Debt / Beneath the Cage / One Last Match | Shadow · Neon Champion |
| RC-H02 Roots of the Moss | Moss Guardian | Roots / Soil Memory / Regrow | Gardener · Moss |
| RC-H03 Night of the Eclipse | Eclipse Mage | Eclipse / The Borrowed Night / Moonfall | Eclipse · Eclipse Mage |

Each section carries a choice, a branching conversation, one scripted battle, a reward, and a proper ending — not a single line before the fight.

### ⚔️ 4. Scripted Battles

Story fights are no longer random waves with a wave counter.

* ✅ Every wave declares **which heroes** spawn, how many, and their **HP / damage / speed multipliers** plus **armour**
* ✅ Enemies render with their hero's palette and glyph, with a name plate above the health bar
* ✅ **Enemy skills** fire on cooldown when you enter their radius: damage, range, and stun / root / slow / knockback / execute
* ✅ A yellow ring marks an enemy whose skill is ready, so you can read the threat
* ✅ **Arena hazards** tick damage on a fixed interval — overloaded switchgear, leaking coolant
* ✅ No roguelike upgrade screens between waves, no rogue coin settlement, no random map events layered on top
* ✅ Clearing every wave ends the battle; dying offers retry or exit back to the archive
* ✅ The battle page no longer sits in browser history, so pressing Back cannot replay the same fight

### 🗺️ 5. Locked Maps and the 1V1 Arena

* ✅ `map_theme` locks a story battle to one of eight maps: arena, city, hospital, music hall, gymnasium, airport, station, school
* ✅ Omit it and the fight defaults to the **1V1 arena** — 1400×900, no buildings, no roads, two pickups pinned to the edges
* ✅ Rogue runs and AI duels are untouched
* ✅ Invalid map ids fall back to the arena and get rejected at build time

### 💾 6. Saves and Rewards

* ✅ Story progress lives in its own sub-structure: current node, objectives, flags, choice records, claimed rewards
* ✅ A save whose version does not match drops **only** the story block — coins, heroes, and equipment survive
* ✅ Rewards dedupe by `reward_id`: retrying a fight, replaying a section, or restoring a save never grants twice
* ✅ A completed section can never be rolled back to incomplete

### 🧩 7. Story Text Is Modular

* ✅ One language file per replay card: `locale/story/<card>.<lang>.json`
* ✅ The main packs keep only categories, so a new card no longer means editing three big locale files
* ✅ Chinese, English, and Japanese are complete for all four cards

### 🚀 Download 2DFight Arena 2.3.0!

Grab the **installer** or the **portable build** from the Assets section below.

---

## 中文

版本号故意跳了一档：原本排在 2.2.0 的内容和剧情系统一起做完了，所以这次一次性全给。

四张重现卡、十三个记忆核心，还有一套真的按剧本刷怪、而不是随机波次的战斗。

* * *

### 🎴 1. 剧情模式：重现卡 → 分区 → 记忆核心

模式选择页选「剧情模式」，主页点「开始游戏」进卡库。

* ✅ 一张**重现卡**就是一个剧本。卡拆成若干**分区**，每个分区是一份独立的**记忆核心**，有自己的节点图和自己的存档
* ✅ 分区**按顺序解锁** —— 打完上一段才能开下一段
* ✅ 两条线：**赛博世界剧情**（每场战斗前自选英雄）和**英雄剧情**（锁定对应英雄，服务端强制）
* ✅ 六种节点：逐字打字机对话、分支选择（数字键 1-9 也能选）、战斗、任务目标、奖励、章节结束
* ✅ **跳过**沿当前路线直接跳到下一个战斗节点
* ✅ 锁定分区在卡库里是禁用态，手输 URL 也进不去

### 📖 2. RC-001 · 城市之下

四个分区。一座永不熄灯的城市，一个每天宣称能源供应正常的城市管理系统「天穹」，和一张官方不存在的重现卡。

| 分区 | 内容 |
| --- | --- |
| 一张不存在的卡 | 校园竞技场停电，天穹坚持一切正常。你找到了 RC-001，终端 AI 建议你停止持有不存在的物品 |
| 零层站台 | 被城市地图抹掉的车站。无人安保拦截你。旧档案写着十七年前这里有数千名市民 —— 而人口数据库说他们从未存在过 |
| 没有登记的人 | 「封闭的地下设施」曾是一片真实居住区。一次系统升级把全体居民标记为错误数据，然后封锁了整片区域 |
| 记忆核心 | 被删除的记录从未销毁，只是被压缩成无法访问的碎片。最终防御系统启动。档案最后一行写着：*读取者身份：匹配失败。匹配对象：当前读取者* |

### 🥊 3. 三张英雄剧情，各三段

| 卡 | 英雄 | 分段 | 尾王 |
| --- | --- | --- | --- |
| RC-H01 拳王的旧账 | 霓虹拳王 | 旧账 / 铁笼之下 / 最后一场 | 影子 · 霓虹拳王 |
| RC-H02 苔藓的根 | 苔藓守卫 | 根 / 土壤记忆 / 重新生长 | 园丁 · 苔藓 |
| RC-H03 月蚀之夜 | 月蚀术士 | 月蚀 / 被借走的夜 / 月落 | 月蚀 · 月蚀术士 |

每一段都有选择、分支对话、一场脚本战斗、一份奖励和一个正经的收尾，不是打之前听一句话就开干。

### ⚔️ 4. 脚本化战斗

剧情战斗不再是随机波次 + 波次计数。

* ✅ 每一波都声明**刷哪些英雄**、几只，以及**血量 / 伤害 / 移速倍率**和**护甲**
* ✅ 敌人用所属英雄的配色和头像字渲染，血条上方挂名字
* ✅ **敌方技能**按冷却释放，你进范围才会真的打：伤害、射程，附带眩晕 / 禁锢 / 减速 / 击退 / 斩杀
* ✅ 技能就绪的敌人外圈亮黄，能提前预判
* ✅ **场地危险效果**按固定间隔扣血 —— 配电柜过载、冷却液泄漏
* ✅ 波次之间不弹肉鸽强化、不结算肉鸽金币、不叠加地图随机事件
* ✅ 清完目标波次即判定胜利；阵亡可以重试，也可以退回卡库
* ✅ 战斗页不再留在浏览器历史里，按返回不会重打同一场

### 🗺️ 5. 地图锁定与 1V1 竞技场

* ✅ `map_theme` 把剧情战斗锁在八张地图之一：竞技场 / 城市 / 医院 / 音乐厅 / 体育馆 / 机场 / 火车站 / 学校
* ✅ 不写就默认 **1V1 竞技场** —— 1400×900、无建筑无道路、两个补给贴边
* ✅ 普通肉鸽和人机对抗完全不受影响
* ✅ 写错的地图 id 会回落竞技场，并在构建期就被拦下

### 💾 6. 存档与奖励

* ✅ 剧情进度是独立子结构：当前节点、任务状态、剧情变量、选择记录、已领奖励
* ✅ 存档版本不符**只丢剧情块** —— 金币、英雄、装备全都不动
* ✅ 奖励按 `reward_id` 去重：重试战斗、重看分区、恢复存档都不会重复发放
* ✅ 已通关的分区不会被回退成未完成

### 🧩 7. 剧情文案模块化

* ✅ 一张重现卡一个语言文件：`locale/story/<卡>.<语言>.json`
* ✅ 主语言包只留分类，以后加卡不用再改三个大文件
* ✅ 四张卡的中文 / English / 日本語 全部写完

### 🚀 快来下载《2D大击败》2.3.0！

**安装包**和**便携版**都在下方 Assets 里。

---

## 日本語

バージョン番号はわざと飛ばしています。2.2.0 で出す予定だった内容をストーリーシステムと一緒に仕上げたため、今回まとめてお届けします。

再生カード 4 枚、記憶核心 13 個、そしてランダムウェーブではなく台本どおりに敵が出現する戦闘システム。

* * *

### 🎴 1. ストーリーモード：再生カード → セクション → 記憶核心

モード選択画面で「ストーリー」を選び、ホームの「ゲーム開始」でアーカイブへ。

* ✅ **再生カード**は 1 本の脚本。カードは複数の**セクション**に分かれ、各セクションは独立した**記憶核心**として固有のノードグラフとセーブを持ちます
* ✅ セクションは**順番に解放** —— 前の段をクリアすると次が開きます
* ✅ 2 系統：**サイバーワールド**（戦闘前にヒーローを自由選択）と**ヒーローストーリー**（該当ヒーロー固定、サーバー側で強制）
* ✅ 6 種類のノード：1 文字ずつのタイプ表示の会話、分岐選択（数字キー 1-9 も可）、戦闘、目標、報酬、チャプター終了
* ✅ **スキップ**で現在のルート上の次の戦闘ノードまでジャンプ
* ✅ ロック中のセクションはアーカイブで無効表示になり、URL 直打ちでも入れません

### 📖 2. RC-001 · 都市の下

4 セクション。決して明かりを消さない街、毎日「エネルギー供給は正常」と言い張る管理システム「スカイヴォールト」、そして公式には存在しない再生カード。

| セクション | 内容 |
| --- | --- |
| 存在しないカード | 学園アリーナが停電し、スカイヴォールトは異常なしと主張。RC-001 を拾うと、端末 AI は「存在しない物品の所持を中止してください」と助言する |
| 零層ホーム | 都市地図から消された駅。無人警備が立ちはだかる。旧記録には 17 年前ここに数千人の市民が住んでいたとあり、人口データベースには彼らが存在した記録がない |
| 未登録の人々 | 「封鎖された地下施設」は実在した居住区だった。あるシステム更新が全住民をエラーデータとして記録し、区域ごと封鎖した |
| 記憶核心 | 削除された記録は破棄されておらず、アクセス不能な断片として圧縮されていた。最終防衛システムが起動する。ファイルの最終行には――*読み取り者照合：不一致。照合対象：現在の読み取り者* |

### 🥊 3. ヒーローストーリー 3 枚、各 3 セクション

| カード | ヒーロー | セクション | ラスボス |
| --- | --- | --- | --- |
| RC-H01 チャンピオンの借り | ネオン・チャンピオン | 借り / 鉄檻の下 / 最後の一戦 | 影 · ネオン・チャンピオン |
| RC-H02 苔の根 | モス・ガーディアン | 根 / 土の記憶 / 再生 | 庭師 · モス |
| RC-H03 月蝕の夜 | エクリプス・メイジ | 月蝕 / 借りられた夜 / 月落 | 月蝕 · エクリプス・メイジ |

各セクションに選択、分岐会話、台本付きの戦闘、報酬、そしてきちんとした結末があります。戦う前に一言だけ聞いて終わり、ではありません。

### ⚔️ 4. 台本どおりの戦闘

ストーリー戦はもうランダムウェーブとウェーブカウンターではありません。

* ✅ ウェーブごとに**出現するヒーロー**、数、**HP／攻撃／移動速度の倍率**、**アーマー**を指定
* ✅ 敵はそのヒーローの配色とイニシャルで描画され、HP バーの上に名前が出ます
* ✅ **敵スキル**はクールダウンで発動し、範囲に入ると実際に攻撃：ダメージ、射程、スタン／拘束／減速／ノックバック／処刑
* ✅ スキル準備完了の敵は外周が黄色く光り、危険を先読みできます
* ✅ **環境ギミック**が一定間隔でダメージ —— 配電盤の過負荷、冷却液の漏洩
* ✅ ウェーブ間にローグライク強化は出ず、ローグのコインも精算されず、ランダムマップイベントも重なりません
* ✅ 目標ウェーブを全滅させると勝利。死亡時はリトライかアーカイブへ退出を選択
* ✅ 戦闘ページはブラウザ履歴に残らないため、戻るボタンで同じ戦闘を再プレイできません

### 🗺️ 5. マップ固定と 1V1 アリーナ

* ✅ `map_theme` でストーリー戦を 8 つのマップのいずれかに固定：アリーナ／街／病院／音楽ホール／体育館／空港／駅／学校
* ✅ 未指定なら **1V1 アリーナ** —— 1400×900、建物も道路もなし、端に補給 2 つ
* ✅ 通常のローグライクと AI 対戦は影響を受けません
* ✅ 不正なマップ ID はアリーナにフォールバックし、ビルド時に拒否されます

### 💾 6. セーブと報酬

* ✅ ストーリー進行は独立したサブ構造：現在ノード、目標、フラグ、選択履歴、受領済み報酬
* ✅ セーブのバージョンが違う場合は**ストーリーブロックのみ**破棄 —— コイン、ヒーロー、装備はそのまま
* ✅ 報酬は `reward_id` で重複排除：戦闘のリトライ、セクションの再読、セーブ復元でも二重受領になりません
* ✅ クリア済みセクションが未完了に戻ることはありません

### 🧩 7. ストーリーテキストのモジュール化

* ✅ 再生カード 1 枚につき言語ファイル 1 つ：`locale/story/<カード>.<言語>.json`
* ✅ メインの言語パックには分類のみを残し、カード追加時に巨大なファイル 3 つを編集する必要がなくなりました
* ✅ 4 枚すべて中国語 / English / 日本語 完備

### 🚀 2D大撃破 2.3.0 をダウンロード！

**インストーラー**と**ポータブル版**は下の Assets から。

---

### ⭐ Support Us

If you enjoy the game, a **Star** on this repo keeps the arena running.

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v2.1.0...v2.3.0
