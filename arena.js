const byId = (id) => document.getElementById(id);
const canvas = byId("board");
const context = canvas.getContext("2d");
const newMatchButton = byId("new-match");
const sameSeedButton = byId("same-seed");
const openReplayButton = byId("open-replay");
const replayFile = byId("replay-file");
const modeSelect = byId("mode");
const slider = byId("scrubber");
const previousButton = byId("previous");
const nextButton = byId("next");
const playButton = byId("play");
const speedSelect = byId("speed");
const boardMessage = byId("board-message");
const notice = byId("notice");
const playerList = byId("players");

const cell = 60;
const palettes = [
  { body: "#43b98f", head: "#9af5ce" },
  { body: "#587ed7", head: "#a6c5ff" },
  { body: "#c87654", head: "#ffc49b" },
  { body: "#9965cf", head: "#e1b4ff" },
];
const directions = {
  NORTH: [0, -1, "↑ 上"],
  EAST: [1, 0, "→ 右"],
  SOUTH: [0, 1, "↓ 下"],
  WEST: [-1, 0, "← 左"],
};
const problemLabels = { ERROR: "策略报错", INVALID: "动作无效", TIMEOUT: "策略超时" };

let match = null;
let round = 0;
let timer = null;
let loading = false;

function center(position) {
  return [
    (position % match.columns + 0.5) * cell,
    (Math.floor(position / match.columns) + 0.5) * cell,
  ];
}

function drawGrid() {
  const columns = canvas.width / cell;
  const rows = canvas.height / cell;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      context.fillStyle = (row + column) % 2 ? "#282035" : "#2c233a";
      context.fillRect(column * cell, row * cell, cell, cell);
    }
  }

  context.beginPath();
  context.strokeStyle = "#3a2e4b";
  context.lineWidth = 1;
  for (let x = cell; x < canvas.width; x += cell) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, canvas.height);
  }
  for (let y = cell; y < canvas.height; y += cell) {
    context.moveTo(0, y + 0.5);
    context.lineTo(canvas.width, y + 0.5);
  }
  context.stroke();
}

function circle(x, y, radius, color) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function drawFruit(position) {
  const [x, y] = center(position);
  circle(x, y + 3, 10, "#ff7b91");
  circle(x - 3, y, 3, "#ffc3ce");
  context.beginPath();
  context.ellipse(x + 4, y - 8, 5, 2.5, -0.65, 0, Math.PI * 2);
  context.fillStyle = "#a0e8b1";
  context.fill();
}

function drawSnake(snake, index, action) {
  if (snake.length === 0) return;

  const palette = palettes[index];
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 30;
  context.strokeStyle = palette.body;
  context.beginPath();

  for (let segment = 1; segment < snake.length; segment++) {
    const [x, y] = center(snake[segment]);
    const [previousX, previousY] = center(snake[segment - 1]);
    if (Math.abs(previousX - x) + Math.abs(previousY - y) === cell) {
      context.moveTo(previousX, previousY);
      context.lineTo(x, y);
    }
  }
  context.stroke();
  for (const position of snake.slice(1)) {
    const [x, y] = center(position);
    circle(x, y, 15, palette.body);
  }

  const [x, y] = center(snake[0]);
  context.fillStyle = palette.head;
  context.beginPath();
  context.roundRect(x - 19, y - 19, 38, 38, 13);
  context.fill();

  const [dx, dy] = directions[action] ?? directions.EAST;
  for (const side of [-1, 1]) {
    circle(x + dx * 7 - dy * side * 6, y + dy * 7 + dx * side * 6, 2.7, "#242039");
  }
  context.fillStyle = "#242039";
  context.font = "bold 10px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index), x - dx * 6, y - dy * 6);
}

function renderPlayers(frame, finished) {
  const cards = frame.snakes.map((snake, index) => {
    const card = document.createElement("div");
    card.className = snake.length ? "player" : "player eliminated";
    card.style.setProperty("--snake", palettes[index].head);
    card.innerHTML = `
      <span class="player-badge">${index}</span>
      <div><strong></strong><small></small></div>
      <div class="player-stat"><b></b><span></span></div>
    `;

    const score = frame.scores[index] ?? 0;
    const place = 1 + frame.scores.filter((other) => (other ?? 0) > score).length;
    const eliminationRound = match.eliminatedAt[index];
    const hitWall = match.frames[eliminationRound]?.wallHits?.includes(index);
    card.querySelector("strong").textContent = match.players[index];
    const status = frame.statuses[index];
    const problem = Object.hasOwn(problemLabels, status) ? problemLabels[status] : null;
    card.querySelector("small").textContent = problem ??
      (snake.length ? directions[frame.actions[index]]?.[2] ?? "待出发" :
        `第 ${eliminationRound} 回合${hitWall ? "撞墙" : "淘汰"}`);
    card.querySelector("b").textContent = finished ? `第 ${place} 名` : `${snake.length} 格`;
    card.querySelector(".player-stat span").textContent = finished ? `${score} 分` : snake.length ? "在场" : "已出局";
    return card;
  });
  playerList.replaceChildren(...cards);
}

function showRound(nextRound) {
  round = nextRound;
  const frame = match.frames[round];
  const lastRound = match.frames.length - 1;
  const finished = round === lastRound;
  const alive = frame.snakes.filter((snake) => snake.length > 0).length;

  drawGrid();
  frame.food.forEach(drawFruit);
  frame.snakes.forEach((snake, index) => drawSnake(snake, index, frame.actions[index]));

  byId("round").textContent = String(round);
  byId("hunger").textContent = finished ? "—" : `${match.hungerRate - round % match.hungerRate} 步`;
  byId("alive").textContent = finished ? "对局结束" : `${alive} 条在场`;
  byId("timeline-text").textContent = `${round} / ${lastRound}`;
  slider.value = round;
  previousButton.disabled = round === 0;
  nextButton.disabled = finished;
  canvas.setAttribute("aria-label", `第 ${round} 回合，${alive} 条蛇在场，${frame.food.length} 个果实`);
  renderPlayers(frame, finished);
}

