# 更新日志 / Updates

## 1.7.5

### 中文

- 战斗暂停面板升级：右上角暂停按钮与 ESC 键统一进入暂停面板，面板内新增战况与属性总览（到达波次、本局/被动累计击杀、伤害倍率、攻速、减伤、吸血、闪避、普攻范围、能量回复、补给拾取），并提供「继续游戏」与「退出本局」两个同风格按钮；退出同样结算本局金币。
- 修正樱花少女的技能按键顺序：现与其他全部英雄一致，Q=大招（樱花之歌）、E=一技能（夏日祭）、R=二技能（樱花风暴）。
- 全面优化点击与过场动画：
  - 全站按钮与可点击小件新增按下反馈（轻微缩放），并统一了默认过渡曲线；
  - 主页、选人、商店、图鉴与联机页新增页面入场过场（淡入 + 上浮）；
  - 选人页英雄卡、商店商品卡、图鉴地图卡改为逐个瀑布式进入；
  - 站内跳转新增离场淡出过场（外链、下载、新标签页与系统「减少动态效果」偏好不受影响）。

### English

- Upgraded the battle pause panel: the top-right pause button and the ESC key both open it, and it now shows a run & stats overview (wave, kills this run and passive kills, damage multiplier, attack speed, damage reduction, lifesteal, dodge, attack range, energy regen, supplies) plus two matching buttons — Resume and Exit Run. Exiting still settles this run's coins.
- Fixed Sakura Girl's skill key order to match every other hero: Q = ultimate (Sakura Song), E = first ability (Summer Festival), R = second ability (Sakura Storm).
- Polished click & transition animations across the board:
  - All buttons and clickable pills now have a pressed-state response (subtle scale) with a unified default easing;
  - The home, select, shop, codex and multiplayer pages gained an entrance transition (fade + rise);
  - Roster cards, shop cards and codex cards now cascade in one by one;
  - Internal navigation fades out before leaving (external links, downloads, new tabs and the system "reduce motion" preference are unaffected).

### 日本語

- バトルのポーズパネルを強化：右上のポーズボタンとESCキーのどちらでもパネルを開き、戦況とステータスの概要（到達ウェーブ、今回とパッシブの累計撃破、ダメージ倍率、攻撃速度、被ダメ軽減、吸血、回避、通常攻撃距離、エネルギー回復、補給回収）を表示。同スタイルの「続ける」と「リタイア」の2ボタンを提供します。リタイア時もコインは精算されます。
- 桜少女のスキルキー配置を修正：他の全ヒーローと同様に、Q=アルティメット（桜の歌）、E=スキル1（夏祭り）、R=スキル2（桜嵐）になりました。
- クリックと画面遷移アニメーションを全般的に改善：
  - 全ボタンとクリック可能な要素に押下フィードバック（軽い縮小）と統一されたイージングを追加；
  - ホーム・選択・ショップ・図鑑・マルチプレイ画面に画面遷移アニメーション（フェード＋スライド）を追加；
  - 選択画面のヒーローカード、ショップカード、図鑑カードが順番に登場するように変更；
  - サイト内リンクの移動時にフェードアウトする遷移を追加（外部リンク・ダウンロード・新規タブ・「動きを減らす」設定は影響なし）。


## 1.7.0

### 中文

- 新增「金币 + 存档」系统：每局单机肉鸽结束时（阵亡，或中途退出返回选人页）都会结算金币，公式为「到达波次 × 10 + 击杀数 × 1」，单局上限 500；人机对抗与联机不结算金币。存档记录金币与已解锁英雄，开发环境位于 `<仓库>/save/profile.json`（已加入 `.gitignore`），打包后位于 `%LOCALAPPDATA%/2d-da-jibai/save.json`。
- 新增「英雄商店」：主页与选人页右上角的金币胶囊都能进入。选人页里未解锁的英雄仍可查看详情，但需要先去商店买下（按钮变为「前往商店」）；当前商店可购买新英雄「江湖客」，售价 1000 金币。
- 新增英雄「江湖客」（金色侠客主题，近战，普攻距离 150）：
  - 被动「一剑封喉」：敌方生命值每降低 1%，自己每次攻击它都会 +0.6% 概率直接斩杀。
  - Q「侠客行」：进入无敌状态，每 0.5 秒向半径 300 内最近的敌人位移并攻击一次，最多 5 次；不会连续攻击同一个敌人（除非范围内只剩它一个）。范围内没有敌人时立即停止，剩余冷却按实际位移次数比例结算（一次都没位移则冷却清零）。2 阶：每次位移攻击额外眩晕 0.5 秒；3 阶：位移间隔缩短至 0.25 秒、次数提升到 10 次。
  - E「剑客之刃」：强化接下来 3 次普攻，伤害 +20%，且每次恢复造成伤害 10% 的生命。2 阶：增伤 20% → 40%；3 阶：吸血 10% → 25%。
  - R「御剑飞行」：接下来 3 秒移速 +50%、闪避 +50%。2 阶：3 秒 → 5 秒；3 阶：移速 +50% → +100%。
