/**
 * VALORANT マップ当てクイズ
 *
 * valorant-api.com から全マップを取得し、
 * ミニマップ画像を見てマップ名を4択で当てるクイズゲーム。
 */

const API_URL = 'https://valorant-api.com/v1/maps?language=ja-JP';
const TOTAL_QUESTIONS = 10;

// 競技マップ以外をスキップ（mapUrl に含まれるキーワード）
const SKIP_URLS = ['Range', 'HURM', 'Tutorial', 'Poveglia', 'Skirmish', 'Onboarding'];

/** @type {{ name: string, image: string }[]} */
let allMaps = [];

let questions     = [];
let currentIdx    = 0;
let score         = 0;
let selectedChoice = null;

// ============================================================
// データ取得
// ============================================================

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

// ============================================================
// クイズ生成
// ============================================================

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

// ============================================================
// 画面切り替え
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
// ランダムクロップ
// ============================================================

function applyRandomCrop(imgEl) {
  const scale = 2.5 + Math.random() * 0.5; // 2.5〜3倍ズーム
  const margin = 50 / scale;               // 端が切れないための余白
  const ox = margin + Math.random() * (100 - 2 * margin);
  const oy = margin + Math.random() * (100 - 2 * margin);
  imgEl.style.transformOrigin = `${ox}% ${oy}%`;
  imgEl.style.transform = `scale(${scale})`;
}

// ============================================================
// クイズ表示
// ============================================================

function showQuestion() {
  const q = questions[currentIdx];

  document.getElementById('q-progress').textContent =
    `${currentIdx + 1} / ${questions.length}`;
  document.getElementById('q-score').textContent = `${score}点`;

  const img = document.getElementById('map-image');
  img.style.transform = '';
  img.style.transformOrigin = '';
  img.onload = () => applyRandomCrop(img);
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
}

// ============================================================
// 選択処理
// ============================================================

function onSelect(name) {
  selectedChoice = name;
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent === name);
  });
  document.getElementById('btn-answer').disabled = false;
}

// ============================================================
// 回答処理
// ============================================================

function onAnswer(selected, correct) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correct) {
      btn.classList.add('correct');
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.add('wrong');
    }
  });

  if (selected === correct) score++;

  document.getElementById('btn-answer').classList.add('hidden');

  const btnNext = document.getElementById('btn-next');
  btnNext.textContent =
    currentIdx + 1 < questions.length ? '次の問題 →' : '結果を見る';
  btnNext.classList.add('visible');
}

// ============================================================
// 次の問題 / 結果
// ============================================================

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

// ============================================================
// ゲーム開始
// ============================================================

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

// ============================================================
// イベントリスナー
// ============================================================

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-next').addEventListener('click', nextQuestion);
document.getElementById('btn-answer').addEventListener('click', () => {
  if (selectedChoice !== null) {
    onAnswer(selectedChoice, questions[currentIdx].correct.name);
  }
});

// ============================================================
// 初期化
// ============================================================

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
