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
  mode: 'preview',
  loading: false,
  cards: CARD_FACES.map((face, index) => ({ id: index + 1, face, flipped: false, matched: false })),
  turn: 'jamie',
  repairSupport: null,
  messages: [],
  mock: {
    knowledge: new Set(),
    repairCount: 0,
  },
};
sessionStorage.setItem('gameTeacherUserId', state.userId);

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>Teach Me a Game</h1>
          <p>Explain it your way. Jamie will try to play from what you actually say.</p>
        </div>
        <div class="status-pill ${state.mode === 'dify' ? 'live' : ''}">
          ${state.mode === 'dify' ? 'Dify connected' : 'Local preview'}
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
          <textarea id="studentInput" placeholder="Tell Jamie what to do next…" ${state.loading || state.phase === 'complete' ? 'disabled' : ''}></textarea>
          <button class="primary" id="sendButton" ${state.loading || state.phase === 'complete' ? 'disabled' : ''}>${state.loading ? '…' : 'Send'}</button>
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

        <div class="helper-text">
          <div>
            <strong>What to notice</strong><br />
            <span>${helperText()}</span>
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
        <button class="memory-card ${card.flipped ? 'flipped' : ''} ${card.matched ? 'matched' : ''}" aria-label="Card ${card.id}" disabled>
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
    case 'explain': return 'Explain enough for Jamie to start. You do not need to list every rule at once.';
    case 'try': return 'Watch what Jamie does. Does the action match what you meant?';
    case 'repair': return 'If something is wrong, locate the part Jamie misunderstood and explain that part again.';
    case 'retry': return 'Now check whether your new explanation changes Jamie’s action.';
    case 'play': return 'Jamie can play more independently now. Add only the next rule that becomes useful.';
    case 'tip': return 'Rules help someone play. A strategy can help someone play better.';
    case 'complete': return 'The lesson ends when the friend can act on the explanation—not when every possible rule has been recited.';
    default: return 'Start from a game you already know.';
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
  state.conversationId = '';
  sessionStorage.removeItem('gameTeacherConversationId');
  state.cards = freshCards();
  state.repairSupport = null;
  state.mock.knowledge = new Set();
  state.mock.repairCount = 0;
  state.messages = [
    { role: 'ai', text: "I've never played Matching Pairs before. Can you teach me?" }
  ];
  render();
  document.querySelector('#studentInput')?.focus();
}

function restartLesson() {
  state.screen = 'home';
  state.selectedGame = null;
  state.phase = 'choose';
  state.turn = 'jamie';
  state.conversationId = '';
  state.repairSupport = null;
  state.messages = [];
  state.cards = freshCards();
  state.mock.knowledge = new Set();
  state.mock.repairCount = 0;
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
  state.repairSupport = null;
  render();

  let result;
  try {
    result = await sendToDify(message);
    state.mode = 'dify';
  } catch (error) {
    console.info('Dify unavailable; using local preview script.', error);
    result = mockTurn(message);
    state.mode = 'preview';
  }

  state.loading = false;
  if (result.conversationId) {
    state.conversationId = result.conversationId;
    sessionStorage.setItem('gameTeacherConversationId', result.conversationId);
  }

  state.phase = result.phase || state.phase;
  if (result.reply) state.messages.push({ role: 'ai', text: result.reply });
  await applyAction(result.ui_action || { type: 'none', payload: {} }, result.support || null);
  render();
}