- 主页右上角新增「存档管理」：查看金币与已解锁英雄、导出 JSON 备份、导入覆盖存档、两步确认后重置存档。（无限金币的测试存档仍靠手写 `infinite_coins: true` 或 `"coins": "infinity"` 维护，界面刻意不提供无限金币开关。）
- 主页右下角的图鉴按钮改为长方形（不再是直角梯形），并与下方「模式 / 开始」按钮直接贴合，取消两者之间的缝隙。

### English

- New coins + save system: every single-player rogue run now banks coins when it ends — on death, or when you quit back to the select screen. The reward is "waves reached × 10 + kills × 1", capped at 500 per run; duel and LAN matches earn nothing. The save stores your coins and unlocked fighters; in development it lives at `<repo>/save/profile.json` (gitignored), and packaged builds use `%LOCALAPPDATA%/2d-da-jibai/save.json`.
- New Hero Shop, reachable from the coin pill in the top-right of the home screen and the select screen. Locked fighters on the select screen can still be inspected, but must be bought in the shop first (the enter button becomes "GO TO SHOP"). The shop currently sells the new fighter 江湖客 for 1000 coins.
- New hero "Knight-Errant" (gold swordsman theme, melee, 150 basic attack range):
  - Passive "One-Strike Execution": for every 1% of health the target is missing, each of your attacks against it gains +0.6% chance to execute it instantly.
  - Q "Knight-Errant Song": become invulnerable and dash to the nearest enemy within 300 range every 0.5s, striking up to 5 times. It never hits the same enemy twice in a row unless that enemy is the only one in range. It stops immediately when nothing is in range, and the remaining cooldown is proportional to the dashes actually performed (zero dashes clears the cooldown). Tier 2: each dash strike also stuns for 0.5s; Tier 3: dash interval 0.25s and up to 10 dashes.
  - E "Swordsman's Edge": empower your next 3 basic attacks with +20% damage and 10% lifesteal. Tier 2: +20% → +40%; Tier 3: lifesteal 10% → 25%.
  - R "Sword Flight": +50% movement speed and +50% dodge for 3s. Tier 2: 3s → 5s; Tier 3: +50% → +100% speed.
- New save management panel in the top-right of the home screen: review coins and unlocked fighters, export a JSON backup, import one to overwrite the save, and reset the save behind a two-step confirmation. (The unlimited-coin test save is still maintained by hand with `infinite_coins: true` or `"coins": "infinity"` — there is deliberately no in-game infinite-coin toggle.)
- The home-screen codex button is now a plain rectangle instead of a right trapezoid, and sits flush against the mode/start row below with no gap.

### 日本語

