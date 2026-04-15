const API_URL = 'https://valorant-api.com/v1/maps?language=ja-JP';
const TOTAL_QUESTIONS = 10;

const SKIP_URLS = ['Range', 'HURM', 'Tutorial', 'Poveglia', 'Skirmish', 'NPEV2'];

let allMaps = [];

let questions      = [];
let currentIdx     = 0;
let score          = 0;
let selectedChoice = null;
let cropOx = 50, cropOy = 50;

async function loadMaps() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(API_URL, { signal: controller.signal });
  } catch (e) {
    throw new Error('タイムアウトまたはネットワークエラー');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  return json.data
    .filter(map => {
      if (SKIP_URLS.some(kw => (map.mapUrl ?? '').includes(kw))) return false;
      if (!map.displayIcon && !map.splash) return false;
      return true;
    })
    .map(map => ({
      name:  map.displayName,
      image: map.displayIcon ?? map.splash,
    }));
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

function createQuestion(correctMap) {
  const others = allMaps.filter(m => m.name !== correctMap.name);
  const wrongs = pickRandom(others, 3);
  return {
    correct: correctMap,
    choices: shuffle([correctMap, ...wrongs]),
  };
}

function buildQuestions() {
  const count = Math.min(allMaps.length, TOTAL_QUESTIONS);
  const picked = pickRandom(allMaps, count);
  return picked.map(map => createQuestion(map));
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

const CROP_SCALE = 5;

function randCropWide() { return Math.random() * 100; }

function getDarkRatio(imgEl, ox, oy) {
  const W = imgEl.offsetWidth || 480;
  const H = imgEl.offsetHeight || 260;
  const visLeft = ox / 100 * W * (CROP_SCALE - 1) / CROP_SCALE;
  const visTop  = oy / 100 * H * (CROP_SCALE - 1) / CROP_SCALE;
  const visW = W / CROP_SCALE;
  const visH = H / CROP_SCALE;

  const nw = imgEl.naturalWidth;
  const nh = imgEl.naturalHeight;
  if (!nw || !nh) return -1;

  const dispScale = Math.max(W / nw, H / nh);
  const srcX = (visLeft + (nw * dispScale - W) / 2) / dispScale;
  const srcY = (visTop  + (nh * dispScale - H) / 2) / dispScale;
  const srcW = visW / dispScale;
  const srcH = visH / dispScale;

  try {
    const S = 12;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    let dark = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) continue;
      total++;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 30) dark++;
    }
    return total > 0 ? dark / total : 1;
  } catch (e) {
    return -1;
  }
}

function applyRandomCrop(imgEl) {
  const TRIES    = 20;
  const MAX_DARK = 0.7;

  let bestOx   = randCropWide();
  let bestOy   = randCropWide();
  let bestDark = Infinity;

  for (let i = 0; i < TRIES; i++) {
    const ox   = randCropWide();
    const oy   = randCropWide();
    const dark = getDarkRatio(imgEl, ox, oy);

    if (dark < 0) {
      bestOx = ox;
      bestOy = oy;
      break;
    }

    if (dark < bestDark) {
      bestDark = dark;
      bestOx = ox;
      bestOy = oy;
    }

    if (bestDark <= MAX_DARK) break;
  }

  cropOx = bestOx;
  cropOy = bestOy;
  imgEl.style.transition = '';
  imgEl.style.transformOrigin = `${cropOx}% ${cropOy}%`;
  imgEl.style.transform = `scale(${CROP_SCALE})`;
  imgEl.style.opacity = '1';
}

function showCropArea() {
  const img  = document.getElementById('map-image');
  const wrap = img.parentElement;

  img.style.transition = 'transform 0.45s ease';
  img.style.transform  = 'scale(1)';

  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  const visW    = W / CROP_SCALE;
  const visH    = H / CROP_SCALE;
  const visLeft = cropOx / 100 * W * (CROP_SCALE - 1) / CROP_SCALE;
  const visTop  = cropOy / 100 * H * (CROP_SCALE - 1) / CROP_SCALE;

  setTimeout(() => {
    const marker = document.getElementById('crop-marker');
    marker.style.left   = `${visLeft.toFixed(1)}px`;
    marker.style.top    = `${visTop.toFixed(1)}px`;
    marker.style.width  = `${visW.toFixed(1)}px`;
    marker.style.height = `${visH.toFixed(1)}px`;
    marker.classList.add('visible');
    img.style.transition = '';
  }, 450);
}

