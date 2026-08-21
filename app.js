(() => {
  "use strict";

  const CHAINS = [
    ["ART", "RATE", "TREAD", "CARTED", "REDACTS", "REDCOATS"],
    ["BAT", "BOAT", "BLOAT", "COBALT", "BACKLOT", "BLACKOUT"],
    ["ART", "PART", "TAPER", "PARENT", "PERTAIN", "PAINTERS"],
    ["CAN", "CANE", "CRANE", "NECTAR", "CERTAIN", "SCANTIER"],
    ["ANT", "ANTI", "GIANT", "EATING", "HEATING", "TEACHING"],
    ["RAN", "RAIN", "TRAIN", "RETAIN", "GRANITE", "CATERING"],
    ["ALE", "LANE", "ALIEN", "NAILED", "DEALING", "PLEADING"],
    ["CAN", "CANE", "CRANE", "NECTAR", "CERTAIN", "REACTION"]
  ];
  const HINT_COPY = [
    ["Need a nudge?", "First hint removes a distractor."],
    ["Narrow it down", "Next hint reveals the first letter."],
    ["One last clue", "Final hint reveals the second letter."],
    ["Hints spent", "You’ve used all three this game."]
  ];
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const qs = (selector) => document.querySelector(selector);
  const els = {
    stack: qs("#word-stack"), bank: qs("#letter-bank"), status: qs("#game-status"),
    attempts: qs("#attempts-label"), roundKicker: qs("#round-kicker"), roundPrompt: qs("#round-prompt"),
    progressLabel: qs("#progress-label"), progressBar: qs("#progress-bar"), tileCount: qs("#tile-count"),
    carryLegend: qs("#carry-legend"), submit: qs("#submit-button"), clear: qs("#clear-button"),
    attemptHistory: qs("#attempt-history"), attemptCount: qs("#attempt-count"), attemptList: qs("#attempt-list"),
    shuffle: qs("#shuffle-button"), hint: qs("#hint-button"), hintTitle: qs("#hint-title"),
    hintDescription: qs("#hint-description"), hintPips: qs("#hint-pips"), restart: qs("#restart-button"),
    howButton: qs("#how-button"), howDialog: qs("#how-dialog"), winDialog: qs("#win-dialog"),
    winSummary: qs("#win-summary"), winWords: qs("#win-words"), playAgain: qs("#play-again-button")
  };
  let state;

  function randomInt(max) {
    if (window.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = randomInt(index + 1);
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }
  function chainIndexFromUrl() {
    const raw = new URLSearchParams(location.search).get("chain");
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed % CHAINS.length : randomInt(CHAINS.length);
  }
  function addedLetter(previous, current) {
    const remaining = [...current];
    [...previous].forEach((letter) => remaining.splice(remaining.indexOf(letter), 1));
    return remaining[0];
  }
  function makeTiles(round) {
    const solution = state.chain[round];
    const carry = round ? [...state.chain[round - 1]] : [];
    const requiredNew = round ? addedLetter(state.chain[round - 1], solution) : null;
    const excluded = new Set([...solution, ...carry]);
    const distractors = shuffle(ALPHABET.filter((letter) => !excluded.has(letter))).slice(0, round ? 2 : 3);
    const letters = round ? [...carry, requiredNew, ...distractors] : [...solution, ...distractors];
    return shuffle(letters.map((letter, index) => ({
      id: `r${round}-${letter}-${index}`, letter, carry: carry.includes(letter)
    })));
  }
  function newGame() {
    const chainIndex = chainIndexFromUrl();
    state = {
      chainIndex, chain: CHAINS[chainIndex], round: 0, solved: [], tiles: [], slots: [],
      locked: new Set(), eliminated: new Set(), hintsUsed: 0, attempts: 0, roundAttempts: 0,
      attemptHistory: [],
      feedback: "Choose letters to build your guess.", feedbackType: "neutral", animating: false
    };
    prepareRound();
    if (els.winDialog.open) els.winDialog.close();
  }
  function prepareRound() {
    state.tiles = makeTiles(state.round);
    state.slots = Array(state.chain[state.round].length).fill(null);
    state.locked = new Set(); state.eliminated = new Set(); state.roundAttempts = 0;
    state.attemptHistory = [];
    state.feedback = state.round === 0 ? "Choose letters to build your guess." : "Rearrange every blue letter, then add one new letter.";
    state.feedbackType = "neutral"; state.animating = false;
    render();
  }
  function render() { renderStack(); renderBank(); renderAttempts(); renderChrome(); }
  function renderStack() {
    els.stack.innerHTML = "";
    for (let row = 0; row < 6; row += 1) {
      const length = row + 3;
      const rowEl = document.createElement("div");
      rowEl.className = `word-row ${row < state.round ? "is-past" : row === state.round ? "is-active" : "is-future"}`;
      rowEl.dataset.row = String(row);
      const label = document.createElement("span");
      label.className = "row-number"; label.textContent = String(row + 1).padStart(2, "0");
      const slots = document.createElement("div");
      slots.className = "slot-group";
      slots.setAttribute("aria-label", `${length}-letter ${row < state.round ? "solved" : row === state.round ? "current" : "future"} word`);
      for (let position = 0; position < length; position += 1) {
        const slot = document.createElement("button");
        slot.type = "button"; slot.className = "answer-slot";
        slot.style.setProperty("--tilt", `${((position % 3) - 1) * .5}deg`);
        if (row < state.round) {
          slot.textContent = state.solved[row][position]; slot.classList.add("is-filled"); slot.disabled = true;
        } else if (row === state.round) {
          const tileId = state.slots[position];
          const tile = state.tiles.find((candidate) => candidate.id === tileId);
          if (tile) {
            slot.textContent = tile.letter; slot.classList.add("is-filled"); slot.dataset.tileId = tile.id;
            if (state.locked.has(position)) slot.classList.add("is-locked");
            slot.disabled = state.locked.has(position) || state.animating;
            slot.setAttribute("aria-label", `${tile.letter} in position ${position + 1}${state.locked.has(position) ? ", revealed and locked" : ", remove"}`);
            slot.addEventListener("click", () => removeFromSlot(position));
          } else { slot.disabled = true; slot.setAttribute("aria-label", `Empty position ${position + 1}`); }
        } else { slot.disabled = true; slot.setAttribute("aria-label", `Future empty position ${position + 1}`); }
        slots.appendChild(slot);
      }
      rowEl.append(label, slots); els.stack.appendChild(rowEl);
    }
  }
  function renderBank() {
    els.bank.innerHTML = "";
    state.tiles.forEach((tile) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "letter-tile"; button.dataset.tileId = tile.id;
      button.dataset.letter = tile.letter; button.dataset.kind = tile.carry ? "carry" : "new"; button.textContent = tile.letter;
      if (tile.carry) button.classList.add("is-carry");
      if (state.slots.includes(tile.id)) button.classList.add("is-selected");
      if (state.eliminated.has(tile.id)) button.classList.add("is-eliminated");
      button.disabled = state.animating || state.slots.includes(tile.id) || state.eliminated.has(tile.id);
      const kind = tile.carry ? "carried letter, must use" : "new letter";
      const condition = state.eliminated.has(tile.id) ? ", eliminated distractor" : state.slots.includes(tile.id) ? ", selected" : "";
      button.setAttribute("aria-label", `${tile.letter}, ${kind}${condition}`);
      button.addEventListener("click", () => selectTile(tile.id)); els.bank.appendChild(button);
    });
  }
  function renderAttempts() {
    const attempts = state.attemptHistory;
    els.attemptHistory.hidden = attempts.length === 0;
    els.attemptCount.textContent = String(attempts.length);
    els.attemptList.innerHTML = "";
    attempts.forEach((attempt, index) => {
      const item = document.createElement("div"); item.className = `attempt-item ${attempt.correct ? "is-correct" : "is-wrong"}`;
      const word = document.createElement("span"); word.className = "attempt-word"; word.textContent = attempt.word;
      const detail = document.createElement("span"); detail.className = "attempt-detail"; detail.textContent = attempt.correct ? "Solved" : attempt.reason;
      const number = document.createElement("span"); number.className = "attempt-number"; number.textContent = String(index + 1).padStart(2, "0");
      item.append(number, word, detail); els.attemptList.appendChild(item);
    });
  }
  function renderChrome() {
    const solvedCount = state.solved.length; const remaining = 3 - state.hintsUsed;
    els.roundKicker.textContent = `Round ${state.round + 1} of 6`;
    els.roundPrompt.textContent = `Find the ${state.round + 3}-letter word`;
    els.progressLabel.textContent = `${solvedCount} / 6 solved`; els.progressBar.style.width = `${solvedCount / 6 * 100}%`;
    els.tileCount.textContent = `${state.tiles.length} tiles`; els.carryLegend.hidden = state.round === 0;
    els.status.textContent = state.feedback;
    els.status.className = `game-status ${state.feedbackType === "error" ? "is-error" : state.feedbackType === "success" ? "is-success" : ""}`;
    els.attempts.textContent = `${state.attempts} ${state.attempts === 1 ? "guess" : "guesses"}`;
    els.submit.disabled = !state.slots.every(Boolean) || state.animating;
    els.clear.disabled = !state.slots.some((tile, index) => tile && !state.locked.has(index)) || state.animating;
    els.shuffle.disabled = state.animating; els.hint.disabled = remaining === 0 || state.animating;
    els.hint.innerHTML = remaining ? `Use hint <span>${remaining} left</span>` : "No hints left";
    els.hintTitle.textContent = HINT_COPY[state.hintsUsed][0]; els.hintDescription.textContent = HINT_COPY[state.hintsUsed][1];
    els.hintPips.innerHTML = "";
    for (let i = 0; i < 3; i += 1) { const pip = document.createElement("i"); if (i < remaining) pip.className = "is-available"; els.hintPips.appendChild(pip); }
    els.hintPips.setAttribute("aria-label", `${remaining} ${remaining === 1 ? "hint" : "hints"} remaining`);
  }
  function clearFullGuessForReplacement() {
    if (state.slots.some((value) => value === null)) return false;
    state.slots = state.slots.map((tile, index) => state.locked.has(index) ? tile : null);
    return true;
  }
  function selectTile(tileId, clearedPrevious = false) {
    if (state.animating || state.eliminated.has(tileId) || state.slots.includes(tileId)) return;
    let position = state.slots.findIndex((value) => value === null);
    if (position === -1) {
      clearedPrevious = clearFullGuessForReplacement();
      position = state.slots.findIndex((value) => value === null);
    }
    if (position === -1) return setFeedback("Your row is full. Remove a letter to try another.", "error");
    state.slots[position] = tileId;
    const isComplete = state.slots.every(Boolean);
    setFeedback(isComplete ? "Checking your answer…" : clearedPrevious ? "Previous guess cleared — building a new one." : "Keep going.");
    if (isComplete) checkGuess();
  }
  function removeFromSlot(position) {
    if (state.animating || state.locked.has(position)) return;
    state.slots[position] = null; setFeedback("Letter returned to the bank.");
  }
  function setFeedback(message, type = "neutral") { state.feedback = message; state.feedbackType = type; render(); }
  function clearUnlocked() {
    state.slots = state.slots.map((tile, index) => state.locked.has(index) ? tile : null);
    setFeedback("The unlocked letters are back in the bank.");
  }
  function shuffleBank() { state.tiles = shuffle(state.tiles); setFeedback("Letters shuffled."); }
  function checkGuess() {
    if (state.animating || !state.slots.every(Boolean)) return;
    const guess = state.slots.map((id) => state.tiles.find((tile) => tile.id === id).letter).join("");
    const missingCarry = state.tiles.filter((tile) => tile.carry && !state.slots.includes(tile.id));
    if (missingCarry.length) { recordAttempt(guess, false, "Carry-over missing"); state.attempts += 1; state.roundAttempts += 1; return wrongFeedback("Every blue carry-over tile must be used."); }
    const solution = state.chain[state.round];
    if (guess !== solution) { recordAttempt(guess, false, "Not the hidden word"); state.attempts += 1; state.roundAttempts += 1; return wrongFeedback("That fits, but it isn’t the hidden word. Rearrange and try again."); }
    recordAttempt(guess, true, "Solved");
    state.animating = true; state.feedback = "That’s it — carry those letters forward!"; state.feedbackType = "success"; render();
    const active = els.stack.querySelector(".word-row.is-active"); active?.classList.add("is-correct");
    window.setTimeout(() => finishRound(solution), 520);
  }
  function recordAttempt(word, correct, reason) { state.attemptHistory.push({ word, correct, reason }); }
  function wrongFeedback(message) {
    state.feedback = message; state.feedbackType = "error"; render();
    const active = els.stack.querySelector(".word-row.is-active"); active?.classList.add("is-wrong");
    window.setTimeout(() => active?.classList.remove("is-wrong"), 420);
  }
  function finishRound(solution) {
    state.solved.push(solution);
    if (state.round === 5) { state.feedback = "Climb complete!"; state.feedbackType = "success"; state.animating = false; render(); return showWin(); }
    state.round += 1; prepareRound();
  }
  function useHint() {
    if (state.animating || state.hintsUsed >= 3) return;
    if (state.hintsUsed === 0) eliminateDistractor();
    if (state.hintsUsed === 1) revealPosition(0);
    if (state.hintsUsed === 2) revealPosition(1);
    state.hintsUsed += 1; render();
  }
  function eliminateDistractor() {
    const solution = new Set(state.chain[state.round]);
    const distractor = state.tiles.find((tile) => !solution.has(tile.letter) && !state.eliminated.has(tile.id));
    if (!distractor) return;
    const position = state.slots.indexOf(distractor.id);
    if (position !== -1 && !state.locked.has(position)) state.slots[position] = null;
    state.eliminated.add(distractor.id); state.feedback = `${distractor.letter} is a distractor — crossed off.`; state.feedbackType = "success";
  }
  function revealPosition(position) {
    const targetLetter = state.chain[state.round][position];
    const tile = state.tiles.find((candidate) => candidate.letter === targetLetter);
    const oldPosition = state.slots.indexOf(tile.id);
    if (oldPosition !== -1 && oldPosition !== position && !state.locked.has(oldPosition)) state.slots[oldPosition] = null;
    if (state.slots[position] && state.slots[position] !== tile.id && !state.locked.has(position)) state.slots[position] = null;
    state.slots[position] = tile.id; state.locked.add(position);
    state.feedback = `Position ${position + 1} is ${targetLetter}. It’s locked in.`; state.feedbackType = "success";
  }
  function removeLastUnlocked() {
    for (let index = state.slots.length - 1; index >= 0; index -= 1) {
      if (state.slots[index] && !state.locked.has(index)) return removeFromSlot(index);
    }
  }
  function chooseByKeyboard(letter) {
    const clearedPrevious = clearFullGuessForReplacement();
    const tile = state.tiles.find((candidate) => candidate.letter === letter && !state.slots.includes(candidate.id) && !state.eliminated.has(candidate.id));
    if (tile) return selectTile(tile.id, clearedPrevious);
    if (clearedPrevious) setFeedback("Previous guess cleared — building a new one.");
  }
  function showWin() {
    const remaining = 3 - state.hintsUsed;
    els.winSummary.textContent = `${state.attempts} ${state.attempts === 1 ? "guess" : "guesses"} · ${remaining} ${remaining === 1 ? "hint" : "hints"} saved`;
    els.winWords.innerHTML = state.chain.map((word) => `<span>${word}</span>`).join("");
    if (typeof els.winDialog.showModal === "function") els.winDialog.showModal(); else els.winDialog.setAttribute("open", "");
  }
  function getPublicState() {
    return { round: state.round, solved: [...state.solved], solution: state.chain[state.round], chain: [...state.chain],
      hintsUsed: state.hintsUsed, attempts: state.attempts,
      attemptHistory: state.attemptHistory.map((attempt) => ({ ...attempt })),
      tiles: state.tiles.map((tile) => ({ letter: tile.letter, carry: tile.carry, eliminated: state.eliminated.has(tile.id) })),
      locked: [...state.locked] };
  }

  els.submit.addEventListener("click", checkGuess); els.clear.addEventListener("click", clearUnlocked);
  els.shuffle.addEventListener("click", shuffleBank); els.hint.addEventListener("click", useHint);
  els.restart.addEventListener("click", newGame); els.playAgain.addEventListener("click", newGame);
  els.howButton.addEventListener("click", () => els.howDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]") || state.animating) return;
    if (/^[a-z]$/i.test(event.key)) chooseByKeyboard(event.key.toUpperCase());
    if (event.key === "Backspace") { event.preventDefault(); removeLastUnlocked(); }
    if (event.key === "Enter" && !els.submit.disabled) checkGuess();
  });
  window.__LETTER_CARRY__ = { getState: getPublicState, newGame };
  newGame();
})();
