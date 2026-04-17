/**
 * Tamagotchi-like prototype (Project 1 — Creature Care):
 * 1. Opening story (full #game-shell) → Next fades it → two note popups → beginGameplay() → creature + Feed.
 * 2. Each stage needs every required bar for that stage at 100%. Current column: 5 presses to fill; earlier columns: 3 (replay).
 * 3. After “Continue” on a stage milestone, stage increments and bars reset for the next round.
 * 4. Optional animation hooks: comments in applyToolPress, openTransitionForCompletedStage, onToolTravel.
 */

/** @enum {number} */
const Stage = {
  INTRO: 0,
  FEED: 1,
  PLAY: 2,
  TRAVEL: 3,
  FINAL: 4,
};

/** Maps {@link Stage} to `data-creature-stage` / `data-creature-phase` on SVG groups (see syncCreaturePlaceholder). */
const CREATURE_STAGE_ATTR = {
  [Stage.INTRO]: "intro",
  [Stage.FEED]: "feed",
  [Stage.PLAY]: "play",
  [Stage.TRAVEL]: "travel",
  [Stage.FINAL]: "final",
};

/** @typedef {'feed' | 'play' | 'travel' | 'final'} BarKey */

/** Max value for each progress bar (0–100 scale for <progress>). */
const BAR_MAX = {
  feed: 100,
  play: 100,
  travel: 100,
  final: 100,
};

const PRESSES_CURRENT_STAGE_BAR = 5;
const PRESSES_REPLAY_BAR = 3;

/**
 * Which “home” stage each bar belongs to (used to tell current vs replay fill rate).
 * @param {BarKey} key
 * @returns {number}
 */
function barHomeStage(key) {
  switch (key) {
    case "feed":
      return Stage.FEED;
    case "play":
      return Stage.PLAY;
    case "travel":
      return Stage.TRAVEL;
    case "final":
      return Stage.FINAL;
    default:
      return Stage.INTRO;
  }
}

/**
 * How many presses fill this bar at the current game stage.
 * @param {BarKey} key
 */
function pressesToFillBar(key) {
  if (gameState.stage === barHomeStage(key)) return PRESSES_CURRENT_STAGE_BAR;
  if (gameState.stage > barHomeStage(key)) return PRESSES_REPLAY_BAR;
  return PRESSES_CURRENT_STAGE_BAR;
}

/**
 * Per-press increment for this bar at the current stage.
 * @param {BarKey} key
 */
function barIncrement(key) {
  return BAR_MAX[key] / pressesToFillBar(key);
}

/**
 * Bars that must hit 100% before the stage clears and the transition popup runs.
 * @param {number} stage
 * @returns {BarKey[]}
 */
function requiredBarsForStage(stage) {
  switch (stage) {
    case Stage.FEED:
      return ["feed"];
    case Stage.PLAY:
      return ["feed", "play"];
    case Stage.TRAVEL:
      return ["feed", "play", "travel"];
    case Stage.FINAL:
      return ["feed", "play", "travel", "final"];
    default:
      return [];
  }
}

/** @returns {boolean} */
function isCurrentStageComplete() {
  return requiredBarsForStage(gameState.stage).every((k) => gameState.bars[k] >= BAR_MAX[k]);
}

const introOpeningContent = "The Creature";
const introOpeningButtonText = "Start";

const postIntroPopups = [
  { content: "Your solidarity is disturbed by a knock at your door.", buttonText: "A Package" },
  { content: "Inside, a small creature looks up at you.", buttonText: "It Looks Hungry" },
];

const POST_INTRO_DELAY_MS = 450;

/**
 * How long each finale cutscene frame stays on screen (ms), in order.
 * Add/remove `.fin__fr` nodes in index.html to match length.
 */
const FINALE_FRAME_DURATIONS_MS = [800, 800, 800, 800, 800, 800, 800, 1500];

/** @type {number} */
let finaleCutsceneTimeoutId = 0;

/**
 * Copy for the modal after a stage clears (all required bars full).
 * @type {Record<number, { content: string, buttonText: string }>}
 */
