import {
  GameState,
  DIRECTIONS,
  DIRECTION_LABELS,
  MATERIALS,
  shapeCells
} from "./core.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  turn: $("#turn-value"),
  hearts: $("#castle-hearts"),
  forecast: $("#forecast-list"),
  gauge: $("#merge-gauge"),
  inventory: $("#event-inventory"),
  rotations: $("#rotation-value"),
  rotate: $("#rotate-button"),
  hand: $("#hand"),
  pass: $("#pass-button"),
  instruction: $("#instruction"),
  log: $("#battle-log"),
  seed: $("#seed-label"),
  modal: $("#modal"),
  modalKicker: $("#modal-kicker"),
  modalTitle: $("#modal-title"),
  modalContent: $("#modal-content"),
  modalClose: $("#modal-close")
};

let game;
let selectedCard = null;
let previewAnchor = null;
let pendingEvent = null;
let modalLocked = false;

function freshGame() {
  const querySeed = new URLSearchParams(location.search).get("seed");
  const seed = querySeed ? Number(querySeed) : Math.floor(Date.now() % 1_000_000_000);
  game = new GameState(seed);
  selectedCard = null;
  previewAnchor = null;
  pendingEvent = null;
  closeModal(true);
  render();
}

function makeCell(direction, col, depth, previewSet) {
  const lane = game.lanes[direction];
  const cell = document.createElement("div");
  cell.className = "cell";
  if (depth === 0) cell.classList.add("entrance");
  if (depth === 10) cell.classList.add("spawn");
  if (previewSet.has(`${col}:${depth}`)) cell.classList.add("preview");
  const block = depth < 10 ? lane.blocks[depth][col] : null;
  if (block) {
    cell.classList.add("block", block.material);
    cell.textContent = block.hp;
    cell.title = `${MATERIALS[block.material].label} HP ${block.hp}/${block.maxHp}`;
  }
  const enemy = lane.enemies.find((item) => item.col === col && item.depth === depth);
  if (enemy) {
    const marker = document.createElement("span");
    marker.className = "enemy";
    marker.title = "조각 마물";
    cell.append(marker);
  }
  if (depth === 10 && lane.queue[col] > 0) {
    const queue = document.createElement("span");
    queue.className = "queue-count";
    queue.textContent = `+${lane.queue[col]}`;
    queue.title = "시작칸 대기열";
    cell.append(queue);
  }
  return cell;
}

function renderLane(direction) {
  const root = $(`#lane-${direction}`);
  root.replaceChildren();
  const card = selectedCard === null ? null : game.hand[selectedCard];
  const active = card?.direction === direction && !pendingEvent;
  root.classList.toggle("active", active);
  const grid = document.createElement("div");
  const vertical = direction === "top" || direction === "bottom";
  grid.className = `lane-grid ${vertical ? "vertical" : "horizontal"}`;

  const valid = active ? game.validAnchors(card) : [];
  if (active && !valid.includes(previewAnchor)) previewAnchor = valid[0] ?? null;
  const preview = active && previewAnchor !== null ? game.getPlacement(card, previewAnchor) : null;
  const previewSet = new Set((preview || []).map(({ col, depth }) => `${col}:${depth}`));

  if (direction === "top" || direction === "bottom") {
    const depths = direction === "top"
      ? Array.from({ length: 11 }, (_, index) => 10 - index)
      : Array.from({ length: 11 }, (_, index) => index);
    depths.forEach((depth) => {
      for (let col = 0; col < 6; col += 1) grid.append(makeCell(direction, col, depth, previewSet));
    });
  } else {
    const depths = direction === "left"
      ? Array.from({ length: 11 }, (_, index) => 10 - index)
      : Array.from({ length: 11 }, (_, index) => index);
    for (let col = 0; col < 6; col += 1) depths.forEach((depth) => grid.append(makeCell(direction, col, depth, previewSet)));
  }

  const label = document.createElement("span");
  label.className = "lane-label";
  label.textContent = `${DIRECTION_LABELS[direction]} 전선 · 위협 ${game.threat(direction)}`;

  const controls = document.createElement("div");
  controls.className = "column-controls";
  for (let col = 0; col < 6; col += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "column-button";
    button.dataset.direction = direction;
    button.dataset.column = String(col);
    button.textContent = col + 1;
    button.disabled = !valid.includes(col);
    if (valid.includes(col)) button.classList.add("valid");
    button.addEventListener("mouseenter", () => { previewAnchor = col; renderLanes(); });
    button.addEventListener("focus", () => { previewAnchor = col; renderLanes(); });
    button.addEventListener("click", () => placeSelected(col));
    controls.append(button);
  }
  root.append(label, grid, controls);
}

function renderLanes() {
  DIRECTIONS.forEach(renderLane);
}