function showQuestion() {
  const q = questions[currentIdx];

  document.getElementById('q-progress').textContent =
    `${currentIdx + 1} / ${questions.length}`;
  document.getElementById('q-score').textContent = `${score}点`;

  const img = document.getElementById('map-image');
  img.style.opacity = '0';
  img.style.transform = '';
  img.style.transformOrigin = '';
  img.onload = () => applyRandomCrop(img);
  img.crossOrigin = 'anonymous';
  img.src = q.correct.image;
  img.alt = q.correct.name;
  if (img.complete) applyRandomCrop(img);

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  q.choices.forEach(map => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = map.name;
    btn.addEventListener('click', () => onSelect(map.name));
    choicesEl.appendChild(btn);
  });

  selectedChoice = null;
  const btnAnswer = document.getElementById('btn-answer');
  btnAnswer.disabled = true;
  btnAnswer.classList.remove('hidden');
  document.getElementById('btn-next').classList.remove('visible');
  document.getElementById('feedback').className = 'feedback';
  document.getElementById('crop-marker').classList.remove('visible');
}

function onSelect(name) {
  selectedChoice = name;
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === name);
  });
  document.getElementById('btn-answer').disabled = false;
}

function onAnswer(selected, correct) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correct) {
      btn.classList.add('correct');
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.add('wrong');
    }
  });

  const isCorrect = selected === correct;
  if (isCorrect) score++;

  const feedback = document.getElementById('feedback');
  if (isCorrect) {
    feedback.textContent = '✓ 正解！';
    feedback.className = 'feedback correct';
  } else {
    feedback.textContent = `✗ 不正解… 正解は「${correct}」`;
    feedback.className = 'feedback wrong';
  }

  document.getElementById('btn-answer').classList.add('hidden');
  showCropArea();

  const btnNext = document.getElementById('btn-next');
  btnNext.textContent =
    currentIdx + 1 < questions.length ? '次の問題 →' : '結果を見る';
  btnNext.classList.add('visible');
}

function nextQuestion() {
  currentIdx++;
  if (currentIdx < questions.length) {
    showQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const total = questions.length;
  document.getElementById('result-num').textContent   = score;
  document.getElementById('result-total').textContent = total;

  const pct = score / total;
  const messages = [
    [1.0, 'パーフェクト！マップ博士👑'],
    [0.8, 'すごい！かなりのマップ知識だ👏'],
    [0.6, 'なかなかやるね！もう一回挑戦してみよう'],
    [0.4, 'まだまだこれから。もっとマップを研究しよう'],
    [0,   'どこで戦ってたの…？'],
  ];
  const msg = messages.find(([t]) => pct >= t)?.[1] ?? '';
  document.getElementById('result-msg').textContent = msg;

  showScreen('screen-result');
}

function startGame() {
  questions  = buildQuestions();
  currentIdx = 0;
  score      = 0;

  const total = questions.length;
  document.getElementById('result-total').textContent = total;
  document.querySelectorAll('#total-q').forEach(el => el.textContent = total);

  showScreen('screen-quiz');
  showQuestion();
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-next').addEventListener('click', nextQuestion);
document.getElementById('btn-answer').addEventListener('click', () => {
  if (selectedChoice !== null) {
    onAnswer(selectedChoice, questions[currentIdx].correct.name);
  }
});

(async () => {
  try {
    allMaps = await loadMaps();
    const total = Math.min(allMaps.length, TOTAL_QUESTIONS);
    document.querySelectorAll('#total-q').forEach(el => el.textContent = total);
    showScreen('screen-start');
  } catch (e) {
    console.error('Failed to load maps:', e);
    document.getElementById('screen-loading').innerHTML = `
      <p style="color:#ff4655">⚠️ データの読み込みに失敗しました</p>
      <p style="color:#7a8a99;margin-top:8px;font-size:.85rem">インターネット接続を確認してください</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 28px;background:#ff4655;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer">再試行</button>
    `;
  }
})();
