export const DIRECTIONS = ["top", "right", "bottom", "left"];
export const DIRECTION_LABELS = { top: "위", right: "오른쪽", bottom: "아래", left: "왼쪽" };
export const MATERIALS = {
  wood: { label: "나무", hp: 2, weight: 80 },
  stone: { label: "돌", hp: 3, weight: 15 },
  iron: { label: "철", hp: 4, weight: 5 }
};
export const SHAPES = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]]
};

export const EVENT_CARDS = [
  { id: "rotation", name: "회전 폭주", description: "남은 회전 +3", target: "none" },
  { id: "repairCastle", name: "왕실 수복", description: "성 HP +1 (최대 5)", target: "none" },
  { id: "redraw", name: "완전 재설계", description: "현재 손패 4장 교체", target: "none" },
  { id: "ironCard", name: "철 카드 각성", description: "선택 일반 카드를 철로 변경", target: "card" },
  { id: "stoneCard", name: "석재 보급", description: "선택 나무 카드를 돌로 변경", target: "card" },
  { id: "sync", name: "위협 동기화", description: "선택 카드 방향을 최위험 전선으로", target: "card" },
  { id: "freezeAll", name: "시간 정지", description: "다음 적 이동 전체 무시", target: "none" },
  { id: "freezeLane", name: "전선 빙결", description: "선택 전선 적 이동 1회 무시", target: "direction" },
  { id: "push", name: "밀어내기", description: "선택 전선 적을 1칸 후퇴", target: "direction" },
  { id: "compress", name: "전선 압축", description: "블럭을 적 방향으로 정렬", target: "direction" },
  { id: "repairLane", name: "긴급 보수", description: "선택 전선 블럭 HP +1", target: "direction" },
  { id: "forge", name: "왕실 대장간", description: "모든 블럭 HP +1", target: "none" },
  { id: "dropIron", name: "철벽 투하", description: "바깥 빈칸 2개에 철 설치", target: "direction" },
  { id: "woodRain", name: "목재 폭우", description: "바깥 빈칸 4개에 나무 설치", target: "direction" },
  { id: "catalyst", name: "합성 촉매", description: "다음 합성 결과 HP +1", target: "none" },
  { id: "mergeNow", name: "즉시 연쇄합성", description: "선택 전선 합성 즉시 실행", target: "direction" },
  { id: "remove", name: "선봉 제거", description: "성에 가장 가까운 적 제거", target: "direction" },
  { id: "burnQueue", name: "대기열 소각", description: "선택 전선 대기 적 제거", target: "direction" },
  { id: "ironFestival", name: "철의 축제", description: "현재 손패를 모두 철로 변경", target: "none" },
  { id: "gateSeal", name: "성문 봉쇄", description: "전선 정지 + 블럭 HP +1", target: "direction" }
];

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rotateOnce(cells) {
  return normalizeCells(cells.map(([x, y]) => [-y, x]));
}

export function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function shapeCells(shape, rotation = 0) {
  let cells = SHAPES[shape].map((cell) => [...cell]);
  for (let i = 0; i < ((rotation % 4) + 4) % 4; i += 1) cells = rotateOnce(cells);
  return normalizeCells(cells);
}

function createLane() {
  return {
    blocks: Array.from({ length: 10 }, () => Array(6).fill(null)),
    enemies: [],
    queue: Array(6).fill(0),
    frozen: 0
  };
}

function makeBlock(material, bonus = 0) {
  const hp = MATERIALS[material].hp + bonus;
  return { material, hp, maxHp: hp };
}

