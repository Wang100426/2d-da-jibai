# 2D大击败 2.5.2 — Lobby Hotfix

## English

A small patch for one nasty multiplayer bug. No new installer — this one is code-only.

* 🐛 **Fixed**: idling in a LAN lobby room for more than 30 seconds got you silently kicked — the host disappeared first, leaving only the newly joined player, and the Start button went with them
* 🐛 **Fixed**: pressing "Leave Room" sometimes bounced you right back into the room screen (a stale in-flight poll response re-rendered it)
* ✅ Being removed from a room now shows a notice and returns you to the lobby automatically

## 中文

小补丁，只修一个联机 bug。纯代码更新，不提供安装包。

* 🐛 **修复**：联机房间内等待超过 30 秒会被静默踢出 —— 房主先消失，房间只剩新加入的人，开始按钮也没了
* 🐛 **修复**：点「退出房间」后界面又弹回房间（退出瞬间还有旧请求在路上，把房间重新画了出来）
* ✅ 被移出房间时会收到提示并自动返回大厅

## 日本語

マルチプレイヤーのバグ 1 件のみの修正。コードのみの更新のため、インストーラーはありません。

* 🐛 **修正**：LAN ロビーで 30 秒待つと勝手に退室させられ、ホストが消えて部屋に新規参加者だけが残る問題
* 🐛 **修正**：「退室」を押しても部屋画面が再表示される問題（飛行中のポーリング応答が原因）
* ✅ 部屋から外されたら通知してロビーへ自動的に戻ります

**Full Changelog**: https://github.com/Wang100426/2d-da-jibai/compare/v2.5.1...v2.5.2
