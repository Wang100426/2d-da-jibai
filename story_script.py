"""剧情模式的脚本数据（框架阶段）。

这一版只定义数据结构与一个演示脚本，**不接入正式游戏流程**：

- 一局剧情 = 若干节点组成的有向图，`start` 指向入口节点，每个节点用 `next` 指向下一个。
- 节点类型：
  - `dialogue` 对话框：说话人 + 正文，点击/空格继续
  - `choice`   分支选择：若干按钮，各自跳到自己指定的节点
  - `battle`   战斗剧情：可自定义每一波的敌人、战场事件和敌方技能
  - `end`      结束节点：显示结算，可返回主页

战斗节点只是把配置渲染出来（波次 / 敌人 / 事件 / 敌方技能），
点「开始战斗」目前只会提示尚未接入 —— 真正接入时在这里换成跳转战役即可。

新增剧情：复制 DEMO_SCRIPT 的结构改内容，然后在 app.py 的 `/story` 里换脚本。
"""

# 说话人的配色沿用英雄 palette 的字段名，前端直接吃 --hero-main / --hero-light / --hero-dark。
DEMO_SCRIPT = {
    "id": "demo",
    "title": "剧情模式 · 框架演示",
    "title_i18n": {
        "en": "Story Mode · Framework Demo",
        "ja": "ストーリーモード · フレームワークデモ",
    },
    "subtitle": "数据驱动 · 尚未接入正式流程",
    "subtitle_i18n": {
        "en": "Data-driven · not wired into the game yet",
        "ja": "データ駆動 · 本編には未接続",
    },
    # 背景使用 static/ 下的文件名
    "background": "home-background.png",
    "start": "intro-1",
    "nodes": [
        {
            "id": "intro-1",
            "type": "dialogue",
            "speaker": "旁白",
            "role": "NARRATOR",
            "initial": "旁",
            "accent": "narrator",
            "text": "霓虹城的供电在天亮前断了三成。街口的广告牌还在闪，拼出一句没人看得懂的口号。",
            "next": "intro-2",
        },
        {
            "id": "intro-2",
            "type": "dialogue",
            "speaker": "霓虹拳王",
            "role": "VOLT",
            "initial": "拳",
            "accent": "volt",
            "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
            "text": "又有人在这条街上乱来了。你也是冲着那台机器来的？还是说……只是路过？",
            "next": "pick-1",
        },
        {
            "id": "pick-1",
            "type": "choice",
            "prompt": "你要怎么回应他？",
            "options": [
                {"label": "「我来找麻烦的。」", "hint": "直接迎战", "next": "pre-battle-a"},
                {"label": "「先看看情况。」", "hint": "先收集情报", "next": "pre-battle-b"},
                {"label": "「我只是路过。」", "hint": "避战，但会被拦下", "next": "pre-battle-b"},
            ],
        },
        {
            "id": "pre-battle-a",
            "type": "dialogue",
            "speaker": "霓虹拳王",
            "role": "VOLT",
            "initial": "拳",
            "accent": "volt",
            "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
            "text": "够直接。那就别怪我不客气 —— 这条街的规矩，是用拳头写的。",
            "next": "battle-1",
        },
        {
            "id": "pre-battle-b",
            "type": "dialogue",
            "speaker": "霓虹拳王",
            "role": "VOLT",
            "initial": "拳",
            "accent": "volt",
            "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
            "text": "路过？这条路今晚不通。要么打赢我，要么躺着出去。",
            "next": "battle-1",
        },
        {
            "id": "battle-1",
            "type": "battle",
            "title": "第一战 · 街口封锁",
            "brief": "对方先派出两名街兵试探，随后由拳王亲自压上。留意第二波的范围眩晕。",
            "next": "post-1",
            "waves": [
                {
                    "index": 1,
                    "label": "波次 1",
                    "note": "试探 · 街兵",
                    "event": "无特殊事件",
                    "enemies": [
                        {"hero": "volt", "count": 2, "mod": "生命 ×1.0"},
                    ],
                    "skills": [
                        {
                            "name": "街头冲撞",
                            "description": "向前突进并击退目标",
                            "cooldown": 8,
                            "damage": 18,
                        },
                    ],
                },
                {
                    "index": 2,
                    "label": "波次 2",
                    "note": "压制 · 拳王下场",
                    "event": "街口车流加速，横穿时会造成眩晕",
                    "enemies": [
                        {"hero": "volt", "count": 1, "mod": "生命 ×1.6 · 伤害 ×1.2"},
                        {"hero": "tech", "count": 1, "mod": "远程支援"},
                    ],
                    "skills": [
                        {
                            "name": "震地连击",
                            "description": "连续三次砸地，最后一击眩晕 1 秒",
                            "cooldown": 12,
                            "damage": 32,
                            "effect": "眩晕 1s",
                        },
                        {
                            "name": "超频护盾",
                            "description": "获得护盾并提升 20% 移速",
                            "cooldown": 16,
                            "damage": 0,
                            "effect": "护盾",
                        },
                    ],
                },
                {
                    "index": 3,
                    "label": "波次 3",
                    "note": "收尾 · 增援",
                    "event": "无人机巡逻，暴露位置会引来炮击",
                    "enemies": [
                        {"hero": "volt", "count": 1, "mod": "生命 ×2.0 · 伤害 ×1.4"},
                        {"hero": "volt2", "count": 1, "mod": "声浪压制"},
                    ],
                    "skills": [
                        {
                            "name": "终场重锤",
                            "description": "跃起后砸向目标点，造成大范围伤害",
                            "cooldown": 20,
                            "damage": 48,
                            "effect": "击退",
                        },
                    ],
                },
            ],
        },
        {
            "id": "post-1",
            "type": "dialogue",
            "speaker": "霓虹拳王",
            "role": "VOLT",
            "initial": "拳",
            "accent": "volt",
            "palette": {"main": "#ff4fa3", "light": "#ffd3e8", "dark": "#812354"},
            "text": "……行啊，你比我想的能打。那台机器归你了 —— 不过下次见面，我不会留手。",
            "next": "end-1",
        },
        {
            "id": "end-1",
            "type": "end",
            "title": "演示结束",
            "text": "这是剧情模式的框架演示：对话框、分支选择、跳过、以及可自定义的战斗剧情都已就位，正式剧情内容尚未编写。",
        },
    ],
}