const stageTransitionCopy = {
  [Stage.FEED]: {
    content: "As you feed it, it grows rapidly. It now looks at you expectantly.",
    buttonText: "It Craves Something",
  },
  [Stage.PLAY]: {
    content: "It quickly outgrows your small apartment, pawing at the door.",
    buttonText: "Let It Out",
  },
  [Stage.TRAVEL]: {
    content: "It has seen much, and now hungers for that which it does not yet know.",
    buttonText: "Give It Knowledge",
  },
  [Stage.FINAL]: {
    content: "Knowledge complete\n\nPlaceholder ending — swap this for your finale.",
    buttonText: "Continue",
  },
};

const gameState = {
  stage: Stage.INTRO,
  introComplete: false,
  introSeqIndex: -1,
  bars: {
    feed: 0,
    play: 0,
    travel: 0,
    final: 0,
  },
  stagePopupOpen: false,
  pressAnimationActive: false,
};

const ui = {
  introLayer: null,
  introPopupBody: null,
  btnIntroNext: null,
  introSeqLayer: null,
  introSeqTitle: null,
  introSeqBody: null,
  btnIntroSeqNext: null,
  creatureViewportBars: null,
  stagePopupLayer: null,
  stagePopup: null,
  stagePopupTitle: null,
  stagePopupBody: null,
  toolbarContainer: null,
  btnStageContinue: null,
  gameView: null,
  creature: null,
  barFeed: null,
  barPlay: null,
  barTravel: null,
  barFinal: null,
  rowFeed: null,
  rowPlay: null,
  rowTravel: null,
  rowFinal: null,
  btnToolFeed: null,
  btnToolPlay: null,
  btnToolTravel: null,
  btnToolFinal: null,
  barFullToast: null,
  stagePopupDefault: null,
  finaleCutscene: null,
};

/** @type {number | null} */
let pendingStageComplete = null;

/** @type {number} */
let barFullToastTimer = 0;

const barFullMessages = {
  feed: "Not hungry — this bar is already full.",
  play: "All played out — this bar is already full.",
  travel: "No more travel for now — this bar is full.",
  final: "That’s enough reading — knowledge is full for now.",
};

function setAnimatedText(el, text) {
  el.innerHTML = text.split('').map((letter, i) => `<span class="letter" style="animation-delay: ${i * 0.1}s">${letter}</span>`).join('');
}

/**
 * Syncs viewport/toolbar metrics and the “playspace” rect (intro + finale overlays).
 * Union of `.creature-viewport` + `#toolbar-container` — wide layouts match the centered square + strip.
 */
/**
 * Syncs scale of UI elements based on game-shell actual width.
 * All sized elements scale proportionally with the game shell container.
 */
function syncViewportCssVars() {
  const vp = document.querySelector(".creature-viewport");
  const shell = document.getElementById("game-shell");
  const root = document.documentElement;
  
  // Sync popup-aside-svg based on viewport width
  if (vp) {
    const w = vp.getBoundingClientRect().width;
    root.style.setProperty("--viewport-side", `${w}px`);
    root.style.setProperty("--popup-aside-svg", `${w * 0.47}px`);
  }
  
  // Sync scale factor based on game-shell width
  if (shell) {
    const shellWidth = shell.getBoundingClientRect().width;
    // Reference width: 400px is the baseline for all sizing
    const referenceWidth = 400;
    const scale = shellWidth / referenceWidth;
    root.style.setProperty("--scale", scale);
  }
  
  // Update layout class based on available space ratio
  // Account for toolbar taking vertical space in portrait mode:
  // - Creature viewport is square (aspect 1:1) and fills width
  // - Toolbar needs additional ~25% of viewport height
  // - Use 1.3 threshold: if height/width < 1.3, portrait layout won't fit without scrolling
  const aspectRatio = window.innerHeight / window.innerWidth;
  const body = document.body;
  const PORTRAIT_THRESHOLD = 1.3;
  
  if (aspectRatio < PORTRAIT_THRESHOLD) {
    // Use landscape layout (width > height or not enough height for toolbar)
    body.classList.add("layout-landscape");
    body.classList.remove("layout-portrait");
  } else {
    // Use portrait layout (enough vertical space for stacked viewport + toolbar)
    body.classList.add("layout-portrait");
    body.classList.remove("layout-landscape");
  }
}

function setPressAnimationLock(locked) {
  gameState.pressAnimationActive = locked;
  const main = document.getElementById("main");
  if (main) {
    const buttons = main.querySelectorAll("button");
    if (locked) {
      for (const btn of buttons) {
        if (btn.dataset.animSaved !== undefined) continue;
        btn.dataset.animSaved = btn.disabled ? "1" : "0";
        btn.disabled = true;
      }
    } else {
      for (const btn of buttons) {
        if (btn.dataset.animSaved === undefined) continue;
        btn.disabled = btn.dataset.animSaved === "1";
        delete btn.dataset.animSaved;
      }
    }
  }
  applyStageToolbarAndLocks();
}

