const app = document.querySelector('#app');

const PHASES = ['experience', 'notice', 'teach', 'practice', 'independent', 'transfer'];
const PHASE_LABELS = {
  experience: 'Try',
  notice: 'Notice',
  teach: 'Learn',
  practice: 'Practice',
  independent: 'Show',
  transfer: 'Transfer',
  complete: 'Done',
};

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function blankWorld() {
  return {
    name: 'Your game',
    surface: { type: 'table', rows: 0, columns: 0 },
    objects: [],
    counters: [],
    turn: null,
    status: 'Jamie is waiting for you to describe the game.',
    ready: false,
  };
}

const state = {
  screen: 'home',
  conversationId: sessionStorage.getItem('gameTeacherConversationId') || '',
  userId: sessionStorage.getItem('gameTeacherUserId') || crypto.randomUUID(),
  phase: 'experience',
  mode: 'required',
  loading: false,
  apiError: '',
  inputDraft: '',
  listening: false,
  voiceSupported: Boolean(SpeechRecognitionCtor),
  voiceMeta: null,
  world: blankWorld(),
  worldBaseline: null,
  support: null,
  messages: [],
};

sessionStorage.setItem('gameTeacherUserId', state.userId);

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <h1>Teach Me a Game</h1>
          <p>Your explanation builds the game Jamie understands.</p>
        </div>
        ${state.apiError ? '<div class="status-pill error">Connection issue</div>' : ''}
      </header>

      ${state.screen === 'lesson' ? renderProgress() : ''}
      ${state.screen === 'home' ? renderHome() : renderLesson()}
    </div>
  `;

  bindEvents();
}

function renderProgress() {
  const currentIndex = state.phase === 'complete'
    ? PHASES.length
    : Math.max(0, PHASES.indexOf(state.phase));

  return `
    <div class="progress" aria-label="Lesson progress">
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
    <section class="card home v6-home">
      <div class="eyebrow">A game you already know</div>
      <h2>Can you teach Jamie well enough to make the game playable?</h2>
      <p>Describe the game naturally. Jamie will build only the game world your explanation supports, then try to play it.</p>
      <button class="primary start-button" id="startButton">Start teaching</button>
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
            <small>${state.phase === 'independent' ? 'A fresh listener · knows none of your rules yet' : 'Your friend · learning from your explanation'}</small>
          </div>
        </div>

        <div class="chat-log" id="chatLog">
          ${state.messages.map(message => `
            <div class="message ${message.role === 'student' ? 'student' : message.role === 'action' ? 'action' : 'ai'}">${escapeHtml(message.text)}</div>
          `).join('')}
        </div>

        <div class="composer">
          <textarea
            id="studentInput"
            placeholder="Explain it to Jamie…"
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
            <div class="eyebrow">What Jamie understands</div>
            <h3>${escapeHtml(state.world.name || 'Your game')}</h3>
            <p>Visual details may be filled in. Game logic only comes from what you explain.</p>
          </div>
          <div class="phase-pill">${PHASE_LABELS[state.phase] || state.phase}</div>
        </div>

        <div class="world-shell">
          ${renderWorldStatus()}
          ${renderWorldSurface()}
          ${renderSupport()}
        </div>

        ${renderWorldFooter()}

        ${state.apiError ? `
          <div class="helper-text error-copy" aria-live="polite">
            <div><strong>API error</strong><br /><span>${escapeHtml(state.apiError)}</span></div>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}

function renderWorldStatus() {
  const readyLabel = state.world.ready ? 'Playable so far' : 'Still being built';
  return `
    <div class="world-status">
      <span class="world-ready ${state.world.ready ? 'ready' : ''}">${readyLabel}</span>
      <span>${escapeHtml(state.world.status || '')}</span>
    </div>
  `;
}

function renderWorldSurface() {
  const objects = state.world.objects || [];
  if (!objects.length) {
    return `
      <div class="empty-world">
        <div class="empty-world-mark">＋</div>
        <b>Nothing has been built yet.</b>
        <span>Start describing what your friend needs in order to play.</span>
      </div>
    `;
  }

  const surface = state.world.surface || { type: 'table' };
  const isGrid = surface.type === 'grid';
  const columns = clampNumber(surface.columns, 1, 8, isGrid ? 3 : 4);
  const rows = clampNumber(surface.rows, 0, 8, 0);
  const style = isGrid
    ? `--world-columns:${columns};${rows ? `--world-rows:${rows};` : ''}`
    : '';

  return `
    <div class="world-surface ${isGrid ? 'grid-surface' : 'table-surface'}" style="${style}">
      ${objects.map(renderWorldObject).join('')}
    </div>
  `;
}

function renderWorldObject(object) {
  const id = String(object.id || '');
  const kind = normalizeKind(object.kind);
  const objectState = String(object.state || 'available');
  const faceDown = objectState === 'face_down';
  const interactive = Boolean(object.interactive) && ['practice', 'independent'].includes(state.phase) && !state.loading;
  const symbol = faceDown ? '' : String(object.symbol || object.label || '');
  const title = String(object.label || object.symbol || object.id || 'Game object');
  const positionStyle = buildObjectPositionStyle(object);

  return `
    <button
      class="world-object kind-${kind} state-${escapeAttr(objectState)} ${interactive ? 'interactive' : ''}"
      data-world-object="${escapeAttr(id)}"
      style="${positionStyle}"
      aria-label="${escapeAttr(title)}"
      ${interactive ? '' : 'disabled'}
    >
      ${faceDown ? '<span class="object-back"></span>' : `<span class="object-symbol">${escapeHtml(symbol)}</span>`}
      ${object.caption ? `<small>${escapeHtml(object.caption)}</small>` : ''}
    </button>
  `;
}

function renderSupport() {
  if (!state.support) return '';

  if (state.support.type === 'teach_moment' || state.support.type === 'micro_teach') {
    const focus = String(state.support.focus || 'listener thinking');
    return `
      <section class="teach-panel">
        <div class="teach-kicker">${state.support.type === 'teach_moment' ? 'A quick idea' : 'One thing to try'}</div>
        <h4>${escapeHtml(state.support.headline || focus)}</h4>
        <p>${escapeHtml(state.support.principle || '')}</p>
        ${state.support.listener_gap ? `<div class="listener-gap"><b>Jamie still needs:</b> ${escapeHtml(state.support.listener_gap)}</div>` : ''}
        ${state.support.question ? `<div class="teach-question">${escapeHtml(state.support.question)}</div>` : ''}
      </section>
    `;
  }

  if (state.support.type === 'locate_step') {
    const steps = Array.isArray(state.support.steps) ? state.support.steps : [];
    return `
      <section class="repair-panel">
        <h4>${escapeHtml(state.support.prompt || 'Which part should change?')}</h4>
        <p>Choose the step that did not match what you meant.</p>
        <div class="repair-steps">
          ${steps.map((step, index) => `
            <button class="repair-step" data-repair-index="${index}">${escapeHtml(step)}</button>
          `).join('')}
        </div>
      </section>
    `;
  }

  return '';
}

function renderWorldFooter() {
  const counters = Array.isArray(state.world.counters) ? state.world.counters : [];
  return `
    <div class="world-footer">
      <div class="world-meta">
        ${state.world.turn ? `<span><b>Turn:</b> ${escapeHtml(state.world.turn)}</span>` : '<span>Build first, then play.</span>'}
        ${counters.map(counter => `<span><b>${escapeHtml(counter.label || counter.id)}:</b> ${escapeHtml(counter.value ?? 0)}</span>`).join('')}
      </div>
      <button class="secondary" id="restartButton">Start over</button>
    </div>
  `;
}

function bindEvents() {
  document.querySelector('#startButton')?.addEventListener('click', startLesson);
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

  document.querySelectorAll('[data-world-object]').forEach(button => {
    button.addEventListener('click', () => submitWorldEvent({
      type: 'object_click',
      object_id: button.dataset.worldObject,
    }));
  });

  document.querySelectorAll('[data-repair-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.repairIndex);
      const step = state.support?.steps?.[index];
      if (!step) return;
      submitWorldEvent({ type: 'repair_step_selected', index, step });
    });
  });

  requestAnimationFrame(() => {
    const log = document.querySelector('#chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  });
}

function startLesson() {
  stopRecognition();
  state.screen = 'lesson';
  state.phase = 'experience';
  state.mode = 'required';
  state.apiError = '';
  state.inputDraft = '';
  state.voiceMeta = null;
  state.world = blankWorld();
  state.worldBaseline = null;
  state.support = null;
  state.conversationId = '';
  state.messages = [
    { role: 'ai', text: "Teach me a game you know. I've never played it before." },
  ];
  sessionStorage.removeItem('gameTeacherConversationId');
  render();
  document.querySelector('#studentInput')?.focus();
}

function restartLesson() {
  stopRecognition();
  state.screen = 'home';
  state.phase = 'experience';
  state.mode = 'required';
  state.apiError = '';
  state.inputDraft = '';
  state.voiceMeta = null;
  state.world = blankWorld();
  state.worldBaseline = null;
  state.support = null;
  state.conversationId = '';
  state.messages = [];
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
  const speech = state.voiceMeta;
  state.inputDraft = '';
  state.voiceMeta = null;

  await requestLessonTurn({ message, speech });
}

async function submitWorldEvent(event) {
  if (state.loading || state.phase === 'complete') return;
  state.messages.push({ role: 'action', text: describeWorldEvent(event) });
  await requestLessonTurn({ event });
}

async function requestLessonTurn({ message = '', event = null, speech = null }) {
  state.loading = true;
  state.apiError = '';
  state.support = null;
  render();

  let result;
  try {
    result = await sendToDify({ message, event, speech });
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

  const previousPhase = state.phase;
  state.phase = result.phase || state.phase;

  if (result.world_patch) applyWorldPatch(result.world_patch);
  if (result.capture_baseline) state.worldBaseline = cloneWorld(state.world);

  if (result.reply) state.messages.push({ role: 'ai', text: result.reply });
  state.support = result.support || null;

  await applyUiAction(result.ui_action || { type: 'none', payload: {} });

  if (previousPhase !== 'independent' && state.phase === 'independent' && !state.worldBaseline) {
    state.worldBaseline = cloneWorld(state.world);
  }

  render();
}

async function sendToDify({ message = '', event = null, speech = null }) {
  let response;

  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        event,
        speech,
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

  if (error?.status === 501 || /Unsupported method.*POST/i.test(message)) {
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

function applyWorldPatch(patch) {
  if (!patch || typeof patch !== 'object') return;

  if (patch.replace && typeof patch.replace === 'object') {
    state.world = normalizeWorld(patch.replace);
    return;
  }

  if (typeof patch.name === 'string') state.world.name = patch.name;
  if (typeof patch.status === 'string') state.world.status = patch.status;
  if (typeof patch.ready === 'boolean') state.world.ready = patch.ready;
  if (patch.turn === null || typeof patch.turn === 'string') state.world.turn = patch.turn;

  if (patch.surface && typeof patch.surface === 'object') {
    state.world.surface = {
      ...state.world.surface,
      ...sanitizeSurface(patch.surface),
    };
  }

  if (Array.isArray(patch.remove_object_ids)) {
    const removed = new Set(patch.remove_object_ids.map(String));
    state.world.objects = state.world.objects.filter(object => !removed.has(String(object.id)));
  }

  if (Array.isArray(patch.add_objects)) {
    for (const raw of patch.add_objects) upsertWorldObject(raw, false);
  }

  if (Array.isArray(patch.update_objects)) {
    for (const raw of patch.update_objects) upsertWorldObject(raw, true);
  }

  if (Array.isArray(patch.counters)) {
    state.world.counters = patch.counters.map(normalizeCounter).filter(Boolean).slice(0, 8);
  }
}

function upsertWorldObject(raw, mergeExisting) {
  const object = normalizeWorldObject(raw);
  if (!object) return;
  const index = state.world.objects.findIndex(item => String(item.id) === String(object.id));
  if (index === -1) {
    if (state.world.objects.length < 36) state.world.objects.push(object);
    return;
  }
  state.world.objects[index] = mergeExisting
    ? { ...state.world.objects[index], ...object }
    : object;
}

async function applyUiAction(action) {
  const type = action?.type || 'none';
  const payload = action?.payload || {};

  if (type === 'action_sequence') {
    for (const step of payload.actions || []) await applyAtomicAction(step);
    return;
  }

  if (type === 'reset_to_baseline') {
    if (state.worldBaseline) {
      state.world = cloneWorld(state.worldBaseline);
      render();
      await wait(350);
    }
    return;
  }

  if (type === 'lesson_complete') {
    state.phase = 'complete';
  }
}

async function applyAtomicAction(action) {
  if (!action || typeof action !== 'object') return;

  switch (action.type) {
    case 'update_object': {
      const id = String(action.object_id || '');
      const index = state.world.objects.findIndex(item => String(item.id) === id);
      if (index !== -1) {
        state.world.objects[index] = {
          ...state.world.objects[index],
          ...normalizeWorldObjectPatch(action.patch || {}),
        };
      }
      render();
      await wait(action.delay_ms || 500);
      break;
    }

    case 'reveal_object':
      await updateObjectState(action.object_id, 'face_up', action.delay_ms || 550);
      break;

    case 'hide_object':
      await updateObjectState(action.object_id, 'face_down', action.delay_ms || 450);
      break;

    case 'remove_object':
      await updateObjectState(action.object_id, 'removed', action.delay_ms || 400);
      break;

    case 'set_turn':
      state.world.turn = action.to || null;
      render();
      await wait(action.delay_ms || 300);
      break;

    case 'set_counter': {
      const id = String(action.counter_id || '');
      const counter = state.world.counters.find(item => String(item.id) === id);
      if (counter) counter.value = action.value;
      else if (id && state.world.counters.length < 8) {
        state.world.counters.push({ id, label: action.label || id, value: action.value ?? 0 });
      }
      render();
      await wait(action.delay_ms || 250);
      break;
    }

    case 'set_status':
      state.world.status = String(action.text || '');
      render();
      await wait(action.delay_ms || 250);
      break;

    case 'reset_to_baseline':
      if (state.worldBaseline) state.world = cloneWorld(state.worldBaseline);
      render();
      await wait(action.delay_ms || 350);
      break;

    case 'wait':
      await wait(clampNumber(action.ms, 0, 2000, 300));
      break;

    default:
      break;
  }
}

async function updateObjectState(id, objectState, delay) {
  const object = state.world.objects.find(item => String(item.id) === String(id));
  if (object) object.state = objectState;
  render();
  await wait(delay);
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
    let confidence = 0;
    let alternatives = [];

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      transcript += result[0]?.transcript || '';
      confidence = Math.max(confidence, Number(result[0]?.confidence || 0));
      alternatives = Array.from(result)
        .slice(0, 3)
        .map(item => item.transcript)
        .filter(Boolean);
    }

    state.inputDraft = transcript.trim();
    state.voiceMeta = {
      confidence,
      alternatives,
      is_final: Boolean(event.results[event.results.length - 1]?.isFinal),
    };
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

function normalizeWorld(raw) {
  const world = blankWorld();
  if (!raw || typeof raw !== 'object') return world;
  if (typeof raw.name === 'string') world.name = raw.name;
  if (typeof raw.status === 'string') world.status = raw.status;
  if (typeof raw.ready === 'boolean') world.ready = raw.ready;
  if (raw.turn === null || typeof raw.turn === 'string') world.turn = raw.turn;
  world.surface = sanitizeSurface(raw.surface || {});
  world.objects = Array.isArray(raw.objects)
    ? raw.objects.map(normalizeWorldObject).filter(Boolean).slice(0, 36)
    : [];
  world.counters = Array.isArray(raw.counters)
    ? raw.counters.map(normalizeCounter).filter(Boolean).slice(0, 8)
    : [];
  return world;
}

function sanitizeSurface(raw) {
  const type = ['table', 'grid'].includes(raw?.type) ? raw.type : 'table';
  return {
    type,
    rows: clampNumber(raw?.rows, 0, 8, 0),
    columns: clampNumber(raw?.columns, 0, 8, type === 'grid' ? 3 : 0),
  };
}

function normalizeWorldObject(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id).slice(0, 64),
    kind: normalizeKind(raw.kind),
    label: String(raw.label || '').slice(0, 80),
    symbol: String(raw.symbol || '').slice(0, 12),
    caption: String(raw.caption || '').slice(0, 80),
    state: String(raw.state || 'available').slice(0, 32),
    row: clampNullableNumber(raw.row, 1, 8),
    column: clampNullableNumber(raw.column, 1, 8),
    owner: raw.owner == null ? null : String(raw.owner).slice(0, 40),
    interactive: Boolean(raw.interactive),
  };
}

function normalizeWorldObjectPatch(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const patch = {};
  if ('kind' in raw) patch.kind = normalizeKind(raw.kind);
  if ('label' in raw) patch.label = String(raw.label || '').slice(0, 80);
  if ('symbol' in raw) patch.symbol = String(raw.symbol || '').slice(0, 12);
  if ('caption' in raw) patch.caption = String(raw.caption || '').slice(0, 80);
  if ('state' in raw) patch.state = String(raw.state || 'available').slice(0, 32);
  if ('row' in raw) patch.row = clampNullableNumber(raw.row, 1, 8);
  if ('column' in raw) patch.column = clampNullableNumber(raw.column, 1, 8);
  if ('owner' in raw) patch.owner = raw.owner == null ? null : String(raw.owner).slice(0, 40);
  if ('interactive' in raw) patch.interactive = Boolean(raw.interactive);
  return patch;
}

function normalizeCounter(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id).slice(0, 64),
    label: String(raw.label || raw.id).slice(0, 40),
    value: ['string', 'number'].includes(typeof raw.value) ? raw.value : 0,
  };
}

function normalizeKind(kind) {
  return ['card', 'token', 'piece', 'cell', 'marker', 'object'].includes(kind) ? kind : 'object';
}

function buildObjectPositionStyle(object) {
  const declarations = [];
  if (object.column) declarations.push(`grid-column:${clampNumber(object.column, 1, 8, 1)}`);
  if (object.row) declarations.push(`grid-row:${clampNumber(object.row, 1, 8, 1)}`);
  return declarations.join(';');
}

function describeWorldEvent(event) {
  if (event?.type === 'object_click') {
    const object = state.world.objects.find(item => String(item.id) === String(event.object_id));
    return `You interacted with ${object?.label || object?.symbol || 'a game piece'}.`;
  }
  if (event?.type === 'repair_step_selected') return `You pointed to: ${event.step}`;
  return 'You interacted with the game.';
}

function cloneWorld(world) {
  return JSON.parse(JSON.stringify(world));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampNullableNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  return clampNumber(value, min, max, null);
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

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

render();
