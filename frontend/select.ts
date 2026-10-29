interface HeroPalette {
  main: string;
  light: string;
  dark: string;
}

interface SelectionSkill {
  id: string;
  name: string;
  description: string;
  detail_description?: string;
  kind: string;
  cost: number;
  cooldown: number;
  /** 2 阶 / 3 阶预览，label 已在后端按当前语言翻译。 */
  tier_effects?: Record<string, { label: string }>;
}

interface SelectionHero {
  id: string;
  name: string;
  class_name: string;
  tagline: string;
  initial: string;
  accent: string;
  palette: HeroPalette;
  passive: { name: string; description: string };
  stats: Record<string, number>;
  skills: SelectionSkill[];
  price: number;
  locked: boolean;
  /** 展示语音的文件名（相对 static/voices/）；没有就留空。 */
  voice?: string;
}

function requireSelectionElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing hero selection element: ${id}`);
  return element as T;
}

const heroes: SelectionHero[] = (window as Window & Partial<{ HERO_SELECTION: SelectionHero[] }>).HERO_SELECTION || [];
if (!heroes.length) throw new Error("Hero selection data was not provided by the Flask page.");
const gameMode = (window as Window & Partial<{ GAME_MODE: string }>).GAME_MODE === "duel" ? "duel" : "rogue";
const tierLabels: Record<string, string> =
  (window as Window & Partial<{ SELECT_TIER_LABELS: Record<string, string> }>).SELECT_TIER_LABELS || {};

const choices = [...document.querySelectorAll<HTMLButtonElement>("[data-hero-id]")];
const portrait = requireSelectionElement<HTMLDivElement>("detail-portrait");
const initial = requireSelectionElement<HTMLElement>("detail-initial");
const heroClass = requireSelectionElement<HTMLElement>("detail-class");
const heroName = requireSelectionElement<HTMLElement>("detail-name");
const tagline = requireSelectionElement<HTMLElement>("detail-tagline");
const stats = requireSelectionElement<HTMLDivElement>("detail-stats");
const skills = requireSelectionElement<HTMLDivElement>("detail-skill-list");
const passive = requireSelectionElement<HTMLDivElement>("detail-passive");
const passiveName = requireSelectionElement<HTMLElement>("detail-passive-name");
const passiveDesc = requireSelectionElement<HTMLElement>("detail-passive-desc");
const indexLabel = requireSelectionElement<HTMLElement>("detail-index");
const selectedName = requireSelectionElement<HTMLElement>("selected-name");
const enterBattle = requireSelectionElement<HTMLAnchorElement>("enter-battle");
const enterShop = requireSelectionElement<HTMLAnchorElement>("enter-shop");
const lockedBanner = requireSelectionElement<HTMLDivElement>("detail-locked");
const lockedPrice = requireSelectionElement<HTMLElement>("detail-locked-price");
const voiceButton = requireSelectionElement<HTMLButtonElement>("voice-play");
const voiceLabel = requireSelectionElement<HTMLElement>("voice-label");

const voicePlayLabel = voiceButton.dataset.playLabel || "试听语音";
const voiceStopLabel = voiceButton.dataset.stopLabel || "停止播放";
/** 全局音频开关（static/audio.js）；没加载到时退化成自己 new Audio。 */
interface GameAudioApi {
  play(src: string): HTMLAudioElement | null;
  stop(): void;
  isMuted(): boolean;
}
const gameAudio = (window as Window & Partial<{ GameAudio: GameAudioApi }>).GameAudio;
/** 当前正在播放的语音；同一时间只允许一条。 */
let voiceAudio: HTMLAudioElement | null = null;
let voiceHeroId = "";
let activeHeroId = "";

function resetVoiceButton(): void {
  voiceButton.classList.remove("playing");
  voiceLabel.textContent = voicePlayLabel;
}

function stopVoice(): void {
  if (gameAudio) gameAudio.stop();
  if (voiceAudio) {
    voiceAudio.pause();
    voiceAudio.currentTime = 0;
    voiceAudio = null;
  }
  resetVoiceButton();
}

/** 播放某个英雄的展示语音（自动停掉上一条）。 */
function playVoice(hero: SelectionHero): void {
  if (!hero.voice) return;
  // 静音时直接不播，也不进播放态
  if (gameAudio && gameAudio.isMuted()) {
    voiceHeroId = "";
    stopVoice();
    return;
  }
  voiceHeroId = hero.id;
  const url = `/static/voices/${encodeURIComponent(hero.voice)}`;
  const audio = gameAudio ? gameAudio.play(url) : new Audio(url);
  if (!audio) {
    voiceHeroId = "";
    resetVoiceButton();
    return;
  }
  voiceAudio = audio;
  audio.addEventListener("ended", () => {
    if (voiceAudio === audio) {
      voiceAudio = null;
      voiceHeroId = "";
      resetVoiceButton();
    }
  });
  audio.addEventListener("error", () => {
    if (voiceAudio === audio) stopVoice();
  });
  voiceButton.classList.add("playing");
  voiceLabel.textContent = voiceStopLabel;
  if (!gameAudio) {
    // 没有全局音频层时自己播；被浏览器拒绝就静默回退
    const started = audio.play();
    if (started && typeof started.catch === "function") {
      void started.catch(() => stopVoice());
    }
  }
}

function toggleVoice(hero: SelectionHero): void {
  if (!hero.voice) return;
  // 正在播同一个英雄的语音 → 再点一次就是停止
  if (voiceHeroId === hero.id && voiceAudio && !voiceAudio.paused) {
    stopVoice();
    voiceHeroId = "";
    return;
  }
  playVoice(hero);
}

function renderStats(hero: SelectionHero): void {
  stats.replaceChildren();
  Object.entries(hero.stats).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "detail-stat";
    const name = document.createElement("span");
    name.textContent = label;
    const score = document.createElement("b");
    score.textContent = String(value);
    const bar = document.createElement("i");
    const fill = document.createElement("em");
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    bar.append(fill);
    row.append(name, score, bar);
    stats.append(row);
  });
}

function renderSkills(hero: SelectionHero): void {
  skills.replaceChildren();
  hero.skills.forEach((skill, index) => {
    const row = document.createElement("article");
    row.className = "detail-skill";
    const key = document.createElement("kbd");
    key.textContent = ["Q", "E", "R"][index] || String(index + 1);
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = skill.name;
    const description = document.createElement("small");
    description.textContent = skill.detail_description || skill.description;
    copy.append(name, description);
    // 升阶预览：2 阶 / 3 阶各一行，文案由后端按当前语言翻译好。
    const tiers = Object.entries(skill.tier_effects || {}).sort(
      ([a], [b]) => Number(a) - Number(b),
    );
    if (tiers.length) {
      const list = document.createElement("ul");
      list.className = "skill-tiers";
      tiers.forEach(([tier, effect]) => {
        const item = document.createElement("li");
        const tag = document.createElement("em");
        tag.textContent = tierLabels[tier] || tier;
        const text = document.createElement("span");
        text.textContent = effect.label;
        item.append(tag, text);
        list.append(item);
      });
      copy.append(list);
    }
    const cooldown = document.createElement("span");
    cooldown.textContent = `${skill.cost} EN / ${skill.cooldown}s`;
    row.append(key, copy, cooldown);
    skills.append(row);
  });
}

function applyPalette(element: HTMLElement, palette: HeroPalette): void {
  element.style.setProperty("--hero-main", palette.main);
  element.style.setProperty("--hero-light", palette.light);
  element.style.setProperty("--hero-dark", palette.dark);
}

function selectHero(heroId: string, autoPlayVoice = false): void {
  const index = heroes.findIndex((hero) => hero.id === heroId);
  const hero = heroes[index];
  if (!hero) return;
  // 切英雄先掐掉上一条语音，别让两段叠在一起
  stopVoice();
  voiceHeroId = "";
  activeHeroId = hero.id;
  choices.forEach((choice) => {
    const selected = choice.dataset.heroId === hero.id;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
  portrait.className = `detail-portrait ${hero.accent}`;
  applyPalette(portrait, hero.palette);
  applyPalette(passive, hero.palette);
  passiveName.textContent = hero.passive.name;
  passiveDesc.textContent = hero.passive.description;
  initial.textContent = hero.initial;
  heroClass.textContent = hero.class_name;
  heroName.textContent = hero.name;
  tagline.textContent = hero.tagline;
  indexLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(heroes.length).padStart(2, "0")}`;
  selectedName.textContent = hero.name;
  enterBattle.href = `/battle?hero=${encodeURIComponent(hero.id)}${gameMode === "duel" ? "&mode=duel" : ""}`;
  // 未解锁的英雄：详情照常能看，但入场按钮换成「前往商店」。
  const locked = hero.locked === true;
  lockedBanner.hidden = !locked;
  lockedPrice.textContent = String(hero.price);
  enterBattle.hidden = locked;
  enterShop.hidden = !locked;
  renderStats(hero);
  renderSkills(hero);
  // 只有配了语音的英雄才显示试听按钮
  voiceButton.hidden = !hero.voice;
  // 点侧栏选英雄 = 用户手势，直接放语音；首屏进入不自动播（会被浏览器拦，也容易吓人）
  if (autoPlayVoice && hero.voice) playVoice(hero);
}

choices.forEach((choice) => {
  choice.addEventListener("click", () => selectHero(choice.dataset.heroId || "", true));
});

voiceButton.addEventListener("click", () => {
  const hero = heroes.find((item) => item.id === activeHeroId);
  if (hero) toggleVoice(hero);
});

// 页面切到后台时停掉，别在别的标签页里继续放
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopVoice();
});

// 全局静音（或别处主动停播）时，把试听按钮一起复位
document.addEventListener("gameaudio:stop", () => {
  voiceAudio = null;
  voiceHeroId = "";
  resetVoiceButton();
});

selectHero(choices.find((choice) => choice.classList.contains("selected"))?.dataset.heroId || heroes[0].id);