- 「コイン＋セーブ」システムを追加：シングルプレイのローグ1回が終わるたび（敗北時、または途中でヒーロー選択へ戻った時）にコインを精算します。計算式は「到達ウェーブ × 10 ＋ 撃破数 × 1」で、1回の上限は500。CPU対戦とLAN対戦ではコインは貯まりません。セーブにはコインと解放済みヒーローを記録し、開発時は `<リポジトリ>/save/profile.json`（.gitignore 済み）、パッケージ版は `%LOCALAPPDATA%/2d-da-jibai/save.json` に保存されます。
- 「ヒーローショップ」を追加：ホーム画面とヒーロー選択画面の右上にあるコイン表示から入れます。未解放ヒーローは選択画面で能力を確認できますが、先に購入が必要です（ボタンが「ショップへ」に変わります）。現在は新ヒーロー「江湖客」を1000コインで販売しています。
- 新ヒーロー「江湖客」（金色の剣客テーマ、近接、通常攻撃距離150）：
  - パッシブ「一撃必殺」：相手のHPが1%減っているごとに、こちらの攻撃1回につき即死確率 +0.6%。
  - Q「侠客行」：無敵になり、0.5秒ごとに半径300内の最も近い敵へ突進して攻撃、最大5回。範囲内に他に敵がいる限り同じ敵を連続で攻撃しません。範囲内に敵がいなければ即座に停止し、残りクールダウンは実際に突進した回数に比例（0回ならクールダウンは0）。2段階目：各突進攻撃に0.5秒のスタン追加；3段階目：間隔0.25秒・最大10回。
  - E「剣客の刃」：次の通常攻撃3回を強化し、ダメージ +20%・与ダメージの10%を回復。2段階目：+20% → +40%；3段階目：吸血 10% → 25%。
  - R「御剣飛行」：3秒間、移動速度 +50%・回避 +50%。2段階目：3秒 → 5秒；3段階目：移動速度 +50% → +100%。
- ホーム画面右上に「セーブ管理」を追加：コインと解放済みヒーローの確認、JSONバックアップの書き出し、読み込みによる上書き、2段階確認つきのセーブリセット。（コイン無制限のテストセーブは `infinite_coins: true` または `"coins": "infinity"` を手書きして維持します。ゲーム内に無限コインのスイッチは意図的に用意していません。）
- ホーム画面右下の図鑑ボタンを右台形から長方形に変更し、下の「モード／スタート」行と隙間なく接するようにしました。

## 1.6.5

### 中文

- 新增「地图图鉴」：主页右下角两颗按钮的上方多了一个同宽同高的入口，点进去可以一次看完全部 7 张赛场——按实机布局绘制的缩略图、地形特点、随机事件，以及建筑 / 路障数量。
- 选英雄页左侧的英雄列表改为自适应多列 + 滚动的卡片列表（细的暗色滚动条），并修掉窗口变窄时卡片相互重叠的问题。

### English

- Added the Map Codex: a new button sits above the two home-screen controls and opens a page listing all seven arenas at once — a to-scale layout preview, terrain notes, the random event, and building/barrier counts.
- The hero roster on the select screen is now an adaptive multi-column scrolling list with a slim dark scrollbar, and no longer overlaps itself in narrow windows.

### 日本語

- 「マップ図鑑」を追加：ホーム画面右下のボタンの上に同じ幅・高さの入口ボタンを置き、全7マップを一覧できる。実レイアウトを縮小したサムネイル、地形の特徴、ランダムイベント、建物／バリケード数をまとめて確認できる。
- ヒーロー選択画面の左側リストを可変多列＋スクロールのカードリスト（細いダークスクロールバー）に変更し、ウィンドウが狭いときにカードが重なる不具合を修正。

## 1.6.0

### 中文

- 新增英雄「樱花少女」（粉色花火主题，远程，普攻距离 250）：
  - 被动「引燃」：技能命中即引燃目标，每秒造成相当于自身最大生命值 5% 的伤害，持续 3 秒；灼烧期间再次被技能命中，灼烧每秒伤害 +10%（最高 4 倍）并刷新持续时间。
  - Q「夏日祭」：在自身普攻范围内展开粉色祭典区域，范围内敌人每 0.5 秒受到一次小额伤害，持续 3 秒。2 阶持续时间 +1 秒；3 阶伤害频率提升至 0.25 秒。
  - E「樱花风暴」：在最近敌人处生成半径 200 的樱花风暴，0.5 秒内把范围内敌人卷向中心，随后造成小额伤害并眩晕 1 秒。2 阶眩晕后额外减速 50% 持续 3 秒；3 阶吸引时间延长至 1 秒。
  - R「樱花之歌」：进入 3 秒的 50% 加速状态，期间免疫伤害，撞到的敌人被击退并受到伤害。2 阶加速时间 +1 秒；3 阶撞到的敌人同时被施加樱花风暴。
