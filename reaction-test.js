const ROUNDS    = 5;
const MIN_DELAY = 1500; // ms
const MAX_DELAY = 4500; // ms

let results      = [];
let currentRound = 0;
let gameState    = 'idle';
let reactStart   = 0;
let waitTimer    = null;
let lastTapTime  = 0;

const gameScreen  = document.getElementById('screen-game');
const mainTextEl  = document.getElementById('game-main-text');
const subTextEl   = document.getElementById('game-sub-text');
const roundEl     = document.getElementById('game-round');

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setGameState(s) {
  gameState = s;
  gameScreen.className = 'screen active s-' + s;

  if (s === 'ready') {
    roundEl.textContent  = `${currentRound} / ${ROUNDS}`;
    mainTextEl.textContent = '準備して…';
    subTextEl.textContent  = '';
    setTimeout(() => setGameState('wait'), 1000);

  } else if (s === 'wait') {
    roundEl.textContent    = `${currentRound} / ${ROUNDS}`;
    mainTextEl.textContent = '';
    subTextEl.textContent  = '';
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    waitTimer = setTimeout(() => {
      setGameState('react');
      // 緑が実際に描画されたフレームの直後にタイマーをセット
      requestAnimationFrame(() => {
        reactStart = performance.now();
      });
    }, delay);

  } else if (s === 'react') {
    mainTextEl.textContent = 'タップ！';
    subTextEl.textContent  = '';

  } else if (s === 'early') {
    clearTimeout(waitTimer);
    mainTextEl.textContent = 'フライング！';
    subTextEl.textContent  = 'もう少し待って';
    setTimeout(() => setGameState('wait'), 1500);

  } else if (s === 'show') {
    const ms = results[results.length - 1];
    mainTextEl.textContent = ms + ' ms';
    subTextEl.textContent  = '';
    setTimeout(() => {
      if (currentRound < ROUNDS) {
        currentRound++;
        setGameState('ready');
      } else {
        showResult();
      }
    }, 900);
  }
}

function handleTap() {
  const now = performance.now();
  if (now - lastTapTime < 80) return; // debounce
  lastTapTime = now;

  if (gameState === 'react') {
    const ms = Math.round(now - reactStart);
    results.push(ms);
    setGameState('show');

  } else if (gameState === 'wait') {
    setGameState('early');

  } else if (gameState === 'ready' || gameState === 'show' || gameState === 'early') {
    // no-op during transitions
  }
}

function showResult() {
  const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
  document.getElementById('result-avg').textContent = avg;

  const listEl = document.getElementById('result-list');
  listEl.innerHTML = results.map((r, i) =>
    `<div class="result-item">
      <span class="r-label">第${i + 1}回</span>
      <span class="r-val">${r} ms</span>
    </div>`
  ).join('');

  const messages = [
    [150, 'プロ並みの反応速度！⚡'],
    [200, 'かなり速い！🔥'],
    [250, '平均より速め👍'],
    [300, '普通の反応速度'],
    [Infinity, 'もう少し練習が必要かも'],
  ];
  const msg = messages.find(([t]) => avg < t)?.[1] ?? '';
  document.getElementById('result-msg').textContent = msg;

  showScreen('screen-result');
}

function startGame() {
  results      = [];
  currentRound = 1;
  showScreen('screen-game');
  setGameState('ready');
}

// タップ検出（touchstart + mousedown 二重発火防止）
gameScreen.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleTap();
}, { passive: false });

gameScreen.addEventListener('mousedown', handleTap);

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