function cacheDom() {
  ui.introLayer = document.getElementById("intro-layer");
  ui.introPopupContent = document.getElementById("intro-popup-content");
  ui.introPopupContinue = document.getElementById("intro-popup-continue");
  ui.introSeqLayer = document.getElementById("intro-seq-layer");
  ui.introSeqContent = document.getElementById("intro-seq-content");
  ui.introSeqContinue = document.getElementById("intro-seq-continue");
  ui.creatureViewportBars = document.getElementById("creature-viewport-bars");
  ui.stagePopupLayer = document.getElementById("stage-popup-layer");
  ui.stagePopupContent = document.getElementById("stage-popup-content");
  ui.stagePopupContinue = document.getElementById("stage-popup-continue");
  ui.finaleLayer = document.getElementById("finale-layer");
  ui.finaleCutscene = document.getElementById("finale-cutscene");
  ui.creature = document.getElementById("creature");
  ui.barFeed = document.getElementById("bar-feed");
  ui.barPlay = document.getElementById("bar-play");
  ui.barTravel = document.getElementById("bar-travel");
  ui.barFinal = document.getElementById("bar-final");
  ui.rowFeed = document.getElementById("bar-row-feed");
  ui.rowPlay = document.getElementById("bar-row-play");
  ui.rowTravel = document.getElementById("bar-row-travel");
  ui.rowFinal = document.getElementById("bar-row-final");
  ui.btnToolFeed = document.getElementById("btn-tool-feed");
  ui.btnToolPlay = document.getElementById("btn-tool-play");
  ui.btnToolTravel = document.getElementById("btn-tool-travel");
  ui.btnToolFinal = document.getElementById("btn-tool-final");
  ui.barFullToast = document.getElementById("bar-full-toast");
  ui.stagePopupDefault = document.getElementById("stage-popup-default");
  ui.finaleCutscene = document.getElementById("finale-cutscene");
}

function wireButtons() {
  ui.introPopupContinue?.addEventListener("click", onIntroNext);
  ui.introSeqContinue?.addEventListener("click", onIntroSeqNext);
  ui.stagePopupContinue?.addEventListener("click", onStageContinue);

  ui.btnToolFeed?.addEventListener("click", onToolFeed);
  ui.btnToolPlay?.addEventListener("click", onToolPlay);
  ui.btnToolTravel?.addEventListener("click", onToolTravel);
  ui.btnToolFinal?.addEventListener("click", onToolFinal);
}

function wireDebugHotkeys() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key !== "1") return;
    showFinaleLayer();
    startFinaleCutscene();
  });
}

/** @param {BarKey} key */
function barRowElement(key) {
  switch (key) {
    case "feed":
      return ui.rowFeed;
    case "play":
      return ui.rowPlay;
    case "travel":
      return ui.rowTravel;
    case "final":
      return ui.rowFinal;
    default:
      return null;
  }
}

/** @param {BarKey} key */
function barElement(key) {
  switch (key) {
    case "feed":
      return ui.barFeed;
    case "play":
      return ui.barPlay;
    case "travel":
      return ui.barTravel;
    case "final":
      return ui.barFinal;
    default:
      return null;
  }
}

/** @param {BarKey} key */
function syncBarFromState(key) {
  const el = barElement(key);
  if (el) {
    el.value = gameState.bars[key];
  }
}

/**
 * Trigger the fade-up animation for a specific bar row.
 * Creates a clone of the bar that animates independently and removes itself.
 * @param {BarKey} key
 */
function triggerBarRowAnimation(key) {
  const template = barRowElement(key);
  if (!template) return;
  
  // Clone the template bar
  const clonedBar = template.cloneNode(true);
  clonedBar.classList.remove("is-hidden");
  clonedBar.setAttribute("aria-hidden", "false");
  
  // Update the cloned progress value to current state
  const progressEl = clonedBar.querySelector("progress");
  if (progressEl) progressEl.value = gameState.bars[key];
  
  // Add to container
  ui.creatureViewportBars?.appendChild(clonedBar);
  
  // Trigger animation
  clonedBar.classList.add("bar-row--animate-press");
  
  // Remove after animation
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    clonedBar.removeEventListener("animationend", onAnimEnd);
    clonedBar.remove();
  };
  
  const onAnimEnd = (e) => {
    if (e.animationName !== "bar-row-fade-up") return;
    cleanup();
  };
  
  clonedBar.addEventListener("animationend", onAnimEnd, { once: true });
  window.setTimeout(cleanup, 2500);
}