- 新增地图「霓虹火车站」：5 条铁轨、6 个站台，候车厅显示列车到达时间，站台提示下一班列车。列车进站停靠 10 秒，进站或离站期间撞到车身会被击退并受到高额伤害；停靠期间列车视作建筑无法穿过，随后驶离。

### English

- New hero "Sakura Girl" (pink firework theme, ranged, 250 basic attack range):
  - Passive "Ignite": skill hits ignite the target for 5% of your max health per second for 3s. Hitting a burning target again raises the burn damage by 10% (up to 4x) and refreshes the duration.
  - Q "Summer Festival": open a pink festival zone at your basic attack range; enemies inside take a small hit every 0.5s for 3s. Tier 2: +1s duration; Tier 3: ticks every 0.25s.
  - E "Sakura Storm": create a radius-200 storm on the nearest enemy, pulling enemies to the center over 0.5s, then dealing a small hit and a 1s stun. Tier 2: an extra 50% slow for 3s after the stun; Tier 3: pull time becomes 1s.
  - R "Sakura Song": enter a 3s haste state (+50% movement speed) and take no damage; enemies you touch are damaged and knocked back. Tier 2: +1s duration; Tier 3: touched enemies also get hit by Sakura Storm.
- New map "Neon Station": five tracks and six platforms. The waiting hall shows train arrival times, and each platform shows the next train. Trains stop for 10 seconds; being struck by a moving train knocks you back for heavy damage, and a stopped train blocks movement like a building before it departs.

### 日本語

- 新ヒーロー「サクラ少女」（ピンクの花火テーマ、遠距離、通常攻撃距離 250）：
  - パッシブ「着火」：スキル命中で対象を着火し、自身の最大HPの5%を毎秒3秒間与える。燃焼中に再度スキルが命中すると毎秒ダメージ +10%（最大4倍）し、持続時間を更新する。
  - Q「夏祭り」：自身の通常攻撃範囲にピンクの祭りエリアを展開し、範囲内の敵に0.5秒ごとに小ダメージを3秒間与える。2段階目：持続 +1秒；3段階目：0.25秒ごとに変化。
  - E「サクラストーム」：最寄りの敵の位置に半径200の嵐を生成し、0.5秒かけて範囲内の敵を中心へ引き寄せ、その後小ダメージと1秒のスタン。2段階目：スタン後に50%スローを3秒追加；3段階目：引き寄せ時間が1秒に。
  - R「サクラソング」：3秒間の加速状態（移動速度 +50%）に入り無敵になる。触れた敵はダメージとノックバックを受ける。2段階目：持続 +1秒；3段階目：触れた敵にサクラストームも発動。
- 新マップ「ネオン駅」：線路5本・ホーム6面。待合ホールに列車の到着時刻、各ホームに次の列車を表示する。列車は10秒間停車し、入出線中の車体に衝突すると大ダメージとノックバックを受ける。停車中は建物として通行を阻み、その後発車する。

## 1.5.0

### 中文

- 新增日语语言包「2D大撃破」及配套日语图标；右上角语言切换改为下拉菜单，折叠时显示当前语言，展开后可切换中文 / English / 日本語。
- 修复英文界面残留的中英混排提示（如「受到damage降低」）：片段替换改为长句优先，并补齐「防御减伤 · 护盾吸收」等提示的翻译。
- 修复苔藓守卫因被动初始化顺序导致的战斗加载报错（该英雄此前无法正常开局）。
- 科技男「超频协议」的层数改为永久叠加。

### English

- Added a Japanese language pack ("2D大撃破") with a matching Japanese icon. The top-right language switch is now a dropdown that shows the current language and lets you pick 中文 / English / 日本語.
- Fixed the last remaining mixed Chinese/English battle messages in the English UI (e.g. "受到damage降低"): fragment matching now prefers the longest key, and lines such as damage reduction / shield absorbed are fully translated.
- Fixed a battle-load script error on the Moss Guardian caused by passive initialization order, which stopped the hero from starting a run.
- Tech Man's "Overclock Protocol" stacks are now permanent.

### 日本語