function renderHearts() {
  elements.hearts.replaceChildren();
  for (let index = 0; index < game.castleHp; index += 1) {
    const heart = document.createElement("span");
    heart.className = `heart ${index >= 3 ? "bonus" : ""}`;
    heart.textContent = "♥";
    elements.hearts.append(heart);
  }
}

function renderForecast() {
  elements.forecast.replaceChildren();
  game.preview.forEach((spawns, offset) => {
    const panel = document.createElement("article");
    panel.className = `forecast-turn ${offset === 0 ? "current" : ""}`;
    const header = document.createElement("header");
    header.innerHTML = `<strong>${game.turn + offset}턴</strong><span>${spawns.length}마리</span>`;
    const chips = document.createElement("div");
    chips.className = "spawn-chips";
    spawns.forEach((spawn) => {
      const chip = document.createElement("span");
      chip.className = "spawn-chip";
      chip.textContent = `${DIRECTION_LABELS[spawn.direction]} ${spawn.col + 1}열`;
      chips.append(chip);
    });
    panel.append(header, chips);
    elements.forecast.append(panel);
  });
}

function miniShape(card) {
  const root = document.createElement("div");
  root.className = "mini-shape";
  const cells = shapeCells(card.shape, card.rotation);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const offsetX = (70 - width * 16) / 2;
  const offsetY = (55 - height * 16) / 2;
  cells.forEach(([x, y]) => {
    const cell = document.createElement("span");
    cell.className = `mini-cell ${card.material}`;
    cell.style.left = `${offsetX + x * 16}px`;
    cell.style.top = `${offsetY + y * 16}px`;
    root.append(cell);
  });
  return root;
}

function renderHand() {
  elements.hand.replaceChildren();
  game.hand.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `blueprint-card ${selectedCard === index ? "selected" : ""}`;
    button.dataset.cardIndex = String(index);
    const top = document.createElement("div");
    top.className = "card-top";
    top.innerHTML = `<span class="material-label">${MATERIALS[card.material].label} ${card.shape}</span><span class="card-direction">${DIRECTION_LABELS[card.direction]} 전선</span>`;
    const bottom = document.createElement("div");
    bottom.className = "card-bottom";
    bottom.innerHTML = `<span>HP ${MATERIALS[card.material].hp}</span><span>${card.rotation * 90}°</span>`;
    button.append(top, miniShape(card), bottom);
    button.addEventListener("click", () => selectHandCard(index));
    elements.hand.append(button);
  });
}

function renderInventory() {
  elements.inventory.replaceChildren();
  if (!game.inventory.length) {
    const empty = document.createElement("span");
    empty.className = "event-empty";
    empty.textContent = "합성 3회마다 이벤트 카드가 이곳에 보관됩니다.";
    elements.inventory.append(empty);
    return;
  }
  game.inventory.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-card";
    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span>`;
    button.addEventListener("click", () => beginEvent(index));
    elements.inventory.append(button);
  });
}

function renderGauge() {
  elements.gauge.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    dot.className = `merge-dot ${index < game.mergeProgress ? "on" : ""}`;
    elements.gauge.append(dot);
  }
}

function renderLog() {
  elements.log.replaceChildren();
  game.logs.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    elements.log.append(item);
  });
}

function render() {
  elements.turn.textContent = `${game.turn} / ${game.maxTurns}`;
  elements.rotations.textContent = `${game.rotations} / 10`;
  elements.seed.textContent = `SEED ${game.seed}`;
  elements.rotate.disabled = selectedCard === null || game.rotations <= 0 || game.status !== "playing" || pendingEvent;
  elements.pass.disabled = game.status !== "playing" || Boolean(pendingEvent);
  renderHearts();
  renderForecast();
  renderGauge();
  renderInventory();
  renderHand();
  renderLanes();
  renderLog();
  if (game.rewardChoices) showRewardModal();
  else if (game.status !== "playing") showResult();
}

function selectHandCard(index) {
  if (game.status !== "playing") return;
  if (pendingEvent) {
    const result = game.useEvent(pendingEvent.index, index);
    pendingEvent = null;
    elements.instruction.textContent = result.ok ? "이벤트 카드가 적용되었습니다." : result.message;
    render();
    return;
  }
  selectedCard = selectedCard === index ? null : index;
  previewAnchor = null;
  elements.instruction.textContent = selectedCard === null
    ? "카드를 선택한 뒤 강조된 전선의 열 번호를 선택하세요."
    : `${DIRECTION_LABELS[game.hand[selectedCard].direction]} 전선에서 파란 열 번호를 선택하세요.`;
  render();
}

function placeSelected(col) {
  if (selectedCard === null) return;
  const result = game.placeCard(selectedCard, col);
  elements.instruction.textContent = result.ok ? "턴 처리가 완료되었습니다. 다음 설계도를 선택하세요." : result.message;
  selectedCard = null;
  previewAnchor = null;
  render();
}

function rotateSelected() {
  if (selectedCard === null) return;
  if (game.rotateCard(selectedCard)) {
    previewAnchor = null;
    elements.instruction.textContent = "블럭을 시계 방향으로 90° 회전했습니다.";
    render();
  }
}

function beginEvent(index) {
  const card = game.inventory[index];
  if (!card || game.status !== "playing") return;
  if (card.target === "none") {
    const result = game.useEvent(index);
    elements.instruction.textContent = result.ok ? `「${card.name}」 효과가 적용되었습니다.` : result.message;
    render();
    return;
  }
  if (card.target === "card") {
    pendingEvent = { index };
    selectedCard = null;
    elements.instruction.textContent = `「${card.name}」을 적용할 일반 카드를 선택하세요.`;
    render();
    return;
  }
  openModal("EVENT TARGET", `${card.name} · 전선 선택`, "", false);
  const wrapper = document.createElement("div");
  wrapper.className = "target-buttons";
  DIRECTIONS.forEach((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "target-button";
    button.textContent = `${DIRECTION_LABELS[direction]} 전선 · 위협 ${game.threat(direction)}`;
    button.addEventListener("click", () => {
      const result = game.useEvent(index, direction);
      closeModal(true);
      elements.instruction.textContent = result.ok ? `「${card.name}」 효과가 적용되었습니다.` : result.message;
      render();
    });
    wrapper.append(button);
  });
  elements.modalContent.append(wrapper);
}

function showRewardModal() {
  openModal("MERGE BURST", "합성폭발 보상", "세 장 중 보관할 이벤트 카드 한 장을 선택하세요.", true);
  const options = document.createElement("div");
  options.className = "reward-options";
  game.rewardChoices.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-card";
    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span>`;
    button.addEventListener("click", () => {
      game.chooseReward(index);
      if (game.pendingRewards > 0) game.createRewardChoices();
      else closeModal(true);
      render();
    });
    options.append(button);
  });
  elements.modalContent.append(options);
}

