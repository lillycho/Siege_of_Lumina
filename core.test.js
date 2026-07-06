import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DIRECTIONS, GameState, shapeCells } from "./core.js";
import { GAME_BALANCE } from "./game-balance.js";
import { ART_ASSETS, blockAssetForState } from "./art-assets.js";

const cssRule = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule exists`);
  return match[1];
};

test("현재 사용하기로 한 아트 에셋 매니페스트가 실제 파일과 연결된다", () => {
  const required = [
    ART_ASSETS.background.stage,
    ART_ASSETS.castle.idle,
    ART_ASSETS.castle.hit,
    ART_ASSETS.enemies.fragment.idle,
    ART_ASSETS.enemies.fragment.move,
    ART_ASSETS.enemies.fragment.attack,
    ART_ASSETS.enemies.fragment.vanish,
    ART_ASSETS.tiles.field,
    ART_ASSETS.tiles.entrance,
    ART_ASSETS.tiles.spawn,
    ART_ASSETS.tiles.hoverValid,
    ART_ASSETS.tiles.hoverInvalid,
    ART_ASSETS.cards.blueprint,
    ART_ASSETS.cards.event,
    ...Object.values(ART_ASSETS.tutorial),
    ...Object.values(ART_ASSETS.endings),
    ...Object.values(ART_ASSETS.icons),
    ...Object.values(ART_ASSETS.audio),
    ...Object.values(ART_ASSETS.blocks).flatMap((states) => Object.values(states))
  ];

  assert.equal(required.includes("assets/art/backgrounds/bg_stage_01_sunset.png"), false);
  assert.equal(required.includes("assets/art/backgrounds/bg_stage_02_workshop.png"), false);
  assert.equal(blockAssetForState({ material: "wood", hp: 1, maxHp: 3 }), ART_ASSETS.blocks.wood.critical);

  for (const assetPath of required) {
    assert.equal(existsSync(fileURLToPath(new URL(assetPath, import.meta.url))), true, assetPath);
  }
});

test("게임은 CC0 귀엽고 당찬 배경음과 전역 클릭 효과음을 연결한다", () => {
  const html = readFileSync(fileURLToPath(new URL("./index.html", import.meta.url)), "utf8");
  const gameJs = readFileSync(fileURLToPath(new URL("./game.js", import.meta.url)), "utf8");
  const audioReadme = readFileSync(fileURLToPath(new URL("./assets/audio/README.md", import.meta.url)), "utf8");

  const bgmPath = fileURLToPath(new URL(ART_ASSETS.audio.bgm, import.meta.url));
  assert.equal(existsSync(bgmPath), true);
  assert.ok(statSync(bgmPath).size > 100_000);
  assert.equal(existsSync(fileURLToPath(new URL(ART_ASSETS.audio.click, import.meta.url))), true);
  assert.match(html, /id="audio-button"/);
  assert.match(gameJs, /function setupAudio/);
  assert.match(gameJs, /function unlockAudio/);
  assert.match(gameJs, /function updateAudioButton/);
  assert.match(gameJs, /function playClickSound/);
  assert.match(gameJs, /elements\.audio\.addEventListener\("click",\s*\(\)\s*=>\s*unlockAudio\(\)\)/);
  assert.match(gameJs, /document\.addEventListener\("click",\s*handleGlobalClick,\s*true\)/);
  assert.match(gameJs, /backgroundMusic\.loop\s*=\s*true/);
  assert.match(gameJs, /ART_ASSETS\.audio\.bgm/);
  assert.match(gameJs, /ART_ASSETS\.audio\.click/);
  assert.match(audioReadme, /Happy But Frozen In Time/);
  assert.doesNotMatch(audioReadme, /First Light Particles|Music Jingles/);
});

test("UI는 둥근모 폰트와 화면 맞춤 확대 레이아웃을 사용한다", () => {
  const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
  const html = readFileSync(fileURLToPath(new URL("./index.html", import.meta.url)), "utf8");

  assert.equal(existsSync(fileURLToPath(new URL("./assets/fonts/DungGeunMo.ttf", import.meta.url))), true);
  assert.match(css, /@font-face[\s\S]*font-family:\s*"DungGeunMo"/);
  assert.match(css, /font-size:\s*150%/);
  assert.match(css, /--cell:\s*clamp\(27px,\s*2\.55vw,\s*40px\)/);
  assert.match(css, /--castle-size:\s*clamp\(190px,\s*14vw,\s*250px\)/);
  assert.match(css, /\.topbar\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /\.game-shell\s*\{[\s\S]*--ui-scale:/);
  assert.match(cssRule(css, ".game-shell"), /grid-template-columns:\s*clamp\(190px,\s*15vw,\s*220px\)\s+minmax\(660px,\s*1fr\)\s+clamp\(190px,\s*15vw,\s*220px\)/);
  assert.match(cssRule(css, ".game-shell"), /column-gap:\s*clamp\(28px,\s*3vw,\s*48px\)/);
  const turnRule = cssRule(css, ".turn-panel");
  assert.match(turnRule, /grid-column:\s*1/);
  assert.match(turnRule, /grid-row:\s*2\s*\/\s*span\s*2/);
  assert.match(turnRule, /justify-self:\s*start/);
  assert.match(turnRule, /width:\s*210px/);
  const forecastRule = cssRule(css, ".forecast-panel");
  assert.match(forecastRule, /position:\s*fixed/);
  assert.match(forecastRule, /right:\s*clamp\(14px,\s*1\.7vw,\s*28px\)/);
  assert.match(forecastRule, /top:\s*clamp\(84px,\s*12vh,\s*130px\)/);
  assert.match(forecastRule, /width:\s*210px/);
  assert.match(cssRule(css, ".forecast-panel h2"), /font-size:\s*20px/);
  assert.match(cssRule(css, ".forecast-panel .panel-heading > span"), /font-size:\s*14px/);
  assert.match(cssRule(css, ".forecast-turn header"), /font-size:\s*14px/);
  assert.match(cssRule(css, ".spawn-chip"), /font-size:\s*14px/);
  assert.match(cssRule(css, ".spawn-chips"), /flex-direction:\s*column/);
  assert.match(css, /line-height:\s*1\.65/);
  assert.match(css, /\.game-shell\s*\{[\s\S]*align-content:\s*center/);
  assert.match(css, /\.game-shell\s*\{[\s\S]*grid-template-rows:\s*clamp\(28px,\s*5vh,\s*54px\)/);
  const battlefieldRule = cssRule(css, ".battlefield");
  assert.match(battlefieldRule, /grid-column:\s*2/);
  assert.match(battlefieldRule, /grid-row:\s*3/);
  assert.match(battlefieldRule, /transform:\s*none/);
  assert.match(css, /\.merge-panel\s*\{[\s\S]*justify-self:\s*center/);
  assert.match(css, /\.hand-panel\s*\{[\s\S]*justify-self:\s*center/);
  assert.match(css, /\.direction-icon\s*\{[\s\S]*width:\s*24px/);
  assert.match(cssRule(css, ".key-button:disabled"), /opacity:\s*1/);
  assert.match(html, /<title>루미나 공방성<\/title>/);
  assert.match(html, /<h1>루미나 공방성<\/h1>/);
});

test("설계도 카드 상단은 블럭 모양 아이콘과 전선 방향 텍스트 없이 방향 아이콘만 쓴다", () => {
  const gameJs = readFileSync(fileURLToPath(new URL("./game.js", import.meta.url)), "utf8");

  assert.equal(gameJs.includes("shapeIcon(card.shape)"), false);
  assert.equal(gameJs.includes("${DIRECTION_LABELS[card.direction]} 전선"), false);
  assert.match(gameJs, /class="direction-icon"/);
});

test("게임 시작 전 나레이션과 비주얼 노벨 대화 화면을 가진다", () => {
  const html = readFileSync(fileURLToPath(new URL("./index.html", import.meta.url)), "utf8");
  const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
  const gameJs = readFileSync(fileURLToPath(new URL("./game.js", import.meta.url)), "utf8");

  assert.equal(existsSync(fileURLToPath(new URL(ART_ASSETS.background.intro, import.meta.url))), true);
  for (const portrait of Object.values(ART_ASSETS.characters)) {
    assert.equal(existsSync(fileURLToPath(new URL(portrait, import.meta.url))), true, portrait);
  }
  assert.match(html, /id="intro-overlay"/);
  assert.match(html, /id="intro-speaker"/);
  assert.match(cssRule(css, ".intro-overlay"), /background-image:\s*var\(--intro-art\)/);
  assert.match(cssRule(css, ".intro-caption"), /background:\s*linear-gradient/);
  assert.match(cssRule(css, ".intro-text"), /font-size:\s*clamp\(16px,\s*1\.6vw,\s*25px\)/);
  assert.match(cssRule(css, ".intro-character.dimmed"), /filter:\s*brightness\(\.42\)/);
  assert.match(cssRule(css, ".intro-overlay.dialogue-mode::after"), /backdrop-filter:\s*blur\(5px\)/);
  assert.match(gameJs, /INTRO_NARRATION/);
  assert.match(gameJs, /INTRO_DIALOGUE/);
  assert.match(gameJs, /INTRO_NARRATION\.forEach/);
  assert.match(gameJs, /setTimeout\(\(\)\s*=>\s*showNarration\(\),\s*2000\)/);
  assert.match(gameJs, /advanceIntro/);
});

test("승리와 패배 결과 오버레이는 각각의 결과 이미지를 함께 보여준다", () => {
  const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
  const gameJs = readFileSync(fileURLToPath(new URL("./game.js", import.meta.url)), "utf8");

  assert.equal(existsSync(fileURLToPath(new URL(ART_ASSETS.endings.success, import.meta.url))), true);
  assert.equal(existsSync(fileURLToPath(new URL(ART_ASSETS.endings.failure, import.meta.url))), true);
  assert.match(gameJs, /class="result-frame"/);
  assert.match(gameJs, /class="result-message"/);
  assert.equal(gameJs.includes('class="result-stat"'), false);
  assert.equal(gameJs.includes("도달 턴"), false);
  assert.match(gameJs, /ART_ASSETS\.endings\.success/);
  assert.match(gameJs, /ART_ASSETS\.endings\.failure/);
  assert.match(gameJs, /modal\.classList\.add\("result-modal"\)/);
  assert.match(cssRule(css, ".modal.result-modal"), /overflow:\s*hidden/);
  const resultModalRule = cssRule(css, ".modal.result-modal .modal-card");
  assert.match(resultModalRule, /overflow:\s*hidden/);
  assert.match(resultModalRule, /text-align:\s*center/);
  assert.match(cssRule(css, ".result-frame"), /width:\s*100%/);
  assert.match(cssRule(css, ".result-frame"), /image-rendering:\s*pixelated/);
  assert.match(cssRule(css, ".result-message"), /font-size:\s*67%/);
});

test("대화 후 클릭으로 넘기는 3페이지 튜토리얼을 보여준다", () => {
  const html = readFileSync(fileURLToPath(new URL("./index.html", import.meta.url)), "utf8");
  const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
  const gameJs = readFileSync(fileURLToPath(new URL("./game.js", import.meta.url)), "utf8");

  for (const assetPath of Object.values(ART_ASSETS.tutorial)) {
    assert.equal(existsSync(fileURLToPath(new URL(assetPath, import.meta.url))), true, assetPath);
  }
  assert.match(html, /id="tutorial-overlay"/);
  assert.match(html, /id="tutorial-image"/);
  assert.match(html, /id="tutorial-page"/);
  assert.match(cssRule(css, ".tutorial-overlay"), /backdrop-filter:\s*blur\(8px\)/);
  assert.match(cssRule(css, ".tutorial-card"), /grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s+minmax\(320px,\s*\.75fr\)/);
  assert.match(cssRule(css, ".tutorial-image"), /object-fit:\s*cover/);
  assert.match(cssRule(css, ".tutorial-copy h2"), /font-size:\s*clamp\(21px,\s*2vw,\s*31px\)/);
  assert.match(cssRule(css, ".tutorial-body"), /font-size:\s*clamp\(13px,\s*1\.15vw,\s*17px\)/);
  assert.match(cssRule(css, ".event-card strong"), /font-size:\s*15px/);
  assert.match(cssRule(css, ".event-card span"), /line-height:\s*1\.15/);
  assert.match(gameJs, /TUTORIAL_PAGES/);
  assert.match(gameJs, /startTutorial/);
  assert.match(gameJs, /advanceTutorial/);
  assert.match(gameJs, /tutorialIndex\s*<\s*TUTORIAL_PAGES\.length/);
  assert.match(gameJs, /title:\s*"마력로 반응"/);
  assert.doesNotMatch(gameJs, /title:\s*"[^"]+\s+[123]\/3"/);
  assert.match(gameJs, /같은 재질 블럭이 2×2로 모이면/);
});

test("전선은 왼쪽과 오른쪽 두 방향만 사용한다", () => {
  assert.deepEqual(DIRECTIONS, ["left", "right"]);
  assert.deepEqual(Object.keys(new GameState(7).lanes), ["left", "right"]);
});

test("재질 확률 경계는 나무 90%, 돌 9%, 철 1%다", () => {
  const game = new GameState(8);
  game.rng = () => 0.8999;
  assert.equal(game.weightedMaterial(), "wood");
  game.rng = () => 0.9;
  assert.equal(game.weightedMaterial(), "stone");
  game.rng = () => 0.9899;
  assert.equal(game.weightedMaterial(), "stone");
  game.rng = () => 0.99;
  assert.equal(game.weightedMaterial(), "iron");
});

test("스테이지 클리어 턴과 주요 난이도 수치는 밸런스 데이터에서 읽는다", () => {
  const game = new GameState(9);

  assert.equal(GAME_BALANCE.stage.clearTurn, 30);
  assert.equal(game.maxTurns, GAME_BALANCE.stage.clearTurn);
  assert.equal(game.castleHp, GAME_BALANCE.stage.initialCastleHp);
  assert.equal(game.rotations, GAME_BALANCE.stage.initialRotations);
  assert.equal(game.hand.length, GAME_BALANCE.stage.handSize);
  assert.equal(game.preview.length, GAME_BALANCE.stage.previewTurns);
  assert.equal(game.spawnCount(30), 3);
});

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
  const card = { shape: "I", material: "wood", direction: "left", rotation: 0 };
  const placement = game.getPlacement(card, 0);
  assert.deepEqual(placement.map(({ depth }) => depth), [9, 9, 9, 9]);
});

test("2x2 나무 합성은 바깥쪽 줄의 돌 2칸을 만든다", () => {
  const game = new GameState(2);
  const lane = game.lanes.left;
  for (const depth of [3, 4]) for (const col of [1, 2]) lane.blocks[depth][col] = { material: "wood", hp: 2, maxHp: 2 };
  const count = game.mergeLane("left");
  assert.equal(count, 1);
  assert.equal(game.mergeProgress, 1);
  assert.equal(lane.blocks[4][1]?.material, "stone");
  assert.equal(lane.blocks[4][2]?.material, "stone");
  const stoneCells = [];
  for (let depth = 0; depth < GAME_BALANCE.lanes.defenseDepth; depth += 1) {
    for (let col = 0; col < GAME_BALANCE.lanes.width; col += 1) {
      if (lane.blocks[depth][col]?.material === "stone") stoneCells.push(`${depth}:${col}`);
    }
  }
  assert.deepEqual(stoneCells, ["4:1", "4:2"]);
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

test("30턴 행동을 마치고 성이 남아 있으면 승리한다", () => {
  const game = new GameState(4);
  game.turn = GAME_BALANCE.stage.clearTurn;
  game.castleHp = 99;
  game.preview[0] = [];
  Object.values(game.lanes).forEach((lane) => { lane.enemies = []; lane.queue.fill(0); });
  game.pass();
  assert.equal(game.status, "won");
});

test("같은 턴에 여러 적이 도달해도 성 HP는 음수가 되지 않는다", () => {
  const game = new GameState(6);
  game.castleHp = 1;
  game.lanes.left.enemies.push({ col: 0, depth: 0 }, { col: 1, depth: 0 });
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