function syncAllBars() {
  syncBarFromState("feed");
  syncBarFromState("play");
  syncBarFromState("travel");
  syncBarFromState("final");
}

/**
 * Finale uses full #shell overlay; earlier stages use fixed centered modal.
 * @param {number} completedStage {@link Stage}
 */
function applyStagePopupPresentation(completedStage) {
  const layer = ui.stagePopupLayer;
  const popup = ui.stagePopup;
  if (!layer || !popup) return;
  const isFinale = completedStage === Stage.FINAL;
  layer.classList.toggle("stage-popup-layer--finale", isFinale);
  popup.classList.toggle("intro-popup--fit-game", isFinale);
  popup.classList.toggle("stage-popup--finale", isFinale);
}

function showStagePopup() {
  if (!ui.stagePopupLayer) return;
  syncViewportCssVars();
  clearTimeout(barFullToastTimer);
  hideBarFullToast();
  gameState.stagePopupOpen = true;
  applyStageToolbarAndLocks();
  ui.stagePopupLayer.hidden = false;
  ui.stagePopupLayer.classList.remove("is-hidden");

  ui.stagePopupDefault?.classList.remove("is-hidden");
  if (ui.btnStageContinue) ui.btnStageContinue.hidden = false;
  ui.btnStageContinue?.focus();
}

function hideStagePopup() {
  if (!ui.stagePopupLayer) return;
  gameState.stagePopupOpen = false;
  ui.stagePopupLayer.hidden = true;
  ui.stagePopupLayer.classList.add("is-hidden");
  ui.stagePopupLayer.classList.remove("stage-popup-layer--finale", "stage-popup-layer--fade-out");
  ui.stagePopup?.classList.remove("intro-popup--fit-game", "stage-popup--finale");
  ui.stagePopupDefault?.classList.remove("is-hidden");
  if (ui.btnStageContinue) ui.btnStageContinue.hidden = false;
  applyStageToolbarAndLocks();
}

function clearFinaleCutsceneTimers() {
  if (finaleCutsceneTimeoutId) {
    window.clearTimeout(finaleCutsceneTimeoutId);
    finaleCutsceneTimeoutId = 0;
  }
}

