# 🛠️ 2DFight Arena 2.5.2 — LOBBY HOTFIX

A small patch for one nasty multiplayer bug. No new installer — this one is code-only.

Here's what changed:

---

## 🐛 1. The 30-Second Vanishing Act

Idling in a lobby room used to count as going offline.

* 🐛 **Fixed**: waiting more than 30 seconds in a room got you **silently kicked** — the host vanished first, leaving only the newly joined player, and the Start button disappeared with them
* ✅ The lobby's polling now **keeps you alive**, so standing in the room page is enough

---

## 🐛 2. Leave Room That Stays Left

Pressing "Leave Room" sometimes didn't.

* 🐛 **Fixed**: the room screen could **reappear right after you left**, because a poll response was still on its way and redrew the room
* ✅ Stale responses are now dropped instead of repainting the room you just left

---

## ✅ 3. Notice & Return

If the server really did remove you, say so.

* ✅ Being removed from a room now **shows a notice** and **returns you to the lobby automatically**
* ✅ You never sit on a room page that no longer contains you

---

# 🚀 Download 2DFight Arena 2.5.2!

Code-only update — grab the **latest build from the repository** if you play the web version.

**Stay in the room. Stay in the fight.** 🛠️

---

# 🛠️ 2D大击败 2.5.2 正式发布 —— 联机大厅热修复

小补丁，只修一个联机 bug。纯代码更新，不提供安装包。

这次改了什么：

---

## 🐛 1. 三十秒消失术

在房间里干等，以前会被当成掉线。

* 🐛 **修复**：房间内等待超过 30 秒会被**静默踢出** —— 房主先消失，房间只剩新加入的人，开始按钮也没了
* ✅ 大厅轮询现在会**保持在线状态**，只要停在房间页面就不会再被误判

---

## 🐛 2. 退得掉的房间

点「退出房间」，有时候退不掉。

* 🐛 **修复**：退出后房间界面会**重新弹回来**，因为退出瞬间还有旧请求在路上，把房间重画了一遍
* ✅ 过期的响应现在会被直接丢弃，不再把刚退出的房间画回来

---

## ✅ 3. 提示与回归

真被服务器移出去了，就得说一声。

* ✅ 被移出房间时会**收到提示**并**自动返回大厅**
* ✅ 不会再卡在一个已经不属于你的房间页面上

---

# 🚀 快来下载《2D大击败》2.5.2！

纯代码更新 —— 玩网页版的直接用**仓库里的最新构建**。

**待在房间里，也留在战斗里。** 🛠️

---

# 🛠️ 2D大撃破 2.5.2 リリース —— ロビー緊急修正

マルチプレイヤーのバグ 1 件のみの修正です。コードのみの更新のため、インストーラーはありません。

今回の変更点はここです：

---

## 🐛 1. 30 秒の消失劇

ロビーの部屋で待機しているだけで、オフライン扱いになってしまっていました。

* 🐛 **修正**：部屋で 30 秒以上待つと**静かに退室させられ**、ホストが先に消え、部屋には新しく参加した人だけが残りました
* ✅ ロビーのポーリングが**オンライン状態を維持**するため、部屋ページにいれば誤判定されません

---

## 🐛 2. ちゃんと退室できる部屋

「退室」を押しても、戻ってしまうことがありました。

* 🐛 **修正**：退出直後に**部屋画面が再表示**されていました。飛行中のポーリング応答が部屋を再描画していたのが原因です
* ✅ 古い応答は破棄するようになり、退出した部屋が描き直されません

---

## ✅ 3. 通知して戻す

サーバーから外されたなら、それを伝えます。

* ✅ 部屋から外された場合は**通知**して**自動的にロビーへ戻ります**
* ✅ 自分のいない部屋画面に留まることはなくなりました

---

# 🚀 2D大撃破 2.5.2 をダウンロード！

コードのみの更新です —— Web 版を遊ぶ場合は**リポジトリの最新ビルド**をどうぞ。

**部屋の中に、そして戦いの中に。** 🛠️
