const API_URL = 'https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=ja-JP';
const TOTAL_QUESTIONS = 10;

let allAbilities = [];
let allAgentNames = [];

let questions      = [];
let currentIdx     = 0;
let score          = 0;
let selectedChoice = null;

async function loadAbilities() {
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

  const abilities = [];
  const agentNames = [];

  for (const agent of json.data) {
    if (!agent.role) continue;
    agentNames.push(agent.displayName);

    for (const ability of agent.abilities) {
      if (!ability.displayIcon) continue;
      abilities.push({
        agentName:   agent.displayName,
        abilityName: ability.displayName,
        image:       ability.displayIcon,
      });
    }
  }

  allAgentNames = agentNames;
  return abilities;
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

function createQuestion(ability) {
  const sameAgent = allAbilities.filter(
    a => a.agentName === ability.agentName && a.abilityName !== ability.abilityName
  );
  let wrongs = pickRandom(sameAgent, 3).map(a => a.abilityName);

  if (wrongs.length < 3) {
    const others = allAbilities.filter(
      a => a.agentName !== ability.agentName && !wrongs.includes(a.abilityName)
    );
    wrongs = [...wrongs, ...pickRandom(others, 3 - wrongs.length).map(a => a.abilityName)];
  }

  return {
    correct: ability,
    choices: shuffle([ability.abilityName, ...wrongs]),
  };
}

function buildQuestions() {
  const picked = pickRandom(allAbilities, TOTAL_QUESTIONS);
  return picked.map(ability => createQuestion(ability));
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showQuestion() {
  const q = questions[currentIdx];

  document.getElementById('q-progress').textContent =
    `${currentIdx + 1} / ${TOTAL_QUESTIONS}`;
  document.getElementById('q-score').textContent = `${score}点`;

  const img = document.getElementById('ability-image');
  img.src = q.correct.image;
  img.alt = q.correct.abilityName;

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  q.choices.forEach(abilityName => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = abilityName;
    btn.addEventListener('click', () => onSelect(abilityName));
    choicesEl.appendChild(btn);
  });

  selectedChoice = null;
  const btnAnswer = document.getElementById('btn-answer');
  btnAnswer.disabled = true;
  btnAnswer.classList.remove('hidden');
  document.getElementById('btn-next').classList.remove('visible');
  document.getElementById('feedback').className = 'feedback';
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
    btn.classList.remove('selected');
    if (btn.textContent === correct) {
      btn.classList.add('correct');
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.add('wrong');
    }
  });

  const isCorrect = selected === correct;
  if (isCorrect) score++;

  document.getElementById('q-score').textContent = `${score}点`;

  const feedback = document.getElementById('feedback');
  if (isCorrect) {
    feedback.textContent = `✓ 正解！（${questions[currentIdx].correct.agentName}）`;
    feedback.className = 'feedback correct';
  } else {
    feedback.textContent = `✗ 不正解… 正解は「${correct}」（${questions[currentIdx].correct.agentName}）`;
    feedback.className = 'feedback wrong';
  }

  document.getElementById('btn-answer').classList.add('hidden');

  const btnNext = document.getElementById('btn-next');
  btnNext.textContent =
    currentIdx + 1 < TOTAL_QUESTIONS ? '次の問題 →' : '結果を見る';
  btnNext.classList.add('visible');
}

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

  const pct = score / TOTAL_QUESTIONS;
  const messages = [
    [1.0, 'パーフェクト！アビリティ博士👑'],
    [0.8, 'すごい！かなりのエージェント知識だ👏'],
    [0.6, 'なかなかやるね！もう一回挑戦してみよう'],
    [0.4, 'まだまだこれから。もっとエージェントを研究しよう'],
    [0,   'エージェントを使いこなせてる？'],
  ];
  const msg = messages.find(([t]) => pct >= t)?.[1] ?? '';
  document.getElementById('result-msg').textContent = msg;

  showScreen('screen-result');
}

function startGame() {
  questions  = buildQuestions();
  currentIdx = 0;
  score      = 0;
  showScreen('screen-quiz');
  showQuestion();
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);
document.getElementById('btn-next').addEventListener('click', nextQuestion);
document.getElementById('btn-answer').addEventListener('click', () => {
  if (selectedChoice !== null) {
    onAnswer(selectedChoice, questions[currentIdx].correct.abilityName);
  }
});

(async () => {
  try {
    allAbilities = await loadAbilities();
    showScreen('screen-start');
  } catch (e) {
    console.error('Failed to load abilities:', e);
    document.getElementById('screen-loading').innerHTML = `
      <p style="color:#ff4655">⚠️ データの読み込みに失敗しました</p>
      <p style="color:#7a8a99;margin-top:8px;font-size:.85rem">インターネット接続を確認してください</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 28px;background:#ff4655;color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer">再試行</button>
    `;
  }
})();