function startFinaleCutscene() {
  clearFinaleCutsceneTimers();
  const frameEls = ui.finaleCutscene?.querySelectorAll(".finale-cutscene__frame");
  if (!frameEls?.length) {
    finaleCutsceneTimeoutId = window.setTimeout(() => fadeOutFinaleLayerThenReset(), 800);
    return;
  }

  let i = 0;
  function showFrame(idx) {
    frameEls.forEach((el, j) => {
      const on = j === idx;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  function step() {
    showFrame(i);
    const isLast = i >= frameEls.length - 1;
    const hold = FINALE_FRAME_DURATIONS_MS[i] ?? 1000;
    if (isLast) {
      finaleCutsceneTimeoutId = window.setTimeout(() => {
        finaleCutsceneTimeoutId = 0;
        fadeOutFinaleLayerThenReset();
      }, hold);
      return;
    }
    finaleCutsceneTimeoutId = window.setTimeout(() => {
      i += 1;
      step();
    }, hold);
  }

  step();
}

function openTransitionForCompletedStage(completedStage) {
  pendingStageComplete = completedStage;
  if (completedStage === Stage.FINAL) {
    showFinaleLayer();
    startFinaleCutscene();
  } else {
    const copy = stageTransitionCopy[completedStage];
    if (copy && ui.stagePopupContent) ui.stagePopupContent.textContent = copy.content;
    if (ui.stagePopupContinue) setAnimatedText(ui.stagePopupContinue, copy.buttonText);
    applyStagePopupPresentation(completedStage);
    showStagePopup();
  }
}

function canPressBar(barKey) {
  if (!gameState.introComplete) return false;
  if (gameState.stagePopupOpen) return false;
  if (gameState.stage < barHomeStage(barKey)) return false;
  if (!requiredBarsForStage(gameState.stage).includes(barKey)) return false;
  return gameState.bars[barKey] < BAR_MAX[barKey];
}

function toolEligibleForInteraction(barKey) {
  if (!gameState.introComplete) return false;
  if (gameState.stagePopupOpen) return false;
  if (gameState.stage < barHomeStage(barKey)) return false;
  return requiredBarsForStage(gameState.stage).includes(barKey);
}

function hideBarFullToast() {
  if (!ui.barFullToast) return;
  ui.barFullToast.hidden = true;
  ui.barFullToast.classList.add("is-hidden");
}

function showBarFullFeedback(barKey) {
  if (gameState.pressAnimationActive) return;
  const msg = barFullMessages[barKey];
  if (msg && ui.barFullToast) {
    ui.barFullToast.textContent = msg;
    ui.barFullToast.hidden = false;
    ui.barFullToast.classList.remove("is-hidden");
  }
  clearTimeout(barFullToastTimer);
  barFullToastTimer = window.setTimeout(() => hideBarFullToast(), 2600);

  const creature = ui.creature;
  if (!creature) return;
  setPressAnimationLock(true);
  creature.classList.remove("creature--bar-full");
  void creature.offsetWidth;
  creature.classList.add("creature--bar-full");
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    creature.classList.remove("creature--bar-full");
    setPressAnimationLock(false);
  };
  creature.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, BAR_FULL_ANIMATION_MS + 80);
}

function handleToolClick(barKey) {
  if (gameState.pressAnimationActive) return;
  if (!toolEligibleForInteraction(barKey)) return;
  if (gameState.bars[barKey] >= BAR_MAX[barKey]) {
    showBarFullFeedback(barKey);
    return;
  }
  applyToolPress(barKey);
}

/** @satisfies {Record<BarKey, string>} */
const CREATURE_PRESS_CLASSES = {
  feed: "creature--press-feed",
  play: "creature--press-play",
  travel: "creature--press-travel",
  final: "creature--press-final",
};

/**
 * @param {BarKey} barKey
 * @param {() => void} [onAnimationEnd]
 */
function triggerToolPressAnimation(barKey, onAnimationEnd) {
  const el = ui.creature;
  const cls = CREATURE_PRESS_CLASSES[barKey];
  if (!el || !cls) {
    onAnimationEnd?.();
    return;
  }
  Object.values(CREATURE_PRESS_CLASSES).forEach((c) => el.classList.remove(c));
  void el.offsetWidth;
  el.classList.add(cls);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.remove(cls);
    onAnimationEnd?.();
  };
  el.addEventListener("animationend", finish, { once: true });
  window.setTimeout(finish, TOOL_PRESS_ANIMATION_MS + 80);
}

function applyToolPress(barKey) {
  if (!canPressBar(barKey)) return;
  if (gameState.pressAnimationActive) return;

  setPressAnimationLock(true);

  const max = BAR_MAX[barKey];

  gameState.bars[barKey] = Math.min(max, gameState.bars[barKey] + barIncrement(barKey));
  if (max - gameState.bars[barKey] < 0.5) {
    gameState.bars[barKey] = max;
  }
  syncBarFromState(barKey);
  triggerBarRowAnimation(barKey);

  const justCompletedStage = isCurrentStageComplete();
  const stageForPopup = gameState.stage;

  triggerToolPressAnimation(barKey, () => {
    setPressAnimationLock(false);
    if (justCompletedStage) {
      openTransitionForCompletedStage(stageForPopup);
    }
  });
}

function resetAllBars() {
  gameState.bars.feed = 0;
  gameState.bars.play = 0;
  gameState.bars.travel = 0;
  gameState.bars.final = 0;
  syncAllBars();
}

/** @param {HTMLElement | null} btn */
function toolbarSlotCluster(btn) {
  return /** @type {HTMLElement | null} */ (btn?.closest(".toolbar-slot__cluster"));
}

function syncCreaturePlaceholder() {
  const el = ui.creature;
  if (!el) return;
  const key = CREATURE_STAGE_ATTR[gameState.stage];
  if (!key) return;
  el.setAttribute("data-creature-stage", key);
  const svg = el.querySelector(".creature__placeholder");
  if (!svg) return;
  const phases = svg.querySelectorAll("g[data-creature-phase]");
  for (const g of phases) {
    const phase = g.getAttribute("data-creature-phase");
    const active = phase === key;
    g.setAttribute("visibility", active ? "visible" : "hidden");
    if (active) {
      g.style.removeProperty("display");
    } else {
      g.style.setProperty("display", "none");
    }
  }
}

