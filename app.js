const app = document.querySelector('#app');

const CARD_FACES = ['🐶', '🐱', '🐸', '🦊', '🐸', '🦊', '🐶', '🐱'];
const PHASES = ['choose', 'explain', 'try', 'repair', 'play', 'tip'];
const PHASE_LABELS = {
  choose: 'Choose',
  explain: 'Explain',
  try: 'Try',
  repair: 'Fix',
  play: 'Play',
  tip: 'Tip',
  complete: 'Done',
};

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

const state = {
  screen: 'home',
  selectedGame: null,
  conversationId: sessionStorage.getItem('gameTeacherConversationId') || '',
  userId: sessionStorage.getItem('gameTeacherUserId') || crypto.randomUUID(),
  phase: 'choose',
  mode: 'required',
  loading: false,
  apiError: '',
  inputDraft: '',
  listening: false,
  voiceSupported: Boolean(SpeechRecognitionCtor),
  cards: CARD_FACES.map((face, index) => ({
    id: index + 1,
    face,
    flipped: false,
    matched: false,
  })),
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
          <p>Explain it naturally. Jamie will act only on what you actually teach.</p>
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
  const currentIndex = Math.max(0, PHASES.indexOf(state.phase));
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
      <p>Matching Pairs is the live prototype. Jamie does not use a hidden rulebook: the rules for this session come from you.</p>

      <div class="game-grid">
        <button class="game-choice" data-game="matching_pairs">
          <span class="tag">Live</span>
          <div class="thumb memory-thumb">
            ${Array.from({ length: 8 }, () => '<span></span>').join('')}
          </div>
          <b>Matching Pairs</b>
          <small>Teach Jamie what to do, one idea at a time or all at once.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb ttt-thumb">
            <span>X</span><span></span><span>O</span><span></span><span>X</span><span></span><span></span><span>O</span><span></span>
          </div>
          <b>Tic-Tac-Toe</b>
          <small>A later renderer can reuse the same listener + repair loop.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb drop-thumb">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <b>Four in a Row</b>
          <small>A later path for testing different game states.</small>
        </button>

        <button class="game-choice" disabled>
          <span class="tag">Next</span>
          <div class="thumb four-thumb">
            <span></span><span></span><span></span><span></span>
          </div>
          <b>Four Square</b>
          <small>A later active-game path with more physical rules.</small>
        </button>
      </div>
    </section>
  `;
}

function renderLesson() {
  const voiceLabel = state.listening ? 'Listening…' : '🎙️ Speak';
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
          >${escapeHtml(state.inputDraft)}</textarea>

          <button
            class="secondary"
            id="micButton"
            title="${state.voiceSupported ? 'Speak instead of typing' : 'Speech recognition is not supported in this browser'}"
            ${!state.voiceSupported || state.loading || state.phase === 'complete' ? 'disabled' : ''}
          >${voiceLabel}</button>

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
            <p>Actions happen one physical step at a time. Jamie only uses rules you have taught.</p>
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
      <p>Point to the part that did not match what you meant. Then tell Jamie what to do instead.</p>
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
      <h3>Jamie can play your version!</h3>
      <p>Your explanation changed what Jamie understood and what Jamie actually did.</p>
      <button class="primary" id="completeRestart">Teach again</button>
    </div>
  `;
}

function helperText() {
  switch (state.phase) {
    case 'explain':
      return 'Explain it your way. Jamie will start as soon as there is enough information to act.';
    case 'try':
      return 'Watch each action. Does Jamie’s behavior match what you meant?';
    case 'repair':
      return 'If Jamie misunderstood, locate the specific step and explain that part again.';
    case 'play':
      return 'Jamie can reuse rules you already taught as new game states appear.';
    case 'tip':
      return 'Jamie can play now. Share one idea that would help a friend play better.';
    case 'complete':
      return 'The goal is not an official rulebook—it is whether another person can act on your explanation.';
    default:
      return 'Start from a game you already know.';
  }
}

function bindEvents() {
  document.querySelector('[data-game="matching_pairs"]')?.addEventListener('click', startMatchingPairs);
  document.querySelector('#sendButton')?.addEventListener('click', () => submitMessage());
  document.querySelector('#micButton')?.addEventListener('click', toggleVoiceInput);
  document.querySelector('#studentInput')?.addEventListener('input', event => {
    state.inputDraft = event.currentTarget.value;
  });
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
  stopRecognition();
  state.screen = 'lesson';
  state.selectedGame = 'matching_pairs';
  state.phase = 'explain';
  state.turn = 'jamie';
  state.mode = 'required';
  state.apiError = '';
  state.inputDraft = '';
  state.conversationId = '';
  state.cards = freshCards();
  state.repairSupport = null;
  state.messages = [
    { role: 'ai', text: "I've never played Matching Pairs before. Can you teach me?" },
  ];
  sessionStorage.removeItem('gameTeacherConversationId');
  render();
  document.querySelector('#studentInput')?.focus();
}