- 日本語パック「2D大撃破」と専用の日本語アイコンを追加しました。右上の言語切り替えはドロップダウンになり、折りたたみ時は現在の言語を表示し、中文 / English / 日本語 から選べます。
- 英語UIに残っていた中国語混在の戦闘メッセージ（例：「受到damage降低」）を修正しました。断片置換は長い一致を優先するようにし、「ダメージ軽減・シールド吸収」なども翻訳済みです。
- パッシブ初期化の順序が原因で、モスガーディアンの戦闘開始時にスクリプトエラーが発生し開局できなかった問題を修正しました。
- テックファイター「オーバークロックプロトコル」のスタックが永続化されました。

## 1.4.0

### 中文

- 修复战斗技能栏的技能阶级未显示英文翻译的问题。
- 为各英雄普攻命中提示补充英文翻译。
- 战斗文案改用带占位符的模板系统，修复英文界面下大量战斗提示中英混排的问题（如「受到damage降低」）。
- 战斗页与选人页的普攻按钮支持按住连续普攻，触控模式的普攻键同样支持长按。
- 为五位英雄各加入一个被动技能，并在选人页展示：
  - 霓虹拳王「突破极限」：每普攻 1 次攻速 +0.05 次/秒，对该英雄取消攻速上限。
  - 苔藓守卫「苔藓馈赠」：初始吸血 10%，每次击杀 +1% 吸血，对该英雄取消吸血上限。
  - 月蚀术士「月相扩张」：每次击杀普攻范围 +5（无上限）；每击杀 20 次，下一次大招额外向施法范围内非最近的敌人降落一颗陨石。
  - 科技男「超频协议」：每击杀 20 次层数 +1，二技能每层多 1 次往返、一技能每层多发射 1 块击退平板、大招每层伤害 +20%。
  - 新增英雄「电音人」（紫色电音主题，远程）：被动「共鸣」——被技能击中 3 次的敌人陷入 3 秒狂舞，对狂舞中的敌人伤害 +50%。三技能为音浪冲击（撞建筑爆炸，3 阶穿建筑并在命中 2 个敌人后自爆）、低音震荡（强化普攻附带狂舞，3 阶计入被动并可延长至 9 秒）、碟片风暴（10 枚追踪唱片，每次施法对同一敌人只记 1 层）。
  - 琵琶女「弦音不绝」：每通过狂舞击杀 3 次或小兵击杀 10 次后，十面埋伏此后每次施放都多召唤 1 名小兵（可叠加）；大招狂舞时间 +1 秒。

### English

- Fixed untranslated skill-rank labels in the battle skill bar.
- Added English translations for basic-attack hit messages across heroes.
- Combat text now uses a placeholder template system, fixing many battle messages that rendered as mixed Chinese/English in the English UI (e.g. "受到damage降低").
- The basic-attack button on the battle and selection screens can be held to attack continuously; the touch-mode attack button supports hold as well.
- Added a passive skill to each of the five heroes, shown on the selection page:
  - Neon Champion "Limit Break": +0.05 attack speed per basic attack, with no attack-speed cap for this hero.
  - Moss Guardian "Moss Gift": starts with 10% lifesteal, +1% per kill, with no lifesteal cap for this hero.
  - Moon-Eclipse Sorcerer "Lunar Expansion": +5 basic attack range per kill (no cap); every 20 kills the next ultimate drops an extra meteor on a non-nearest enemy in cast range.
  - Tech Man "Overclock Protocol": every 20 kills grants a stack — +1 afterimage round trip, +1 knockback tablet, and +20% ultimate damage per stack.
  - Added a new hero, DJ Volt (purple audio theme, ranged): passive "Resonance" — enemies hit by your skills 3 times enter 3s frenzy, and you deal +50% damage to frenzied enemies. Sound Wave explodes on buildings (tier 3 phases through and self-destructs after 2 hits), Bass Boost empowers a basic attack with frenzy (tier 3 counts as a skill hit and extends frenzy to 9s), and Disc Storm throws 10 homing records where each cast counts only 1 stack per enemy.
  - Pipa Girl "Endless Strings": every 3 frenzy kills or 10 minion summons an extra minion; frenzy lasts +1s.

## 1.3.5

### 中文

- 战斗页右上角新增触控模式开关，位于语言切换旁边。
- 开启后显示四向移动按键、三个技能按钮及普攻按钮；再次点击关闭触控操作。
- 选英雄页左侧英雄列表改为每行两个方形卡片，选中项以高亮边框标记；所有英雄的技能说明补充了施法范围、伤害和效果细节。
- 更新应用版本至 1.3.5。

