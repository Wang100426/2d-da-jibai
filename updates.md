# 更新日志 / Updates

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