function restartLesson() {
  stopRecognition();
  state.screen = 'home';
  state.selectedGame = null;
  state.phase = 'choose';
  state.turn = 'jamie';
  state.mode = 'required';
  state.apiError = '';
  state.inputDraft = '';
  state.conversationId = '';
  state.repairSupport = null;
  state.messages = [];
  state.cards = freshCards();
  sessionStorage.removeItem('gameTeacherConversationId');
  render();
}

async function submitMessage(overrideMessage = '') {
  if (state.loading || state.phase === 'complete') return;

  const input = document.querySelector('#studentInput');
  const message = (overrideMessage || input?.value || state.inputDraft).trim();
  if (!message) return;

  stopRecognition();
  state.messages.push({ role: 'student', text: message });
  state.inputDraft = '';
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
    return 'Dify is not configured. Load DIFY_API_KEY into the environment running `vercel dev`.';
  }

  if (
    error?.status === 501 ||
    /Unsupported method.*POST/i.test(message)
  ) {
    return 'This page is being served by a static server. Run it through `npx vercel dev` so POST /api/chat reaches the Vercel function.';
  }

  if (error?.status === 404 || /\/api\/chat.*not.*reach/i.test(message)) {
    return 'The Dify API proxy is not available. Run this project with `npx vercel dev`, or deploy it to Vercel.';
  }

  if (error?.code === 'NETWORK') {
    return 'The Dify API proxy could not be reached. Check that the local Vercel server is running.';
  }

  return `Could not reach Dify: ${message}`;
}

async function applyAction(action, support) {
  state.repairSupport = support?.type === 'locate_step' ? support : null;

  if (action?.type === 'action_sequence') {
    await runActionSequence(action.payload?.actions || []);
    return;
  }

  // Keep a small compatibility layer for older published flows.
  const payload = action?.payload || {};
  switch (action?.type || 'none') {
    case 'flip_cards':
      for (const id of payload.cards || []) {
        await applyAtomicAction({ type: 'reveal_card', card: id });
      }
      break;
    case 'flip_back':
      await applyAtomicAction({ type: 'hide_cards', cards: payload.cards || [] });
      break;
    case 'switch_turn':
      await applyAtomicAction({ type: 'set_turn', to: payload.to });
      break;
    case 'lesson_complete':
      state.phase = 'complete';
      break;
    default:
      break;
  }
}

async function runActionSequence(actions) {
  for (const action of actions) {
    await applyAtomicAction(action);
  }
}

async function applyAtomicAction(action) {
  switch (action?.type) {
    case 'reveal_card': {
      const card = state.cards.find(item => item.id === Number(action.card));
      if (card) card.flipped = true;
      render();
      await wait(650);
      break;
    }

    case 'hide_cards':
      unflipCards(action.cards || []);
      render();
      await wait(500);
      break;

    case 'leave_cards':
      render();
      await wait(400);
      break;

    case 'collect_cards':
      for (const id of action.cards || []) {
        const card = state.cards.find(item => item.id === Number(id));
        if (card) {
          card.flipped = true;
          card.matched = true;
        }
      }
      render();
      await wait(550);
      break;

    case 'set_turn':
      state.turn = action.to === 'student' ? 'student' : 'jamie';
      render();
      await wait(350);
      break;

    default:
      break;
  }
}

async function chooseRepairStep(index) {
  const step = state.repairSupport?.steps?.[index];
  if (!step || state.loading) return;

  state.repairSupport = null;
  await submitMessage(`The step I meant is wrong is: ${step}`);
}

function toggleVoiceInput() {
  if (!state.voiceSupported || state.loading || state.phase === 'complete') return;

  if (state.listening) {
    stopRecognition();
    render();
    return;
  }

  recognition = new SpeechRecognitionCtor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    state.listening = true;
    state.apiError = '';
    render();
  };

  recognition.onresult = event => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    state.inputDraft = transcript.trim();
    render();
    document.querySelector('#studentInput')?.focus();
  };

  recognition.onerror = event => {
    state.listening = false;
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      state.apiError = `Speech input error: ${event.error}`;
    }
    render();
  };

  recognition.onend = () => {
    state.listening = false;
    recognition = null;
    render();
    document.querySelector('#studentInput')?.focus();
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition) {
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // Ignore browsers that already ended the session.
    }
    recognition = null;
  }
  state.listening = false;
}

function unflipCards(ids) {
  for (const id of ids) {
    const card = state.cards.find(item => item.id === Number(id));
    if (card && !card.matched) card.flipped = false;
  }
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
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

render();