### English

- Added a touch-mode toggle to the battle screen beside the language switch.
- Enabling it reveals four directional movement buttons, all three skill buttons, and a basic-attack button; toggle it again to hide touch controls.
- Changed the hero roster to two square cards per row with a highlighted selection border, and expanded every hero skill description with range, damage, and effect details.
- Updated the application version to 1.3.5.

## 1.3.0

### 中文

- 新增英雄琵琶女，普攻距离 200。阳春白雪攻击最近的 3 个敌人、禁锢 3 秒，并按实际生命伤害的 20% 回复生命；十面埋伏召唤 5 名生命值 15 的自主小兵；金蛇狂舞攻击周围剩余生命值最高的 3 个敌人并施加狂舞。
- 加入琵琶女技能升阶强化：阳春白雪 2 阶多攻击 1 个目标、3 阶禁锢延长 1 秒；十面埋伏 2 阶小兵生命提高 50%、3 阶小兵数量增加 2；金蛇狂舞 2 阶狂舞延长 1 秒、3 阶狂舞目标攻速提高 20%（肉鸽同样生效）。
- 狂舞在肉鸽中持续 5 秒，使敌人失控攻击其他敌人；仅剩一个敌人时会攻击自身。人机与局域网对战中基础持续 2 秒，目标定身并自动普攻自己。
- 新增赛博学校地图，办公室显示上课倒计时。上课持续 10 秒，全场单位移速降低 60%、攻速降低 50%、造成伤害降低 20%。
- 重做主页模式入口：右下角并列相扣的直角梯形分别用于选择肉鸽、局域网或人机对抗模式，以及开始游戏；保留赛博营地过场与语言切换，并移除顶部导航栏。
- 更新应用版本至 1.3.0。

### English

- Added Pipa Virtuoso with 200 basic-attack range. Spring Snow hits the 3 nearest enemies, roots them for 3 seconds, and restores 20% of actual health damage dealt; Ambush on All Sides summons 5 autonomous minions with 15 HP; Golden Serpent Dance strikes the 3 nearby enemies with the most remaining health and applies Frenzy.
- Added Pipa skill ranks: Spring Snow hits one additional target at Tier 2 and roots for 1 second longer at Tier 3; Ambush minions gain 50% HP at Tier 2 and increases the summon count by 2 at Tier 3; Golden Serpent Dance lasts 1 second longer at Tier 2 and grants frenzied targets 20% attack speed at Tier 3, including in roguelike runs.
- Frenzy lasts 5 seconds in roguelike runs, causing enemies to attack other enemies or themselves if alone. In AI and LAN PvP it lasts 2 seconds by default, immobilizes its target, and forces a self-directed basic attack.
- Added Cyber School. The office displays the class countdown. Classes last 10 seconds and slow all units by 60%, reduce attack speed by 50%, and reduce damage dealt by 20%.
- Reworked the home screen with two interlocking right-angle trapezoids at the lower right: a mode picker for roguelike, LAN, and AI duel, plus a start button. The top navigation is removed; the language toggle and Cyber Camp transition remain.
- Updated the application version to 1.3.0.

## 1.2.3

### 中文

- 移除主页顶部导航栏，并保留独立的语言切换按钮。
- 移除英雄选择页与战斗页的顶部导航栏；选人页保留返回首页和语言切换，战斗页保留返回选人和语言切换。
- 点击主页模式后新增“正在连接至赛博营地……”过渡页，沿用战场概览图、点阵加载动画及淡入效果。
- 更新应用版本至 1.2.3。

### English

- Removed the home page top navigation bar while retaining a standalone language toggle.
- Removed the navigation bars from hero selection and battle, keeping the back/language controls available on each page.
- Added a “Connecting to the Cyber Camp...” transition after selecting a mode, using the arena overview art, dot-grid loader, and fade-in effect.
- Updated the application version to 1.2.3.

## 1.2.2

### 中文

- 优化战场过场动画：采用点阵加载动画，并更新加载动画的呈现方式。
- 应用版本更新至 1.2.2。

### English