async function sendToDify(message) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      gameId: state.selectedGame,
      conversationId: state.conversationId,
      userId: state.userId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Chat API ${response.status}: ${detail}`);
  }

  return response.json();
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
  return CARD_FACES.map((face, index) => ({ id: index + 1, face, flipped: false, matched: false }));
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

// This small fallback exists only so the repo is reviewable without Dify credentials.
// The production lesson logic belongs in the imported Dify Chatflow.
function mockTurn(message) {
  const m = message.toLowerCase();
  const K = state.mock.knowledge;
  const recognized = [];

  if (/face down|facedown|down first|cards.*down/.test(m)) recognized.push('setup.face_down');
  if (/flip|turn over|turn.*card/.test(m) && /(two|2)/.test(m)) recognized.push('turn.flip_two');
  if (/match|same/.test(m) && /(keep|take|pair)/.test(m)) recognized.push('result.match_keep');
  if (/(don.t match|do not match|different|not the same)/.test(m) && /(turn.*back|flip.*back|face down|put.*back)/.test(m)) recognized.push('result.no_match_flip_back');
  if (/your turn|my turn|other player|switch|take turns/.test(m)) recognized.push('turn.switch');
  if (/most pairs|more pairs|whoever.*pairs|win/.test(m)) recognized.push('goal.most_pairs');
  if (/remember|memory|where.*card/.test(m)) recognized.push('strategy.memory');
  recognized.forEach(rule => K.add(rule));

  const lowCorrection = /^(no+|no[,!. ]+that.s wrong|that.s wrong|don.t do that)[!., ]*$/i.test(message.trim());

  if (state.phase === 'explain') {
    if (!K.has('turn.flip_two')) {
      return {
        reply: K.has('setup.face_down') ? 'Okay, the cards start face down. What do I do on my turn?' : 'What do I do first?',
        phase: 'explain',
        ui_action: K.has('setup.face_down') ? { type: 'setup_cards', payload: { count: 8, face_down: true } } : { type: 'none', payload: {} },
      };
    }

    if (!K.has('result.no_match_flip_back')) {
      return {
        reply: "I flipped two cards. They don't match. What do I do with these now?",
        phase: 'repair',
        ui_action: { type: 'flip_cards', payload: { cards: [1, 6], match: false, keep_face_up: true } },
      };
    }

    return {
      reply: 'Okay—I flipped two different cards and turned them back over. What happens after my turn?',
      phase: 'try',
      ui_action: { type: 'flip_two_then_flip_back', payload: { cards: [1, 6], match: false } },
    };
  }

  if (state.phase === 'repair') {
    if (K.has('result.no_match_flip_back')) {
      state.mock.repairCount = 0;
      return {
        reply: "Oh! If they don't match, I turn both cards face down again. Let me fix that.",
        phase: 'retry',
        ui_action: { type: 'flip_back', payload: { cards: [1, 6] } },
      };
    }

    if (lowCorrection) {
      state.mock.repairCount += 1;
      if (state.mock.repairCount >= 2) {
        const support = {
          type: 'locate_step',
          prompt: 'Which step should Jamie change?',
          steps: ['Flip two cards', 'Check whether they match', 'Leave both cards face up', 'End the turn'],
        };
        return {
          reply: 'Can you point to the step I should change?',
          phase: 'repair',
          support,
          ui_action: { type: 'show_repair_steps', payload: support },
        };
      }
      return { reply: 'Which part did I get wrong?', phase: 'repair', ui_action: { type: 'none', payload: {} } };
    }

    return { reply: "What should I do with the two cards when they don't match?", phase: 'repair', ui_action: { type: 'none', payload: {} } };
  }

  if (state.phase === 'retry') {
    return {
      reply: "That worked! I flipped two, they didn't match, so I turned them back. Whose turn is it now?",
      phase: K.has('turn.switch') ? 'play' : 'try',
      ui_action: { type: 'retry_turn', payload: { cards: [2, 7], match: false, turn_back_after: true } },
    };
  }

  if (state.phase === 'try') {
    if (K.has('turn.switch')) {
      return { reply: "Got it—after my turn, it's your turn. What if the two cards are the same?", phase: 'play', ui_action: { type: 'switch_turn', payload: { to: 'student' } } };
    }
    return { reply: 'What happens after I finish my turn?', phase: 'try', ui_action: { type: 'none', payload: {} } };
  }

  if (state.phase === 'play') {
    if (!K.has('result.match_keep')) {
      return { reply: 'What if the two cards are the same?', phase: 'play', ui_action: { type: 'preview_match', payload: { cards: [3, 5], match: true } } };
    }
    if (!K.has('goal.most_pairs')) {
      return { reply: 'Okay, I keep matching pairs. How do we know who wins?', phase: 'play', ui_action: { type: 'none', payload: {} } };
    }
    return { reply: "I think I've got it! Do you have one tip that could help me play better?", phase: 'tip', ui_action: { type: 'complete_play', payload: {} } };
  }

  if (state.phase === 'tip') {
    return { reply: 'Thanks! I can play now. Your explanation helped me know what to do when the cards did not match.', phase: 'complete', ui_action: { type: 'lesson_complete', payload: {} } };
  }

  return { reply: 'Tell me what I should do next.', phase: state.phase, ui_action: { type: 'none', payload: {} } };
}

render();
