const GAME_DURATION = 60000;
const FEEDBACK_MS   = 350;

const SKIP_SKIN_KW = ['スタンダード', 'Standard', 'デフォルト', 'Default', 'ランダムお気に入りスキン', 'Random Favorite', '近接武器'];

let pool      = [];
let score     = 0;
let attempted = 0;
let startTime = 0;
let timerHandle = null;
let gameActive  = false;

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

async function loadPool() {
  const [agents, sprays, buddies, weapons, cards] = await Promise.all([
    fetchJSON('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=ja-JP'),
    fetchJSON('https://valorant-api.com/v1/sprays?language=ja-JP'),
    fetchJSON('https://valorant-api.com/v1/buddies?language=ja-JP'),
    fetchJSON('https://valorant-api.com/v1/weapons?language=ja-JP'),
    fetchJSON('https://valorant-api.com/v1/playercards?language=ja-JP'),
  ]);

  const items = [];

  const abilityItems = [];
  for (const agent of agents.data) {
    if (!agent.role) continue;
    for (const ab of agent.abilities) {
      if (!ab.displayIcon) continue;
      abilityItems.push({ image: ab.displayIcon, answer: ab.displayName });
    }
  }
  const abilityNames = abilityItems.map(i => i.answer);
  for (const item of abilityItems) {
    items.push({ ...item, label: 'スキル名は？', wrongPool: abilityNames });
  }

  const sprayItems = sprays.data
    .filter(s => s.displayName !== 'なし' && (s.animationGif || s.fullIcon || s.displayIcon))
    .map(s => ({ image: s.animationGif ?? s.fullIcon ?? s.displayIcon, answer: s.displayName }));
  const sprayNames = sprayItems.map(i => i.answer);
  for (const item of sprayItems) {
    items.push({ ...item, label: 'スプレー名は？', wrongPool: sprayNames });
  }

  const buddyItems = buddies.data
    .filter(b => b.displayIcon)
    .map(b => ({ image: b.displayIcon, answer: b.displayName }));
  const buddyNames = buddyItems.map(i => i.answer);
  for (const item of buddyItems) {
    items.push({ ...item, label: 'ガンバディ名は？', wrongPool: buddyNames });
  }

  const skinItems = [];
  for (const weapon of weapons.data) {
    for (const skin of weapon.skins) {
      if (SKIP_SKIN_KW.some(kw => skin.displayName.includes(kw))) continue;
      const img = skin.displayIcon ?? skin.levels?.[0]?.displayIcon;
      if (!img) continue;
      skinItems.push({ image: img, answer: skin.displayName });
    }
  }
  const skinNames = skinItems.map(i => i.answer);
  for (const item of skinItems) {
    items.push({ ...item, label: 'スキン名は？', wrongPool: skinNames });
  }

  const cardItems = cards.data
    .filter(c => c.largeArt || c.wideArt)
    .map(c => ({ image: c.animationGif ?? c.largeArt ?? c.wideArt, answer: c.displayName }));
  const cardNames = cardItems.map(i => i.answer);
  for (const item of cardItems) {
    items.push({ ...item, label: 'カード名は？', wrongPool: cardNames });
  }

  return items;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

function nextQuestion() {
  const item   = pool[Math.floor(Math.random() * pool.length)];
  const wrongs = pickRandom(item.wrongPool.filter(n => n !== item.answer), 3);
  const choices = shuffle([item.answer, ...wrongs]);

  document.getElementById('q-label').textContent = item.label;

  const img = document.getElementById('q-image');
  img.src = item.image;
  img.alt = item.answer;

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  choices.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => onAnswer(btn, name, item.answer));
    choicesEl.appendChild(btn);
  });
}

function onAnswer(btn, selected, correct) {
  if (!gameActive) return;

  document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  attempted++;
  const isCorrect = selected === correct;
  if (isCorrect) {
    score++;
    btn.classList.add('correct');
  } else {
    btn.classList.add('wrong');
    document.querySelectorAll('.choice-btn').forEach(b => {
      if (b.textContent === correct) b.classList.add('correct');
    });
  }

  document.getElementById('score').textContent = score;

  setTimeout(() => {
    if (gameActive) nextQuestion();
  }, FEEDBACK_MS);
}

function updateTimerColor(left) {
  const el = document.getElementById('timer-num');
  if (left <= 10) {
    el.style.color = '#ff4655';
    el.style.animation = left <= 5 ? 'pulse 0.5s ease infinite' : '';
  } else {
    el.style.color = '';
    el.style.animation = '';
  }
}

function startTimer() {
  startTime  = Date.now();
  gameActive = true;

  const bar = document.getElementById('timer-bar');
  bar.style.transition = `width ${GAME_DURATION / 1000}s linear`;
  // Force reflow
  bar.offsetWidth; // eslint-disable-line no-unused-expressions
  bar.style.width = '0%';

  timerHandle = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const left    = Math.max(0, Math.ceil((GAME_DURATION - elapsed) / 1000));
    document.getElementById('timer-num').textContent = left;
    updateTimerColor(left);

    if (elapsed >= GAME_DURATION) endGame();
  }, 100);
}

function endGame() {
  gameActive = false;
  clearInterval(timerHandle);

  document.getElementById('result-score').textContent    = score;
  document.getElementById('result-attempted').textContent = attempted;
  const pct = attempted > 0 ? Math.round(score / attempted * 100) : 0;
  document.getElementById('result-pct').textContent = pct;

  const messages = [
    [90, '神速！反射神経が違いすぎる👑'],
    [70, 'すごい！かなりの知識と速さだ👏'],
    [50, 'なかなかやるね！もう一回挑戦してみよう'],
    [0,  'まだまだこれから。たくさんプレイしよう'],
  ];
  const msg = messages.find(([t]) => pct >= t)?.[1] ?? '';
  document.getElementById('result-msg').textContent = msg;

  showScreen('screen-result');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame() {
  score     = 0;
  attempted = 0;
  document.getElementById('score').textContent    = '0';
  document.getElementById('timer-num').textContent = GAME_DURATION / 1000;
  updateTimerColor(GAME_DURATION / 1000);

  const bar = document.getElementById('timer-bar');
  bar.style.transition = 'none';
  bar.style.width = '100%';

  showScreen('screen-quiz');
  nextQuestion();
  startTimer();
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);

(async () => {
  try {
    pool = await loadPool();
    showScreen('screen-start');
  } catch (e) {
    console.error('Failed to load:', e);
    document.getElementById('screen-loading').innerHTML = `
      <p style="color:#ff4655">⚠️ データの読み込みに失敗しました</p>
      <p style="color:#7a8a99;margin-top:8px;font-size:.85rem">インターネット接続を確認してください</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 28px;background:#ff4655;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer">再試行</button>
    `;
  }
})();
