# 🛹 2DFight Arena 2.1.0 is HERE!

Two changes this time: the hero select screen now tells you what each skill becomes when it ranks up, and Skater Boy's ultimate finally deals the damage it was always supposed to.

* * *

## 🎯 1. Tier Preview on the Hero Select Screen

* ✅ Every skill in the detail panel now lists its **Tier 2** and **Tier 3** effects right under the description
* ✅ Switches instantly when you pick a different hero
* ✅ Fully localized — reads in Chinese, English, or Japanese along with the rest of the UI
* ✅ All **10 heroes** are covered, three skills each, two tiers apiece

No more guessing what "Tier 3" actually gives you before committing to a run.

## 🐛 2. Skater Boy's Ultimate Now Actually Hits

* ✅ Fixed **Q · Rad Skateboard** dealing **zero damage**
* 🐛 **Root cause**: the hit test measured the distance from **you** to each enemy instead of from the **board** to each enemy. Since the board flies 350 units away, nothing along its path was ever close enough to you — so nothing got hit
* ✅ Hits now resolve from the board's current position
* ✅ Outbound and return legs are evaluated separately, so standing in the path eats damage **twice** — matching the "both legs deal damage" description

# 🚀 Download 2DFight Arena 2.1.0!

Grab the **installer** or the **portable build** from the Assets section below.

---

# 🎉 2D大击败 2.1.0 正式发布！

这次两件事：选人页能看清每个技能升阶后变成什么样了，以及滑板小子的大招终于真的会打人。

* * *

## 🎯 1. 选人页新增升阶预览

* ✅ 详情面板里每个技能都会在描述下方直接列出 **2 阶** 与 **3 阶** 效果
* ✅ 切换英雄立即刷新
* ✅ 完整本地化 —— 跟随中文 / English / 日本語 界面
* ✅ 覆盖全部 **10 位英雄**，每人 3 个技能、每个 2 档升阶

以后开局前不用再猜「3 阶到底给什么」了。

## 🐛 2. 滑板小子大招现在真的会命中

* ✅ 修复 **Q · 炫酷滑板** 造成 **零伤害** 的问题
* 🐛 **根因**：命中判定算的是「**你**到敌人」的距离，而不是「**滑板**到敌人」的距离。滑板要飞 350 码，路径上的敌人离你远远超过判定半径，于是一个都打不到
* ✅ 改为按滑板当前位置判定
* ✅ 去程与回程分别判定，站在路径上的敌人会**吃两次**伤害 —— 才对得上「来回两段都造成伤害」的描述

# 🚀 快来下载《2D大击败》2.1.0！

**安装包**和**便携版**都在下方 Assets 里。

---

# 🎌 2D大撃破 2.1.0 リリース！

今回は 2 点。ヒーロー選択画面でスキルの段階強化後の内容が見えるようになり、スケーターボーイのアルティメットが本当にダメージを与えるようになりました。

* * *

## 🎯 1. ヒーロー選択画面に段階プレビュー

* ✅ 詳細パネルの各スキルが、説明の下に **2 段階目**と **3 段階目**の効果を表示
* ✅ ヒーローを切り替えると即座に更新
* ✅ 完全ローカライズ —— 中国語 / English / 日本語 の UI に追従
* ✅ 全 **10 ヒーロー**、各 3 スキル × 2 段階をカバー

「3 段階目で何がもらえるのか」を事前に推測する必要はもうありません。

## 🐛 2. スケーターボーイのアルティメットが当たるように

* ✅ **Q · ラッドスケートボード**が**ダメージ 0** になる不具合を修正
* 🐛 **原因**：命中判定が「**プレイヤー**から敵まで」の距離を使っており、「**ボード**から敵まで」ではありませんでした。ボードは 350 飛ぶため、経路上の敵はプレイヤーから遠すぎて判定に入らず、誰にも当たりませんでした
* ✅ ボードの現在位置から判定するよう変更
* ✅ 往路と復路を別々に判定するため、経路上に立つ敵は**2 回**ダメージを受けます —— 「往復両方でダメージ」という説明どおりになりました

# 🚀 2D大撃破 2.1.0 をダウンロード！

**インストーラー**と**ポータブル版**は下の Assets から。

---

## ⭐ Support Us

If you enjoy the game, a **Star** on this repo keeps the arena running.

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v2.0.0...v2.1.0