function showResult() {
  const won = game.status === "won";
  openModal(won ? "DEFENSE COMPLETE" : "WORKSHOP FALLEN", won ? "방어 성공!" : "방어 실패", "", true);
  elements.modalContent.innerHTML = `
    <p>${won ? "루미나 공방성은 마지막 파도까지 버텨냈습니다." : "마력로가 꺼졌지만, 다음 설계는 더 단단해질 겁니다."}</p>
    <div class="result-stat"><div><span>도달 턴</span><br><strong>${game.turn}</strong></div><div><span>성 HP</span><br><strong>${game.castleHp}</strong></div></div>
    <button id="result-restart" class="primary-button" type="button">새 방어 시작</button>`;
  $("#result-restart").addEventListener("click", freshGame);
}

function openModal(kicker, title, paragraph = "", locked = false) {
  modalLocked = locked;
  elements.modalKicker.textContent = kicker;
  elements.modalTitle.textContent = title;
  elements.modalContent.innerHTML = paragraph ? `<p>${paragraph}</p>` : "";
  elements.modalClose.hidden = locked;
  elements.modal.classList.remove("hidden");
}

function closeModal(force = false) {
  if (modalLocked && !force) return;
  modalLocked = false;
  elements.modal.classList.add("hidden");
}

function showHelp() {
  openModal("HOW TO PLAY", "공방성 방어 지침", "", false);
  elements.modalContent.innerHTML = `
    <ol>
      <li>손패에서 설계도 카드 한 장을 선택합니다.</li>
      <li>카드가 가리키는 전선에 나타난 파란 열 번호를 선택해 블럭을 배치합니다.</li>
      <li>R 키로 선택 블럭을 회전할 수 있으며, 한 판에 기본 10회만 사용할 수 있습니다.</li>
      <li>같은 재질 2×2는 다음 재질의 2×1 블럭으로 합성됩니다.</li>
      <li>적은 턴마다 성으로 전진하고, 블럭을 만나면 HP를 1 깎습니다.</li>
      <li>20턴 종료까지 성 HP를 1 이상 유지하면 승리합니다.</li>
    </ol>
    <p>칸의 숫자는 블럭 HP, 붉은 원은 적, 시작칸의 +숫자는 대기 중인 적입니다.</p>`;
}

elements.rotate.addEventListener("click", rotateSelected);
elements.pass.addEventListener("click", () => {
  if (game.pass()) {
    selectedCard = null;
    previewAnchor = null;
    elements.instruction.textContent = "턴을 넘겼습니다.";
    render();
  }
});
$("#restart-button").addEventListener("click", freshGame);
$("#help-button").addEventListener("click", showHelp);
elements.modalClose.addEventListener("click", () => closeModal());
elements.modal.addEventListener("click", (event) => { if (event.target === elements.modal) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r" && elements.modal.classList.contains("hidden")) rotateSelected();
  if (event.key === "Escape") closeModal();
});

freshGame();
