/**
 * VALORANT スキン当てクイズ
 *
 * valorant-api.com から全武器スキンを取得し、
 * スキン画像を見てスキン名を4択で当てるクイズゲーム。
 * 同じ武器のスキンから4択を生成するため難易度が高め。
 */

const API_URL = 'https://valorant-api.com/v1/weapons?language=ja-JP';
const TOTAL_QUESTIONS = 10;

// スキップするスキン名のキーワード（デフォルトスキンなど）
const SKIP_KEYWORDS = ['スタンダード', 'Standard', 'デフォルト', 'Default'];

/** @type {{ name: string, image: string, weapon: string }[]} */
let allSkins = [];

// クイズ状態
let questions      = [];   // 今回のゲームの問題リスト
let currentIdx     = 0;    // 現在の問題インデックス
let score          = 0;    // 正解数
let selectedChoice = null; // 選択中の選択肢

// ============================================================
// データ取得
// ============================================================

async function loadSkins() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15秒でタイムアウト

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

  const skins = [];
  for (const weapon of json.data) {
    for (const skin of weapon.skins) {
      // デフォルトスキンをスキップ
      if (SKIP_KEYWORDS.some(kw => skin.displayName.includes(kw))) continue;

      // 画像を取得（displayIcon → levels[0].displayIcon の順で試みる）
      const image =
        skin.displayIcon ??
        skin.levels?.[0]?.displayIcon ??
        null;

      if (!image) continue;

      skins.push({
        name:   skin.displayName,
        image:  image,
        weapon: weapon.displayName,
      });
    }
  }
  return skins;
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

/**
 * 1問分のデータを生成する
 * 同じ武器のスキンから誤答を選ぶ（不足時は他武器から補充）
 */
function createQuestion(correctSkin) {
  // 同じ武器の他スキンを誤答候補にする
  const sameWeapon = allSkins.filter(
    s => s.weapon === correctSkin.weapon && s.name !== correctSkin.name
  );
  let wrongs = pickRandom(sameWeapon, 3);

  // 同武器のスキンが足りない場合は他武器から補充
  if (wrongs.length < 3) {
    const others = allSkins.filter(
      s => s.name !== correctSkin.name && !wrongs.includes(s)
    );
    wrongs = [...wrongs, ...pickRandom(others, 3 - wrongs.length)];
  }

  return {
    correct: correctSkin,
    choices: shuffle([correctSkin, ...wrongs]),
  };
}

function buildQuestions() {
  const picked = pickRandom(allSkins, TOTAL_QUESTIONS);
  return picked.map(skin => createQuestion(skin));
}

// ============================================================
// 画面切り替え
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
// クイズ表示
// ============================================================

function showQuestion() {
  const q = questions[currentIdx];

  // ヘッダー更新
  document.getElementById('q-progress').textContent =
    `${currentIdx + 1} / ${TOTAL_QUESTIONS}`;
  document.getElementById('q-score').textContent = `${score}点`;

  // 武器名・画像
  document.getElementById('weapon-name').textContent = q.correct.weapon;
  const img = document.getElementById('skin-image');
  img.src = q.correct.image;
  img.alt = q.correct.name;

  // 選択肢ボタンを生成
  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  q.choices.forEach(skin => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = skin.name;
    btn.addEventListener('click', () => onSelect(skin.name));
    choicesEl.appendChild(btn);
  });

  selectedChoice = null;
  const btnAnswer = document.getElementById('btn-answer');
  btnAnswer.disabled = true;
  btnAnswer.classList.remove('hidden');
  // 「次へ」ボタンを非表示にリセット
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
  // 全ボタンを無効化
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('selected');
    if (btn.textContent === correct) {
      btn.classList.add('correct');
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.add('wrong');
    }
  });

  if (selected === correct) score++;

  document.getElementById('btn-answer').classList.add('hidden');

  // 最終問題かどうかで「次へ」ボタンのテキストを変える
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent =
    currentIdx + 1 < TOTAL_QUESTIONS ? '次の問題 →' : '結果を見る';
  btnNext.classList.add('visible');
}

// ============================================================
// 次の問題 / 結果
// ============================================================

function nextQuestion() {
  currentIdx++;
  if (currentIdx < TOTAL_QUESTIONS) {
    showQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  document.getElementById('result-num').textContent = score;

  const messages = [
    [10, 'パーフェクト！スキン博士すぎる🏆'],
    [8,  'すごい！かなりのスキン知識だ👏'],
    [6,  'なかなかやるね！もう一回挑戦してみよう'],
    [4,  'まだまだこれから。スキンをもっと見てみよう'],
    [0,  'スキンを買ってもらうしかないね…'],
  ];
  const msg = messages.find(([threshold]) => score >= threshold)?.[1] ?? '';
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
    allSkins = await loadSkins();
    showScreen('screen-start');
  } catch (e) {
    console.error('Failed to load skins:', e);
    document.getElementById('screen-loading').innerHTML = `
      <p style="color:#ff4655">⚠️ データの読み込みに失敗しました</p>
      <p style="color:#7a8a99;margin-top:8px;font-size:.85rem">インターネット接続を確認してください</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 28px;background:#ff4655;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer">再試行</button>
    `;
  }
})();