function pause() {
  clearInterval(timer);
  timer = null;
  playButton.textContent = "▶ 播放";
}

function play() {
  if (round === match.frames.length - 1) showRound(0);
  playButton.textContent = "Ⅱ 暂停";
  timer = setInterval(() => {
    showRound(round + 1);
    if (round === match.frames.length - 1) pause();
  }, 240 / Number(speedSelect.value));
}

function validateReplay(data) {
  const boardSize = (value) => Number.isInteger(value) && value > 0 && value * cell <= 4096;
  const seats = (values, valid) => Array.isArray(values) && values.length === palettes.length && values.every(valid);
  if (!data || !["walls", "kaggle"].includes(data.mode) ||
      !Number.isInteger(data.seed) || data.seed < 0 || data.seed >= 2 ** 32 ||
      !boardSize(data.rows) || !boardSize(data.columns) ||
      !Number.isInteger(data.hungerRate) || data.hungerRate <= 0 ||
      !seats(data.players, (name) => typeof name === "string") ||
      !Array.isArray(data.frames) || data.frames.length === 0) {
    throw new Error("回放缺少有效的对局信息。");
  }

  const boardPositions = (values) => Array.isArray(values) && values.every((position) =>
    Number.isInteger(position) && position >= 0 && position < data.rows * data.columns);
  for (const [index, frame] of data.frames.entries()) {
    if (!frame || !seats(frame.snakes, boardPositions) || !boardPositions(frame.food) ||
        !seats(frame.actions, (action) => action === null ||
          (typeof action === "string" && Object.hasOwn(directions, action))) ||
        !seats(frame.scores, (score) => score === null || Number.isFinite(score)) ||
        !seats(frame.statuses, (status) => typeof status === "string") ||
        (frame.wallHits !== undefined && (!Array.isArray(frame.wallHits) ||
          !frame.wallHits.every((seat) => Number.isInteger(seat) && seat >= 0 && seat < palettes.length)))) {
      throw new Error(`回放的第 ${index} 回合数据无效。`);
    }
  }
  return data;
}

async function loadMatch(readMatch, message, autoplay = false) {
  if (loading) return;
  loading = true;
  pause();
  newMatchButton.disabled = true;
  sameSeedButton.disabled = true;
  openReplayButton.disabled = true;
  modeSelect.disabled = true;
  slider.disabled = true;
  playButton.disabled = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  notice.hidden = true;
  boardMessage.hidden = false;
  boardMessage.textContent = message;

  try {
    match = await readMatch();
    match.eliminatedAt = match.players.map((_, index) =>
      match.frames.findIndex((frame) => frame.snakes[index].length === 0)
    );
    canvas.width = match.columns * cell;
    canvas.height = match.rows * cell;
    slider.max = match.frames.length - 1;
    byId("seed").textContent = match.seed;
    byId("board-size").textContent = `${match.columns} × ${match.rows}`;
    byId("boundary").textContent = match.mode === "walls" ? "撞墙淘汰" : "边界相通";
    canvas.parentElement.classList.toggle("walls", match.mode === "walls");
    byId("rule").textContent = `每 ${match.hungerRate} 回合缩短 1 格`;
    showRound(0);
    if (autoplay && match.frames.length > 1) play();
  } catch (error) {
    notice.textContent = error.message;
    notice.hidden = false;
  } finally {
    boardMessage.hidden = Boolean(match);
    boardMessage.textContent = "点击开始新局";
    loading = false;
    newMatchButton.disabled = false;
    sameSeedButton.disabled = !match;
    openReplayButton.disabled = false;
    modeSelect.disabled = false;
    if (match) {
      modeSelect.value = match.mode;
      slider.disabled = false;
      playButton.disabled = match.frames.length < 2;
      previousButton.disabled = round === 0;
      nextButton.disabled = round === match.frames.length - 1;
    }
  }
}

function startMatch(seed, autoplay) {
  return loadMatch(async () => {
    const response = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, mode: modeSelect.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "开局失败。");
    return result;
  }, "正在生成对局…", autoplay);
}

openReplayButton.addEventListener("click", () => replayFile.click());
replayFile.addEventListener("change", () => {
  const file = replayFile.files[0];
  replayFile.value = "";
  if (!file) return;
  loadMatch(async () => {
    const contents = await file.text();
    let data;
    try {
      data = JSON.parse(contents);
    } catch {
      throw new Error("无法读取回放，请选择实验场生成的 JSON 文件。");
    }
    return validateReplay(data);
  }, "正在读取回放…");
});

newMatchButton.addEventListener("click", () => startMatch(null, true));
sameSeedButton.addEventListener("click", () => startMatch(match.seed, true));
modeSelect.addEventListener("change", () => startMatch(match?.seed ?? null, false));
playButton.addEventListener("click", () => timer === null ? play() : pause());
previousButton.addEventListener("click", () => { pause(); showRound(round - 1); });
nextButton.addEventListener("click", () => { pause(); showRound(round + 1); });
slider.addEventListener("input", () => { pause(); showRound(Number(slider.value)); });
speedSelect.addEventListener("change", () => {
  if (timer !== null) {
    pause();
    play();
  }
});

drawGrid();
startMatch(null, false);