function applyStageToolbarAndLocks() {
  const s = gameState.stage;
  const modal = gameState.stagePopupOpen;
  const toolLocked = modal || gameState.pressAnimationActive;

  if (!gameState.introComplete) {
    [ui.btnToolFeed, ui.btnToolPlay, ui.btnToolTravel, ui.btnToolFinal].forEach((btn) => {
      if (!btn) return;
      toolbarSlotCluster(btn)?.classList.add("toolbar-slot__cluster--tool-hidden");
      btn.disabled = true;
      btn.classList.remove("is-bar-full");
    });
    syncBarRowVisibility(s);
    syncCreaturePlaceholder();
    return;
  }

  const need = requiredBarsForStage(s);

  if (ui.btnToolFeed) {
    const show = s >= Stage.FEED;
    const full = gameState.bars.feed >= BAR_MAX.feed;
    ui.btnToolFeed.disabled = toolLocked || !show || !need.includes("feed");
    toolbarSlotCluster(ui.btnToolFeed)?.classList.toggle("toolbar-slot__cluster--tool-hidden", !show);
    ui.btnToolFeed.classList.toggle("is-bar-full", full && show && need.includes("feed"));
  }
  if (ui.btnToolPlay) {
    const unlocked = s >= Stage.PLAY;
    const full = gameState.bars.play >= BAR_MAX.play;
    ui.btnToolPlay.disabled = toolLocked || !unlocked || !need.includes("play");
    toolbarSlotCluster(ui.btnToolPlay)?.classList.toggle("toolbar-slot__cluster--tool-hidden", !unlocked);
    ui.btnToolPlay.classList.toggle("is-bar-full", full && unlocked && need.includes("play"));
  }
  if (ui.btnToolTravel) {
    const unlocked = s >= Stage.TRAVEL;
    const full = gameState.bars.travel >= BAR_MAX.travel;
    ui.btnToolTravel.disabled = toolLocked || !unlocked || !need.includes("travel");
    toolbarSlotCluster(ui.btnToolTravel)?.classList.toggle("toolbar-slot__cluster--tool-hidden", !unlocked);
    ui.btnToolTravel.classList.toggle("is-bar-full", full && unlocked && need.includes("travel"));
  }
  if (ui.btnToolFinal) {
    const unlocked = s >= Stage.FINAL;
    const full = gameState.bars.final >= BAR_MAX.final;
    ui.btnToolFinal.disabled = toolLocked || !unlocked || !need.includes("final");
    toolbarSlotCluster(ui.btnToolFinal)?.classList.toggle("toolbar-slot__cluster--tool-hidden", !unlocked);
    ui.btnToolFinal.classList.toggle("is-bar-full", full && unlocked && need.includes("final"));
  }

  syncBarRowVisibility(s);
  syncCreaturePlaceholder();
}

/**
 * @param {number} s {@link Stage}
 */
function syncBarRowVisibility(s) {
  // Keep all template bar rows hidden - cloned bars are created on demand via animation
  const rows = [
    { el: ui.rowFeed, minStage: Stage.FEED },
    { el: ui.rowPlay, minStage: Stage.PLAY },
    { el: ui.rowTravel, minStage: Stage.TRAVEL },
    { el: ui.rowFinal, minStage: Stage.FINAL },
  ];
  for (const { el } of rows) {
    if (!el) continue;
    el.classList.add("is-hidden");
    el.setAttribute("aria-hidden", "true");
  }
}

const FINALE_FADE_OUT_MS = 520;

function showFinaleLayer() {
  if (!ui.finaleLayer) return;
  syncViewportCssVars();
  ui.finaleLayer.hidden = false;
  ui.finaleLayer.classList.remove("is-hidden");
}

function hideFinaleLayer() {
  if (!ui.finaleLayer) return;
  ui.finaleLayer.hidden = true;
  ui.finaleLayer.classList.add("is-hidden");
}

function showIntroLayerUnderFinale() {
  renderOpeningIntro();
  if (!ui.introLayer) return;
  ui.introLayer.hidden = false;
  ui.introLayer.classList.remove("is-hidden", "intro-layer--fade-out");
}

