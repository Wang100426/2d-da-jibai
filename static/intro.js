/**
 * 首页开场序列：先播放入场动画，再循环播放 waiting-start-motion，
 * 等玩家按空格 / 回车 / 点击后才进入主页。
 *
 * 每个浏览器会话只播放一次（sessionStorage["introShown"]）。
 * 模板里的内联脚本在 DOM 解析阶段就决定是否显示遮罩，避免已看过时闪一帧首页。
 */
(() => {
  const overlay = document.getElementById("intro-overlay");
  if (!overlay || overlay.hidden || overlay.dataset.introActive !== "1") return;
  const video = document.getElementById("intro-video");
  const hint = document.getElementById("intro-hint");
  const skip = document.getElementById("intro-skip");
  if (!video || !skip) return;

  const OPENING = "/static/intro/opening.mp4";
  const WAITING = "/static/intro/waiting.mp4";
  let phase = "opening";
  let done = false;

  const play = () => {
    const pending = video.play();
    // 自动播放被浏览器拦截时不做任何事：等待下一次用户手势解锁
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  };

  const finish = () => {
    if (done) return;
    done = true;
    try { sessionStorage.setItem("introShown", "1"); } catch (error) { /* 隐私模式下忽略 */ }
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", onPointer, true);
    video.pause();
    overlay.classList.add("intro-out");
    window.setTimeout(() => {
      overlay.hidden = true;
      overlay.removeAttribute("data-intro-active");
    }, 420);
  };

  const onKey = (event) => {
    // 开场期间吞掉全部按键，避免背后的主页地图误响应 WASD / E
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
      return;
    }
    const isConfirm = event.code === "Space" || event.key === " " || event.key === "Enter";
    if (!isConfirm) return;
    event.preventDefault();
    if (phase === "waiting") finish();
    else if (video.paused) play();
  };

  const onPointer = () => {
    if (phase === "waiting") finish();
    else if (video.paused) play();
  };

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("pointerdown", onPointer, true);
  skip.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    finish();
  });

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.addEventListener("ended", () => {
    if (phase !== "opening" || done) return;
    phase = "waiting";
    overlay.dataset.phase = "waiting";
    if (hint) hint.hidden = false;
    video.src = WAITING;
    video.loop = true;
    play();
  });
  // 视频缺失或解码失败时直接放行，绝不把玩家卡在遮罩里
  video.addEventListener("error", () => { if (!done) finish(); });
  video.src = OPENING;
  play();
})();
