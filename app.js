const app = document.querySelector('#app');

const CARD_FACES = ['🐶', '🐱', '🐸', '🦊', '🐸', '🦊', '🐶', '🐱'];
const PHASES = ['choose', 'explain', 'try', 'repair', 'play', 'tip'];
const PHASE_LABELS = {
  choose: 'Choose',
  explain: 'Explain',
  try: 'Try',
  repair: 'Fix',
  retry: 'Fix',
  play: 'Play',
  tip: 'Tip',
  complete: 'Done',
};

const state = {
  screen: 'home',
  selectedGame: null,
  conversationId: sessionStorage.getItem('gameTeacherConversationId') || '',
  userId: sessionStorage.getItem('gameTeacherUserId') || crypto.randomUUID(),
  phase: 'choose',
  mode: 'required',
  loading: false,
  apiError: '',
  cards: CARD_FACES.map((face, index) => ({ id: index + 1, face, flipped: false, matched: false })),
  turn: 'jamie',
  repairSupport: null,
  messages: [],
};
sessionStorage.setItem('gameTeacherUserId', state.userId);

function render() {
  const statusText =
    state.mode === 'dify'
      ? 'Dify connected'
      : state.mode === 'error'
        ? 'Dify unavailable'
        : 'Dify required';

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>Teach Me a Game</h1>
          <p>Explain it your way. Jamie will try to play from what you actually say.</p>
        </div>
        <div class="status-pill ${state.mode === 'dify' ? 'live' : ''}">
          ${statusText}
        </div>
      </header>
      ${renderProgress()}
      ${state.screen === 'home' ? renderHome() : renderLesson()}
    </div>
  `;
  bindEvents();
}

function renderProgress() {
  const visiblePhase = state.phase === 'retry' ? 'repair' : state.phase;
  const currentIndex = Math.max(0, PHASES.indexOf(visiblePhase));

  return `
    <div class="progress">
      ${PHASES.map((phase, index) => `
        <div class="progress-step ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'done' : ''}">
          ${index + 1} · ${PHASE_LABELS[phase]}
        </div>
      `).join('')}
    </div>
  `;
}

function renderHome() {
  return `
    <section class="card home">
      <div class="eyebrow">Start with what you know</div>
      <h2>Which game could you teach a friend?</h2>
      <p>One lesson uses one game you already know. The same teaching loop can support different games; Matching Pairs is the first fully implemented path in this MVP.</p>

      <div class="game-grid">
        <button class="game-choice" data-game="matching_pairs">
          <span class="tag">Live</span>
          <div class="thumb memory-thumb">
            ${Array.from({ length: 8 }, () => '<span></span>').join('')}
          </div>
          <b>Matching Pairs</b>
          <small>Turn cards, check pairs, and explain what happens next.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb ttt-thumb">
            <span>X</span><span></span><span>O</span><span></span><span>X</span><span></span><span></span><span>O</span><span></span>
          </div>
          <b>Tic-Tac-Toe</b>
          <small>The same protocol can later drive a second game renderer.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb drop-thumb">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <b>Four in a Row</b>
          <small>A useful next path for testing hidden constraints.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb four-thumb">
            <span></span><span></span><span></span><span></span>
          </div>
          <b>Four Square</b>
          <small>A later active-game path with more special cases.</small>
        </button>
      </div>
    </section>
  `;
}

function renderLesson() {
  return `
    <section class="card lesson">
      <aside class="chat-pane">
        <div class="friend-header">
          <div class="avatar">🙂</div>
          <div>
            <b>Jamie</b>
            <small>Your friend · new to this game</small>
          </div>
        </div>

        <div class="chat-log" id="chatLog">
          ${state.messages.map(message => `
            <div class="message ${message.role === 'student' ? 'student' : 'ai'}">${escapeHtml(message.text)}</div>
          `).join('')}
        </div>

        <div class="composer">
          <textarea
            id="studentInput"
            placeholder="Tell Jamie what to do next…"
            ${state.loading || state.phase === 'complete' ? 'disabled' : ''}
          ></textarea>
          <button
            class="primary"
            id="sendButton"
            ${state.loading || state.phase === 'complete' ? 'disabled' : ''}
          >${state.loading ? '…' : 'Send'}</button>
        </div>
      </aside>

      <div class="game-pane">
        <div class="game-head">
          <div>
            <div class="eyebrow">Game world</div>
            <h3>Matching Pairs</h3>
            <p>Jamie only acts on rules the student has actually explained.</p>
          </div>
          <div class="phase-pill">${PHASE_LABELS[state.phase] || state.phase}</div>
        </div>

        <div class="board-wrap">
          ${state.phase === 'complete' ? renderComplete() : renderMemoryBoard()}
          ${state.repairSupport ? renderRepairPanel() : ''}
        </div>

        <div class="turn-strip">
          <span><b>Current turn:</b> ${state.turn === 'jamie' ? 'Jamie' : 'You'}</span>
          <button class="secondary" id="restartButton">Start over</button>
        </div>

        <div class="helper-text" aria-live="polite">
          <div>
            <strong>${state.apiError ? 'Dify API error' : 'What to notice'}</strong><br />
            <span>${state.apiError ? escapeHtml(state.apiError) : helperText()}</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMemoryBoard() {
  return `
    <div class="memory-board">
      ${state.cards.map(card => `
        <button
          class="memory-card ${card.flipped ? 'flipped' : ''} ${card.matched ? 'matched' : ''}"
          aria-label="Card ${card.id}"
          disabled
        >
          <span class="face back"></span>
          <span class="face front">${card.face}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderRepairPanel() {
  const steps = state.repairSupport.steps || [];
  return `
    <div class="repair-panel">
      <h4>${escapeHtml(state.repairSupport.prompt || 'Which step should Jamie change?')}</h4>
      <p>Point to the part that went wrong, then explain what Jamie should do instead.</p>
      <div class="repair-steps">
        ${steps.map((step, index) => `
          <button class="repair-step" data-repair-index="${index}">${escapeHtml(step)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderComplete() {
  return `
    <div class="complete-card">
      <div class="icon">🎉</div>
      <h3>Jamie can play!</h3>
      <p>Your explanation gave Jamie enough information to try the game, notice a gap, and use your repair to keep going.</p>
      <button class="primary" id="completeRestart">Teach again</button>
    </div>
  `;
}

function helperText() {
  switch (state.phase) {
    case 'explain':
      return 'Explain enough for Jamie to start. You do not need to list every rule at once.';
    case 'try':
      return 'Watch what Jamie does. Does the action match what you meant?';
    case 'repair':
      return 'If something is wrong, locate the part Jamie misunderstood and explain that part again.';
    case 'retry':
      return 'Now check whether your new explanation changes Jamie’s action.';
    case 'play':
      return 'Jamie can play more independently now. Add only the next rule that becomes useful.';
    case 'tip':
      return 'Rules help someone play. A strategy can help someone play better.';
    case 'complete':
      return 'The lesson ends when the friend can act on the explanation—not when every possible rule has been recited.';
    default:
      return 'Start from a game you already know.';
  }
}

function bindEvents() {
  document.querySelector('[data-game="matching_pairs"]')?.addEventListener('click', startMatchingPairs);
  document.querySelector('#sendButton')?.addEventListener('click', submitMessage);
  document.querySelector('#studentInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  });
  document.querySelector('#restartButton')?.addEventListener('click', restartLesson);
  document.querySelector('#completeRestart')?.addEventListener('click', restartLesson);
  document.querySelectorAll('[data-repair-index]').forEach(button => {
    button.addEventListener('click', () => chooseRepairStep(Number(button.dataset.repairIndex)));
  });

  requestAnimationFrame(() => {
    const log = document.querySelector('#chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  });
}

function startMatchingPairs() {
  state.screen = 'lesson';
  state.selectedGame = 'matching_pairs';
  state.phase = 'explain';
  state.turn = 'jamie';
  state.mode = 'required';
  state.apiError = '';
  state.conversationId = '';
  sessionStorage.removeItem('gameTeacherConversationId');
  state.cards = freshCards();
  state.repairSupport = null;
  state.messages = [
    { role: 'ai', text: "I've never played Matching Pairs before. Can you teach me?" },
  ];
  render();
  document.querySelector('#studentInput')?.focus();
}

function restartLesson() {
  state.screen = 'home';
  state.selectedGame = null;
  state.phase = 'choose';
  state.turn = 'jamie';
  state.mode = 'required';
  state.apiError = '';
  state.conversationId = '';
  state.repairSupport = null;
  state.messages = [];
  state.cards = freshCards();
  sessionStorage.removeItem('gameTeacherConversationId');
  render();
}

async function submitMessage() {
  if (state.loading || state.phase === 'complete') return;

  const input = document.querySelector('#studentInput');
  const message = input?.value.trim();
  if (!message) return;

  state.messages.push({ role: 'student', text: message });
  state.loading = true;
  state.apiError = '';
  state.repairSupport = null;
  render();

  let result;
  try {
    result = await sendToDify(message);
    state.mode = 'dify';
  } catch (error) {
    state.loading = false;
    state.mode = 'error';
    state.apiError = formatDifyError(error);
    console.error('Dify request failed.', error);
    render();
    return;
  }

  state.loading = false;

  if (result.conversationId) {
    state.conversationId = result.conversationId;
    sessionStorage.setItem('gameTeacherConversationId', result.conversationId);
  }

  state.phase = result.phase || state.phase;
  if (result.reply) state.messages.push({ role: 'ai', text: result.reply });

  await applyAction(
    result.ui_action || { type: 'none', payload: {} },
    result.support || null,
  );

  render();
}

async function sendToDify(message) {
  let response;

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        gameId: state.selectedGame,
        conversationId: state.conversationId,
        userId: state.userId,
      }),
    });
  } catch (cause) {
    const error = new Error('The /api/chat endpoint could not be reached.');
    error.code = 'NETWORK';
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;

    try {
      const parsed = JSON.parse(raw);
      detail = parsed.detail || parsed.error || raw;
    } catch {
      // Keep the raw response body.
    }

    const error = new Error(String(detail || `HTTP ${response.status}`));
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();

  if (!payload || typeof payload !== 'object') {
    const error = new Error('The Dify proxy returned an invalid response.');
    error.code = 'INVALID_RESPONSE';
    throw error;
  }

  return payload;
}

function formatDifyError(error) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (error?.status === 503 || /DIFY_API_KEY/i.test(message)) {
    return 'Dify is not configured. Add DIFY_API_KEY to .env.local (or your Vercel environment) and run the app through Vercel.';
  }

  if (error?.status === 404 || /\/api\/chat.*not.*reach/i.test(message)) {
    return 'The Dify API proxy is not available. Run this project with `npx vercel dev` locally, or deploy it to Vercel.';
  }

  if (error?.code === 'NETWORK') {
    return 'The Dify API proxy could not be reached. Check that the local Vercel server is running.';
  }

  return `Could not reach Dify: ${message}`;
}

async function applyAction(action, support) {
  const type = action?.type || 'none';
  const payload = action?.payload || {};

  if (support?.type === 'locate_step') {
    state.repairSupport = support;
  }

  switch (type) {
    case 'setup_cards':
      state.cards = freshCards();
      break;

    case 'flip_cards':
      flipCards(payload.cards || []);
      if (!payload.keep_face_up) {
        await wait(900);
        unflipCards(payload.cards || []);
      }
      break;

    case 'flip_two_then_flip_back':
      flipCards(payload.cards || []);
      render();
      await wait(1000);
      unflipCards(payload.cards || []);
      break;

    case 'flip_back':
      unflipCards(payload.cards || []);
      break;

    case 'retry_turn':
      flipCards(payload.cards || []);
      render();
      await wait(950);
      if (payload.turn_back_after) unflipCards(payload.cards || []);
      break;

    case 'switch_turn':
      state.turn = payload.to === 'student' ? 'student' : 'jamie';
      break;

    case 'show_repair_steps':
      state.repairSupport = payload;
      break;

    case 'preview_match':
      flipCards(payload.cards || []);
      break;

    case 'complete_play':
      state.turn = 'student';
      break;

    case 'lesson_complete':
      state.phase = 'complete';
      state.repairSupport = null;
      break;

    default:
      break;
  }
}

function chooseRepairStep(index) {
  const step = state.repairSupport?.steps?.[index];
  if (!step) return;

  state.repairSupport = null;
  state.messages.push({ role: 'student', text: `I think this step went wrong: ${step}` });
  state.messages.push({ role: 'ai', text: 'Okay—tell me what I should do instead.' });
  render();
  document.querySelector('#studentInput')?.focus();
}

function flipCards(ids) {
  ids.forEach(id => {
    const card = state.cards.find(card => card.id === Number(id));
    if (card) card.flipped = true;
  });
}

function unflipCards(ids) {
  ids.forEach(id => {
    const card = state.cards.find(card => card.id === Number(id));
    if (card && !card.matched) card.flipped = false;
  });
}

function freshCards() {
  return CARD_FACES.map((face, index) => ({
    id: index + 1,
    face,
    flipped: false,
    matched: false,
  }));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

render();