function onStageContinue() {
  const completed = pendingStageComplete;
  pendingStageComplete = null;

  hideStagePopup();

  if (completed !== null) {
    gameState.stage = completed + 1;
    resetAllBars();
  }

  applyStageToolbarAndLocks();
  focusFirstIncompleteTool();
}

function fadeOutFinaleThenReset() {
  const layer = ui.stagePopupLayer;
  if (!layer?.classList.contains("stage-popup-layer--finale")) {
    hideStagePopup();
    resetGameToStart({ fadeIntro: false });
    return;
  }

  showIntroLayerUnderFinale();

  gameState.stagePopupOpen = false;
  applyStageToolbarAndLocks();

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    layer.removeEventListener("transitionend", onEnd);
    hideStagePopup();
    resetGameToStart({ introAlreadyVisible: true, postGameIntro: true });
  };

  /** @param {TransitionEvent} e */
  const onEnd = (e) => {
    if (e.target !== layer || e.propertyName !== "opacity") return;
    done();
  };

  layer.addEventListener("transitionend", onEnd);
  layer.classList.add("stage-popup-layer--fade-out");
  window.setTimeout(done, FINALE_FADE_OUT_MS);
}

function fadeOutFinaleLayerThenReset() {
  const layer = ui.finaleLayer;
  if (!layer) {
    resetGameToStart({ fadeIntro: false });
    return;
  }

  showIntroLayerUnderFinale();

  gameState.stagePopupOpen = false;
  applyStageToolbarAndLocks();

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    layer.removeEventListener("transitionend", onEnd);
    hideFinaleLayer();
    resetGameToStart({ introAlreadyVisible: true, postGameIntro: true });
  };

  /** @param {TransitionEvent} e */
  const onEnd = (e) => {
    if (e.target !== layer || e.propertyName !== "opacity") return;
    done();
  };

  layer.addEventListener("transitionend", onEnd);
  layer.classList.add("finale-layer--fade-out");
  window.setTimeout(done, FINALE_FADE_OUT_MS);
}

/**
 * @param {{ fadeIntro?: boolean, introAlreadyVisible?: boolean, postGameIntro?: boolean }} [options]
 */
function resetGameToStart(options = {}) {
  const fadeIntro = options.fadeIntro === true;
  const introAlreadyVisible = options.introAlreadyVisible === true;
  const postGameIntro = options.postGameIntro === true;
  clearTimeout(barFullToastTimer);
  hideBarFullToast();
  hideIntroSeqLayer();
  hideStagePopup();
  gameState.stage = Stage.INTRO;
  gameState.introComplete = false;
  gameState.introSeqIndex = -1;
  pendingStageComplete = null;
  gameState.stagePopupOpen = false;
  ui.creature?.classList.remove("creature--bar-full");
  ui.creature?.classList.add("is-hidden");
  ui.creatureViewportBars?.classList.add("is-hidden");
  ui.creatureViewportBars?.setAttribute("aria-hidden", "true");
  resetAllBars();
  if (ui.gameView) {
    ui.gameView.hidden = false;
    ui.gameView.classList.remove("is-hidden");
  }
  if (ui.introLayer) {
    if (postGameIntro) {
      ui.introLayer.classList.add("intro-layer--post-game");
    } else {
      ui.introLayer.classList.remove("intro-layer--post-game");
    }
    if (introAlreadyVisible) {
      ui.introLayer.classList.remove("intro-layer--fade-out");
    } else {
      ui.introLayer.hidden = false;
      ui.introLayer.classList.remove("is-hidden");
      if (fadeIntro) {
        ui.introLayer.classList.add("intro-layer--fade-out");
        void ui.introLayer.offsetWidth;
        requestAnimationFrame(() => {
          ui.introLayer?.classList.remove("intro-layer--fade-out");
        });
      } else {
        ui.introLayer.classList.remove("intro-layer--fade-out");
      }
    }
  }
  renderOpeningIntro();
  ui.toolbarContainer?.classList.remove("toolbar-container--shadows-visible");
  applyStageToolbarAndLocks();
  syncAllBars();
  ui.btnIntroNext?.focus();
}

