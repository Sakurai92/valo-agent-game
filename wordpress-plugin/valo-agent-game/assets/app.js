/**
 * VALORANT エージェント当てゲーム — WordPress プラグイン用 JS
 *
 * valorant-api.com から全エージェントを取得し、
 * タップ/クリックで消去しながら絞り込むゲームボードを提供する。
 */

const API_URL =
  'https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=ja-JP';

const ROLE_ORDER = ['Duelist', 'Controller', 'Sentinel', 'Initiator'];

/** @type {{ uuid: string, displayName: string, displayIcon: string, role: string }[]} */
let agents = [];

/** 消去済みエージェントの UUID セット */
const eliminated = new Set();

/** 現在選択中のロールフィルター */
let currentFilter = 'all';

// ============================================================
// データ取得
// ============================================================

async function loadAgents() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  return json.data
    .filter(a => a.role)
    .sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role.displayName);
      const rb = ROLE_ORDER.indexOf(b.role.displayName);
      if (ra !== rb) return ra - rb;
      return a.displayName.localeCompare(b.displayName, 'ja');
    })
    .map(a => ({
      uuid:        a.uuid,
      displayName: a.displayName,
      displayIcon: a.displayIcon,
      role:        a.role.displayName,
    }));
}

// ============================================================
// レンダリング
// ============================================================

function getFiltered() {
  if (currentFilter === 'all') return agents;
  return agents.filter(a => a.role === currentFilter);
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const filtered = getFiltered();

  grid.innerHTML = '';

  filtered.forEach(agent => {
    const isElim = eliminated.has(agent.uuid);
    const card = document.createElement('div');
    card.className = 'agent-card' + (isElim ? ' eliminated' : '');
    card.dataset.uuid = agent.uuid;

    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          src="${agent.displayIcon}"
          alt="${agent.displayName}"
          loading="lazy"
          draggable="false"
        >
        <div class="elim-overlay"><span>✕</span></div>
      </div>
      <div class="card-name">${agent.displayName}</div>
    `;

    card.addEventListener('click', () => toggleCard(agent.uuid));
    grid.appendChild(card);
  });

  updateCounter();
}

// ============================================================
// カード操作
// ============================================================

function toggleCard(uuid) {
  if (eliminated.has(uuid)) {
    eliminated.delete(uuid);
  } else {
    eliminated.add(uuid);
  }

  const card = document.querySelector(`#valo-game-app .agent-card[data-uuid="${uuid}"]`);
  if (card) card.classList.toggle('eliminated');

  updateCounter();
}

// ============================================================
// カウンター
// ============================================================

function updateCounter() {
  const filtered  = getFiltered();
  const total     = filtered.length;
  const remaining = filtered.filter(a => !eliminated.has(a.uuid)).length;

  document.getElementById('count-num').textContent   = remaining;
  document.getElementById('count-total').textContent = total;
}

// ============================================================
// エラー表示
// ============================================================

function showError() {
  document.getElementById('grid').innerHTML = `
    <div class="vgame-error">
      <p>⚠️ エージェントデータの読み込みに失敗しました</p>
      <p>インターネット接続を確認してから再試行してください</p>
      <button onclick="valoGameInit()">再試行</button>
    </div>
  `;
}

// ============================================================
// 初期化
// ============================================================

async function valoGameInit() {
  document.getElementById('grid').innerHTML = `
    <div class="vgame-loading">
      <div class="vgame-spinner"></div>
      <p>エージェントデータを読み込み中…</p>
    </div>
  `;

  try {
    agents = await loadAgents();
    renderGrid();
  } catch (e) {
    console.error('Valo Agent Game: Failed to load agents:', e);
    showError();
  }
}

// ============================================================
// イベントリスナー（DOM 構築後に実行）
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ロールフィルター
  document.getElementById('role-filter').addEventListener('click', e => {
    const btn = e.target.closest('.vgame-filter-btn');
    if (!btn) return;

    document.querySelectorAll('#valo-game-app .vgame-filter-btn')
      .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.role;
    renderGrid();
  });

  // リセットボタン
  document.getElementById('reset-btn').addEventListener('click', () => {
    eliminated.clear();
    renderGrid();
  });

  valoGameInit();
});
