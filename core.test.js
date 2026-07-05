import test from "node:test";
import assert from "node:assert/strict";
import { GameState, shapeCells } from "./core.js";

test("테트로미노 회전은 항상 4칸과 정규화된 좌표를 유지한다", () => {
  for (const shape of ["I", "T", "S", "Z", "J", "L"]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const cells = shapeCells(shape, rotation);
      assert.equal(cells.length, 4);
      assert.equal(Math.min(...cells.map(([x]) => x)), 0);
      assert.equal(Math.min(...cells.map(([, y]) => y)), 0);
      assert.equal(new Set(cells.map(([x, y]) => `${x}:${y}`)).size, 4);
    }
  }
});

test("빈 전선의 블럭은 적 방향 끝까지 배치된다", () => {
  const game = new GameState(1);
  const card = { shape: "I", material: "wood", direction: "top", rotation: 0 };
  const placement = game.getPlacement(card, 0);
  assert.deepEqual(placement.map(({ depth }) => depth), [9, 9, 9, 9]);
});

test("2x2 나무 합성은 바깥쪽 줄의 돌 2칸을 만든다", () => {
  const game = new GameState(2);
  const lane = game.lanes.top;
  for (const depth of [3, 4]) for (const col of [1, 2]) lane.blocks[depth][col] = { material: "wood", hp: 2, maxHp: 2 };
  const count = game.mergeLane("top");
  assert.equal(count, 1);
  assert.equal(game.mergeProgress, 1);
  const stones = lane.blocks.flat().filter((block) => block?.material === "stone");
  assert.equal(stones.length, 2);
});

test("적은 앞 블럭을 공격하고 파괴한 턴에는 전진하지 않는다", () => {
  const game = new GameState(3);
  game.preview[0] = [];
  const lane = game.lanes.left;
  lane.enemies.push({ col: 2, depth: 2 });
  lane.blocks[1][2] = { material: "wood", hp: 1, maxHp: 2 };
  game.moveEnemies();
  assert.equal(lane.blocks[1][2], null);
  assert.equal(lane.enemies[0].depth, 2);
});

test("20턴 행동을 마치고 성이 남아 있으면 승리한다", () => {
  const game = new GameState(4);
  game.turn = 20;
  game.castleHp = 99;
  game.preview[0] = [];
  Object.values(game.lanes).forEach((lane) => { lane.enemies = []; lane.queue.fill(0); });
  game.pass();
  assert.equal(game.status, "won");
});

test("같은 턴에 여러 적이 도달해도 성 HP는 음수가 되지 않는다", () => {
  const game = new GameState(6);
  game.castleHp = 1;
  game.lanes.top.enemies.push({ col: 0, depth: 0 }, { col: 1, depth: 0 });
  game.moveEnemies();
  assert.equal(game.castleHp, 0);
});

test("방향 대상 이벤트 카드는 사용 후 인벤토리에서 제거된다", () => {
  const game = new GameState(5);
  game.inventory.push({ id: "freezeLane", name: "전선 빙결", description: "", target: "direction" });
  const result = game.useEvent(0, "right");
  assert.equal(result.ok, true);
  assert.equal(game.lanes.right.frozen, 1);
  assert.equal(game.inventory.length, 0);
});