export class GameState {
  constructor(seed = Date.now()) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.turn = 1;
    this.maxTurns = 20;
    this.castleHp = 3;
    this.rotations = 10;
    this.mergeProgress = 0;
    this.globalFreeze = 0;
    this.mergeCatalyst = 0;
    this.status = "playing";
    this.lanes = Object.fromEntries(DIRECTIONS.map((direction) => [direction, createLane()]));
    this.hand = this.drawHand();
    this.inventory = [];
    this.rewardChoices = null;
    this.pendingRewards = 0;
    this.preview = [1, 2, 3].map((turn) => this.generateSpawn(turn));
    this.logs = ["루미나 공방성 방어를 시작합니다."];
  }

  randomItem(items) {
    return items[Math.floor(this.rng() * items.length)];
  }

  weightedMaterial() {
    const roll = this.rng() * 100;
    return roll < 80 ? "wood" : roll < 95 ? "stone" : "iron";
  }

  drawCard() {
    return {
      id: `${this.turn}-${Math.floor(this.rng() * 1e9)}`,
      shape: this.randomItem(Object.keys(SHAPES)),
      material: this.weightedMaterial(),
      direction: this.randomItem(DIRECTIONS),
      rotation: Math.floor(this.rng() * 4)
    };
  }

  drawHand() {
    return Array.from({ length: 4 }, () => this.drawCard());
  }

  spawnCount(turn) {
    if (turn <= 5) return 1;
    if (turn <= 13) return 2;
    return turn % 3 === 0 ? 3 : 2;
  }

  generateSpawn(turn) {
    return Array.from({ length: this.spawnCount(turn) }, () => ({
      direction: this.randomItem(DIRECTIONS),
      col: Math.floor(this.rng() * 6)
    }));
  }

  enemiesAt(lane, col, depth) {
    return lane.enemies.some((enemy) => enemy.col === col && enemy.depth === depth);
  }

  canOccupy(lane, cells, anchorCol, anchorDepth) {
    return cells.every(([x, y]) => {
      const col = anchorCol + x;
      const depth = anchorDepth + y;
      return col >= 0 && col < 6 && depth >= 0 && depth < 10 && !lane.blocks[depth][col] && !this.enemiesAt(lane, col, depth);
    });
  }

  getPlacement(card, anchorCol) {
    const lane = this.lanes[card.direction];
    const cells = shapeCells(card.shape, card.rotation);
    if (!this.canOccupy(lane, cells, anchorCol, 0)) return null;
    let depth = 0;
    while (this.canOccupy(lane, cells, anchorCol, depth + 1)) depth += 1;
    return cells.map(([x, y]) => ({ col: anchorCol + x, depth: depth + y }));
  }

  validAnchors(card) {
    return Array.from({ length: 6 }, (_, col) => col).filter((col) => this.getPlacement(card, col));
  }

  rotateCard(index) {
    if (this.status !== "playing" || this.rotations <= 0 || !this.hand[index]) return false;
    this.hand[index].rotation = (this.hand[index].rotation + 1) % 4;
    this.rotations -= 1;
    return true;
  }

  placeCard(index, anchorCol) {
    if (this.status !== "playing") return { ok: false, message: "게임이 종료되었습니다." };
    const card = this.hand[index];
    if (!card) return { ok: false, message: "카드를 선택하세요." };
    const placement = this.getPlacement(card, anchorCol);
    if (!placement) return { ok: false, message: "이 열에는 배치할 수 없습니다." };
    const lane = this.lanes[card.direction];
    placement.forEach(({ col, depth }) => { lane.blocks[depth][col] = makeBlock(card.material); });
    this.log(`${DIRECTION_LABELS[card.direction]} 전선에 ${MATERIALS[card.material].label} ${card.shape} 블럭을 배치했습니다.`);
    const merges = this.mergeLane(card.direction);
    this.finishAction(merges);
    return { ok: true, merges };
  }

  pass() {
    if (this.status !== "playing") return false;
    this.log("이번 턴의 일반 카드 사용을 포기했습니다.");
    this.finishAction(0);
    return true;
  }

  mergeLane(direction) {
    const lane = this.lanes[direction];
    const used = new Set();
    const matches = [];
    for (let depth = 0; depth < 9; depth += 1) {
      for (let col = 0; col < 5; col += 1) {
        const keys = [[depth, col], [depth, col + 1], [depth + 1, col], [depth + 1, col + 1]];
        if (keys.some(([d, c]) => used.has(`${d}:${c}`))) continue;
        const blocks = keys.map(([d, c]) => lane.blocks[d][c]);
        const material = blocks[0]?.material;
        if (!material || material === "iron" || blocks.some((block) => block?.material !== material)) continue;
        matches.push({ depth, col, material, keys });
        keys.forEach(([d, c]) => used.add(`${d}:${c}`));
      }
    }
    for (const match of matches) {
      match.keys.forEach(([depth, col]) => { lane.blocks[depth][col] = null; });
      const result = match.material === "wood" ? "stone" : "iron";
      lane.blocks[match.depth + 1][match.col] = makeBlock(result, this.mergeCatalyst ? 1 : 0);
      lane.blocks[match.depth + 1][match.col + 1] = makeBlock(result, this.mergeCatalyst ? 1 : 0);
    }
    if (matches.length) {
      this.mergeCatalyst = 0;
      this.applyOutwardGravity(direction);
      this.mergeProgress += matches.length;
      this.pendingRewards += Math.floor(this.mergeProgress / 3);
      this.mergeProgress %= 3;
      this.log(`${DIRECTION_LABELS[direction]} 전선에서 합성 ${matches.length}회가 발생했습니다.`);
    }
    return matches.length;
  }

  applyOutwardGravity(direction) {
    const lane = this.lanes[direction];
    let moved = true;
    while (moved) {
      moved = false;
      for (let depth = 8; depth >= 0; depth -= 1) {
        for (let col = 0; col < 6; col += 1) {
          if (lane.blocks[depth][col] && !lane.blocks[depth + 1][col] && !this.enemiesAt(lane, col, depth + 1)) {
            lane.blocks[depth + 1][col] = lane.blocks[depth][col];
            lane.blocks[depth][col] = null;
            moved = true;
          }
        }
      }
    }
  }

  createRewardChoices() {
    if (!this.pendingRewards || this.rewardChoices) return null;
    const pool = [...EVENT_CARDS];
    const choices = [];
    while (choices.length < 3) choices.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    this.rewardChoices = choices;
    return choices;
  }

  chooseReward(index) {
    if (!this.rewardChoices?.[index]) return false;
    this.inventory.push(this.rewardChoices[index]);
    this.log(`이벤트 카드 「${this.rewardChoices[index].name}」을 보관했습니다.`);
    this.rewardChoices = null;
    this.pendingRewards -= 1;
    return true;
  }

  finishAction() {
    this.moveEnemies();
    this.addCurrentSpawn();
    this.enterQueuedEnemies();
    if (this.castleHp <= 0) {
      this.status = "lost";
      this.log("성의 마력로가 꺼졌습니다.");
      return;
    }
    if (this.turn >= this.maxTurns) {
      this.status = "won";
      this.log("20턴 방어 성공! 루미나 공방성을 지켜냈습니다.");
      return;
    }
    this.turn += 1;
    this.hand = this.drawHand();
    this.preview.shift();
    this.preview.push(this.generateSpawn(this.turn + 2));
    this.createRewardChoices();
  }

  moveEnemies() {
    if (this.globalFreeze > 0) {
      this.globalFreeze -= 1;
      this.log("시간 정지로 모든 적 이동을 막았습니다.");
      return;
    }
    for (const direction of DIRECTIONS) {
      const lane = this.lanes[direction];
      if (lane.frozen > 0) {
        lane.frozen -= 1;
        continue;
      }
      const ordered = [...lane.enemies].sort((a, b) => a.depth - b.depth);
      const removed = new Set();
      for (const enemy of ordered) {
        if (removed.has(enemy)) continue;
        if (enemy.depth === 0) {
          this.castleHp = Math.max(0, this.castleHp - 1);
          removed.add(enemy);
          continue;
        }
        const nextDepth = enemy.depth - 1;
        const block = lane.blocks[nextDepth]?.[enemy.col];
        if (block) {
          block.hp -= 1;
          if (block.hp <= 0) lane.blocks[nextDepth][enemy.col] = null;
        } else if (!this.enemiesAt(lane, enemy.col, nextDepth)) {
          enemy.depth = nextDepth;
        }
      }
      lane.enemies = lane.enemies.filter((enemy) => !removed.has(enemy));
    }
  }

  addCurrentSpawn() {
    for (const spawn of this.preview[0]) this.lanes[spawn.direction].queue[spawn.col] += 1;
  }

  enterQueuedEnemies() {
    for (const lane of Object.values(this.lanes)) {
      for (let col = 0; col < 6; col += 1) {
        if (lane.queue[col] > 0 && !this.enemiesAt(lane, col, 10)) {
          lane.queue[col] -= 1;
          lane.enemies.push({ col, depth: 10 });
        }
      }
    }
  }

  threat(direction) {
    const lane = this.lanes[direction];
    const enemyScore = lane.enemies.reduce((sum, enemy) => sum + (11 - enemy.depth) * 4, 0);
    const queueScore = lane.queue.reduce((sum, count) => sum + count, 0);
    return enemyScore + queueScore;
  }

  mostDangerousDirection() {
    return [...DIRECTIONS].sort((a, b) => this.threat(b) - this.threat(a))[0];
  }

  useEvent(inventoryIndex, target = null) {
    const card = this.inventory[inventoryIndex];
    if (!card) return { ok: false, message: "이벤트 카드를 찾을 수 없습니다." };
    if (card.target === "direction" && !DIRECTIONS.includes(target)) return { ok: false, needs: "direction" };
    if (card.target === "card" && (!Number.isInteger(target) || !this.hand[target])) return { ok: false, needs: "card" };
    const lane = DIRECTIONS.includes(target) ? this.lanes[target] : null;
    const selected = Number.isInteger(target) ? this.hand[target] : null;
    let success = true;
    switch (card.id) {
      case "rotation": this.rotations += 3; break;
      case "repairCastle": this.castleHp = Math.min(5, this.castleHp + 1); break;
      case "redraw": this.hand = this.drawHand(); break;
      case "ironCard": selected.material = "iron"; break;
      case "stoneCard":
        if (selected.material !== "wood") success = false;
        else selected.material = "stone";
        break;
      case "sync": selected.direction = this.mostDangerousDirection(); break;
      case "freezeAll": this.globalFreeze += 1; break;
      case "freezeLane": lane.frozen += 1; break;
      case "push": this.pushEnemies(target); break;
      case "compress": this.applyOutwardGravity(target); break;
      case "repairLane": this.boostBlocks([target]); break;
      case "forge": this.boostBlocks(DIRECTIONS); break;
      case "dropIron": this.installOuter(target, "iron", 2); break;
      case "woodRain": this.installOuter(target, "wood", 4); break;
      case "catalyst": this.mergeCatalyst = 1; break;
      case "mergeNow": this.mergeLane(target); this.createRewardChoices(); break;
      case "remove": this.removeClosest(target); break;
      case "burnQueue": lane.queue.fill(0); break;
      case "ironFestival": this.hand.forEach((handCard) => { handCard.material = "iron"; }); break;
      case "gateSeal": lane.frozen += 1; this.boostBlocks([target]); break;
      default: success = false;
    }
    if (!success) return { ok: false, message: "현재 대상에는 사용할 수 없습니다." };
    this.inventory.splice(inventoryIndex, 1);
    this.log(`이벤트 「${card.name}」을 사용했습니다.`);
    return { ok: true };
  }

  boostBlocks(directions) {
    for (const direction of directions) {
      for (const row of this.lanes[direction].blocks) {
        for (const block of row) if (block) { block.maxHp += 1; block.hp += 1; }
      }
    }
  }

  installOuter(direction, material, count) {
    const lane = this.lanes[direction];
    let left = count;
    for (let depth = 9; depth >= 0 && left; depth -= 1) {
      for (let col = 0; col < 6 && left; col += 1) {
        if (!lane.blocks[depth][col] && !this.enemiesAt(lane, col, depth)) {
          lane.blocks[depth][col] = makeBlock(material);
          left -= 1;
        }
      }
    }
  }

  pushEnemies(direction) {
    const lane = this.lanes[direction];
    for (const enemy of [...lane.enemies].sort((a, b) => b.depth - a.depth)) {
      const next = enemy.depth + 1;
      if (next <= 10 && !this.enemiesAt(lane, enemy.col, next) && (next === 10 || !lane.blocks[next][enemy.col])) enemy.depth = next;
    }
  }

  removeClosest(direction) {
    const lane = this.lanes[direction];
    if (!lane.enemies.length) return;
    const closest = [...lane.enemies].sort((a, b) => a.depth - b.depth)[0];
    lane.enemies.splice(lane.enemies.indexOf(closest), 1);
  }

  log(message) {
    this.logs.unshift(`T${this.turn} · ${message}`);
    this.logs = this.logs.slice(0, 8);
  }
}