- Optimized the battle transition with an updated animated dot-grid loader.
- Updated the application version to 1.2.2.

## 1.2.1

### 中文

- 调整赛博机场航班系统：飞机随波次持续循环放行，在途数量逐波增加，最多同时占用全部 8 条跑道；航班放行间隔随波次缩短。
- 航站楼时刻表显示本波起飞／降落目标、当前在途数量，以及下一架飞机的倒计时。
- 飞机只会分配到当前没有飞机使用的跑道；起飞和降落可以同时进行，但不会在同一跑道上交叉冲突。
- 应用版本更新至 1.2.1。

### English

- Updated Cyber Airport traffic: aircraft are released continuously, with the number in flight increasing by wave until all eight runways can be occupied at once; release intervals shorten as waves progress.
- The terminal schedule displays this wave's departure/arrival targets, current in-flight counts, and the next-flight countdown.
- Aircraft are assigned only to runways not currently in use. Takeoffs and landings may occur simultaneously on separate runways, avoiding opposing traffic on one runway.
- Updated the application version to 1.2.1.

## 1.2.0

### 中文

- 新增随机地图：每局在霓虹城区、赛博医院、赛博琴房、赛博体育馆与赛博机场中随机选择，并随机调整建筑布局。
- 霓虹城区新增车流事件：道路预警后，多辆高速车辆沿道路冲过；撞到玩家或敌人时造成高额伤害和眩晕，随后车辆消失。
- 赛博医院新增麻醉医生事件：医生高速进入战场，拥有生命值，会攻击玩家或敌人，也会吸引普通敌人攻击；击败医生可获得大量技能经验。
- 麻醉医生首次命中目标时会注射麻药，使目标眩晕 2 秒；被麻醉过的单位不会再次成为医生的攻击目标。
- 敌人遇到建筑阻挡时会通过网格寻路绕行，减少卡在建筑另一侧的情况。
- 为玩家、敌人和联机玩家增加醒目的负面状态名称与剩余时间提示。
- 新增赛博琴房：落地竖琴持续演奏 5 秒，对音场内单位造成小额持续伤害并降低 60% 移速。
- 新增赛博体育馆：肌肉壮汉从建筑冲出，高速冲向最近单位并造成巨额伤害后消失。
- 新增赛博机场：航站楼显示起飞／降落倒计时，飞机随机选择八条跑道之一；撞上飞机会受到重击并被强力击退。
- 新增 5 秒全屏战场过渡页，使用 `static/game_loading_1.png` 作为概览图；左上展示地图与特殊事件，左下展示出战角色，右下显示加载动画，并以淡入淡出衔接战斗。
- 补齐新增地图、事件及建筑名称的中英文文案；应用版本保持为 1.2.0。

### English

- Added random maps: each run selects the Neon District, Cyber Hospital, Cyber Music Hall, Cyber Gymnasium, or Cyber Airport, with a randomized obstacle layout.
- Added a traffic event to the Neon District. After a warning, fast-moving cars rush along several roads, dealing heavy damage and causing a stun before disappearing on impact.
- Added an anesthetist event to Cyber Hospital. Fast, health-bearing doctors enter the arena, attack players or enemies, and attract regular enemies. Defeating one grants substantial skill XP.
- An anesthetist's first hit injects anesthetic and stuns its target for 2 seconds. Previously anesthetized units are no longer targeted by doctors.
- Enemies use grid-based pathfinding to navigate around buildings instead of getting stuck behind them.
- Added prominent negative-effect labels and remaining durations above players, enemies, and LAN players.
- Added Cyber Music Hall, where randomly landing harps play for 5 seconds, deal light continuous damage, and slow nearby units by 60%.
- Added Cyber Gymnasium, where muscular bruisers burst from buildings, charge the nearest unit at high speed, deal massive damage, and disappear.
- Added Cyber Airport, with takeoff and landing countdowns at the terminal and eight randomly selected runways. Aircraft collisions deal heavy damage and knock units back.
- Added a 5-second full-screen battle transition using `static/game_loading_1.png`, with map/event details at upper left, the selected fighter at lower left, and an animated lower-right loading indicator.
- Added Chinese and English text for the new maps, events, and buildings. The application version remains 1.2.0.