function focusFirstIncompleteTool() {
  if (!gameState.introComplete) return;
  const order = /** @type {BarKey[]} */ (["feed", "play", "travel", "final"]);
  for (const k of order) {
    if (!requiredBarsForStage(gameState.stage).includes(k)) continue;
    if (gameState.bars[k] >= BAR_MAX[k]) continue;
    if (k === "feed") ui.btnToolFeed?.focus();
    else if (k === "play") ui.btnToolPlay?.focus();
    else if (k === "travel") ui.btnToolTravel?.focus();
    else if (k === "final") ui.btnToolFinal?.focus();
    return;
  }
}

function renderOpeningIntro() {
  if (ui.introPopupContent) ui.introPopupContent.textContent = introOpeningContent;
  if (ui.introPopupContinue) setAnimatedText(ui.introPopupContinue, introOpeningButtonText);
}

function hideIntroSeqLayer() {
  if (!ui.introSeqLayer) return;
  ui.introSeqLayer.hidden = true;
  ui.introSeqLayer.classList.add("is-hidden");
}

/**
 * @param {number} index
 */
function showIntroSeqPopup(index) {
  if (index >= postIntroPopups.length) {
    beginGameplay();
    return;
  }
  syncViewportCssVars();
  const copy = postIntroPopups[index];
  if (ui.introSeqContent) ui.introSeqContent.textContent = copy.content;
  if (ui.introSeqContinue) setAnimatedText(ui.introSeqContinue, copy.buttonText);
  gameState.introSeqIndex = index;
  if (ui.introSeqLayer) {
    ui.introSeqLayer.hidden = false;
    ui.introSeqLayer.classList.remove("is-hidden");
  }
  ui.btnIntroSeqNext?.focus();
}

function beginGameplay() {
  hideIntroSeqLayer();
  gameState.introSeqIndex = -1;
  gameState.introComplete = true;
  gameState.stage = Stage.FEED;
  ui.introLayer?.classList.remove("intro-layer--post-game");
  ui.toolbarContainer?.classList.add("toolbar-container--shadows-visible");
  ui.creature?.classList.remove("is-hidden");
  ui.creatureViewportBars?.classList.remove("is-hidden");
  ui.creatureViewportBars?.setAttribute("aria-hidden", "false");
  resetAllBars();
  applyStageToolbarAndLocks();
  focusFirstIncompleteTool();
}

function fadeOutIntroLayer() {
  return new Promise((resolve) => {
    const el = ui.introLayer;
    if (!el) {
      resolve();
      return;
    }
    const finish = () => {
      el.hidden = true;
      el.classList.add("is-hidden");
      resolve();
    };
    const onEnd = (e) => {
      if (e.propertyName !== "opacity") return;
      el.removeEventListener("transitionend", onEnd);
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    el.classList.add("intro-layer--fade-out");
    window.setTimeout(() => {
      el.removeEventListener("transitionend", onEnd);
      finish();
    }, 600);
  });
}

/** @param {Event} _e */
async function onIntroNext(_e) {
  if (gameState.introComplete) return;
  if (ui.introLayer?.classList.contains("intro-layer--fade-out")) return;
  await fadeOutIntroLayer();
  window.setTimeout(() => {
    showIntroSeqPopup(0);
  }, POST_INTRO_DELAY_MS);
}

/** @param {Event} _e */
function onIntroSeqNext(_e) {
  if (gameState.introSeqIndex === 0) {
    showIntroSeqPopup(1);
  } else {
    beginGameplay();
  }
}

function onToolFeed(_e) {
  handleToolClick("feed");
}

function onToolPlay(_e) {
  handleToolClick("play");
}

function onToolTravel(_e) {
  handleToolClick("travel");
}

function onToolFinal(_e) {
  handleToolClick("final");
}

function init() {
  cacheDom();
  wireButtons();
  wireDebugHotkeys();
  syncViewportCssVars();
  window.addEventListener("resize", syncViewportCssVars);
  const vp = document.querySelector(".creature-viewport");
  const dock = document.querySelector("#toolbar-container");
  const shell = document.getElementById("game-shell");
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => syncViewportCssVars());
    if (vp) ro.observe(vp);
    if (dock) ro.observe(dock);
    if (shell) ro.observe(shell);
  }
  requestAnimationFrame(() => syncViewportCssVars());
  renderOpeningIntro();
  syncAllBars();
  applyStageToolbarAndLocks();
  hideIntroSeqLayer();
  if (ui.stagePopupLayer) {
    ui.stagePopupLayer.hidden = true;
    ui.stagePopupLayer.classList.add("is-hidden");
  }
  hideBarFullToast();
  ui.btnIntroNext?.focus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
