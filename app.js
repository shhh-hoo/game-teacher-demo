const app = document.querySelector('#app');

const PROGRESS_STEPS = ['model', 'teach', 'play', 'transfer'];
const PROGRESS_LABELS = { model: 'Learn', teach: 'Teach', play: 'Play', transfer: 'Wrap up' };
const GUIDE_ITEMS = [
  { id: 'goal', label: 'Goal', prompt: 'What are we trying to do?' },
  { id: 'setup', label: 'Start', prompt: 'What do we need before we begin?' },
  { id: 'turn', label: 'Turn', prompt: 'What happens on a turn?' },
  { id: 'special', label: 'Special rules', prompt: 'Is there anything unusual?' },
  { id: 'ending', label: 'Ending', prompt: 'How do we know it is over?' },
];
const MODEL_SECTIONS = [
  { id: 'goal', label: 'Goal', question: 'Do you already know what you are trying to do in Tic-Tac-Toe?', explanation: 'Try to make a line of three of your marks: across, down, or diagonally.' },
  { id: 'setup', label: 'Start', question: 'Do you know what we need before we start?', explanation: 'We use a 3 × 3 grid. You are X and Raku is O.' },
  { id: 'turn', label: 'Turn', question: 'Do you know what happens on each turn?', explanation: 'Take turns choosing one empty square and place your mark there. You go first.' },
  { id: 'ending', label: 'Ending', question: 'Do you know how the game ends?', explanation: 'A line of three wins. If every square fills without a line of three, it is a draw.' },
];

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function blankWorld() {
  return { name: 'Your game', surface: { type: 'table', rows: 0, columns: 0 }, objects: [], counters: [], turn: null, status: 'Raku is waiting for you to describe the game.', ready: false };
}
function normalizePhase(phase) {
  if (phase === 'guided' || phase === 'independent') return 'practice';
  if (phase === 'notice') return 'teach';
  return phase;
}
function visibleProgressStep() {
  if (state.screen === 'model') return 'model';
  const phase = normalizePhase(state.phase);
  if (phase === 'experience' || phase === 'teach') return 'teach';
  if (phase === 'practice') return 'play';
  if (phase === 'transfer' || phase === 'complete') return 'transfer';
  return 'teach';
}

const state = {
  screen: 'home', conversationId: sessionStorage.getItem('gameTeacherConversationId') || '', userId: sessionStorage.getItem('gameTeacherUserId') || crypto.randomUUID(),
  phase: 'experience', loading: false, apiError: '', inputDraft: '', listening: false, voiceSupported: Boolean(SpeechRecognitionCtor), voiceMeta: null,
  world: blankWorld(), worldBaseline: null, support: null, guideMode: 'full', messages: [],
  modelFamiliarity: null, modelSectionIndex: 0, modelSectionMode: 'question', modelCompletedSections: [], modelBoard: Array(9).fill(''), modelTurn: 'X', modelGameOver: false,
  modelMessage: 'I have a quick game for us: Tic-Tac-Toe. How well do you know it?',
};
sessionStorage.setItem('gameTeacherUserId', state.userId);

function render() {
  app.innerHTML = `<div class="app-shell"><header class="topbar"><div class="brand"><h1>Teach Me a Game</h1><p>First Raku teaches you. Then you teach Raku.</p></div>${state.apiError ? '<div class="status-pill error">Connection issue</div>' : ''}</header>${state.screen !== 'home' ? renderProgress() : ''}${state.screen === 'home' ? renderHome() : state.screen === 'model' ? renderModelLesson() : renderLesson()}</div>`;
  bindEvents();
}
function renderProgress() {
  const current = visibleProgressStep(); const currentIndex = PROGRESS_STEPS.indexOf(current);
  return `<div class="progress" aria-label="Lesson progress">${PROGRESS_STEPS.map((step, index) => `<div class="progress-step ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'done' : ''}"><span>${index + 1}</span>${PROGRESS_LABELS[step]}</div>`).join('')}</div>`;
}
function renderHome() {
  return `<section class="card home"><div class="home-copy"><div class="eyebrow">A short lesson about explaining clearly</div><h2>Play a game with Raku. Then switch roles.</h2><p>Raku will show how a good game explanation changes depending on what the listener already knows. After that, you will teach Raku a game you know.</p><button class="primary start-button" id="startButton">Start with Raku</button></div><div class="home-preview" aria-hidden="true">${['Goal','Start','Turn','Special rules','Ending'].map(x => `<div class="preview-chip">${x}</div>`).join('')}</div></section>`;
}
function renderModelLesson() {
  if (!state.modelFamiliarity) return renderFamiliarityCheck();
  if (state.modelSectionIndex < MODEL_SECTIONS.length) return renderStructuredIntro();
  return renderModelGame();
}
function renderModelShell(inner) {
  return `<section class="card model-lesson"><aside class="model-raku"><div class="friend-header"><div class="avatar">R</div><div><b>Raku</b><small>Your friend · teaching you first</small></div></div><div class="raku-bubble" aria-live="polite">${escapeHtml(state.modelMessage)}</div><div class="model-structure"><div class="eyebrow">How Raku introduces a game</div>${MODEL_SECTIONS.map((section, index) => { const done = state.modelCompletedSections.includes(section.id); const current = index === state.modelSectionIndex && state.modelSectionIndex < MODEL_SECTIONS.length; return `<div class="structure-row ${done ? 'done' : ''} ${current ? 'current' : ''}"><span>${index + 1}</span>${escapeHtml(section.label)}</div>`; }).join('')}</div></aside><div class="model-main">${inner}</div></section>`;
}
function renderFamiliarityCheck() {
  return renderModelShell(`<div class="model-intro-card"><div class="eyebrow">Raku suggests a game</div><h2>Tic-Tac-Toe</h2><p>Before explaining, Raku checks what you already know.</p><div class="choice-grid"><button class="choice-card" data-familiarity="know"><b>I know it</b><span>Skip what I already understand.</span></button><button class="choice-card" data-familiarity="some"><b>A little</b><span>Check each part with me.</span></button><button class="choice-card" data-familiarity="new"><b>New to me</b><span>Teach me from the beginning.</span></button></div></div>`);
}
function renderStructuredIntro() {
  const section = MODEL_SECTIONS[state.modelSectionIndex];
  if (state.modelFamiliarity === 'new' && state.modelSectionMode === 'question') state.modelSectionMode = 'explain';
  const mode = state.modelSectionMode;
  return renderModelShell(`<div class="structured-card"><div class="section-number">${state.modelSectionIndex + 1} / ${MODEL_SECTIONS.length}</div><div class="eyebrow">${escapeHtml(section.label)}</div>${mode === 'question' ? `<h2>${escapeHtml(section.question)}</h2><p>Raku does not repeat information just because it is on a lesson script.</p><div class="inline-actions"><button class="primary" data-model-know="yes">Yes, I know</button><button class="secondary" data-model-know="no">Tell me</button></div>` : `<h2>${escapeHtml(section.explanation)}</h2><p class="model-note">One small chunk, then Raku moves on.</p><button class="primary" id="modelNextSection">${state.modelSectionIndex === MODEL_SECTIONS.length - 1 ? 'Let’s play' : 'Next part'}</button>`}</div>`);
}
function renderModelGame() {
  const winner = findModelWinner(state.modelBoard); const full = state.modelBoard.every(Boolean); const finished = Boolean(winner || full || state.modelGameOver);
  return renderModelShell(`<div class="model-game-card"><div class="game-head"><div><div class="eyebrow">Now use the explanation</div><h2>Tic-Tac-Toe</h2></div><div class="phase-pill">You are X</div></div><div class="tic-grid" aria-label="Tic-Tac-Toe board">${state.modelBoard.map((mark, index) => `<button class="tic-cell ${mark ? 'filled' : ''}" data-tic-cell="${index}" ${mark || finished || state.modelTurn !== 'X' ? 'disabled' : ''}>${escapeHtml(mark)}</button>`).join('')}</div><div class="model-game-footer"><span>${finished ? modelResultText(winner, full) : state.modelTurn === 'X' ? 'Your turn. Pick one empty square.' : 'Raku is choosing…'}</span>${finished ? '<button class="primary" id="teachRakuButton">Now switch roles</button>' : ''}</div></div>`);
}

function renderLesson() {
  const phase = normalizePhase(state.phase);
  return `<section class="card lesson"><aside class="chat-pane"><div class="friend-header"><div class="avatar">R</div><div><b>Raku</b><small>${phase === 'transfer' || phase === 'complete' ? 'Your friend · thinking back with you' : phase === 'practice' ? 'Your friend · playing from your explanation' : 'Your friend · learning your game'}</small></div></div><div class="chat-log" id="chatLog">${state.messages.map(message => `<div class="message ${message.role === 'student' ? 'student' : message.role === 'action' ? 'action' : 'ai'}">${escapeHtml(message.text)}</div>`).join('')}</div><div class="composer"><textarea id="studentInput" placeholder="Explain it to Raku…" ${state.loading || phase === 'complete' ? 'disabled' : ''}>${escapeHtml(state.inputDraft)}</textarea><div class="composer-actions"><button class="secondary" id="micButton" ${!state.voiceSupported || state.loading || phase === 'complete' ? 'disabled' : ''}>${state.listening ? 'Listening…' : 'Speak'}</button><button class="primary" id="sendButton" ${state.loading || phase === 'complete' ? 'disabled' : ''}>${state.loading ? '…' : 'Send'}</button></div></div></aside><div class="game-pane"><div class="game-head lesson-game-head"><div><div class="eyebrow">What Raku understands</div><h3>${escapeHtml(state.world.name || 'Your game')}</h3><p>Visual details may be filled in. Game logic only comes from what you explain.</p></div><div class="phase-pill">${lessonPhaseLabel(phase)}</div></div>${renderTeachingGuide(phase)}<div class="world-shell">${renderWorldStatus()}${renderWorldSurface()}${renderSupport(phase)}</div>${renderWorldFooter()}${state.apiError ? `<div class="helper-text error-copy"><strong>API error</strong><span>${escapeHtml(state.apiError)}</span></div>` : ''}</div></section>`;
}
function lessonPhaseLabel(phase) { if (phase === 'experience' || phase === 'teach') return 'Teach Raku'; if (phase === 'practice') return 'Keep playing'; if (phase === 'transfer') return 'Wrap up'; if (phase === 'complete') return 'Done'; return phase; }
function renderTeachingGuide(phase) {
  if (phase === 'transfer' || phase === 'complete') return '';
  let mode = state.guideMode; if (phase === 'experience' || phase === 'teach') mode = 'full';
  if (mode === 'hidden') return `<details class="guide-collapsed"><summary>Need the Game Teaching Guide?</summary>${renderGuideItems('compact')}</details>`;
  const gap = state.support?.listener_gap || ''; const highlight = inferGuideHighlight(gap);
  return `<section class="teaching-guide ${mode === 'compact' ? 'compact' : ''}"><div class="guide-head"><div><div class="eyebrow">Game Teaching Guide</div><b>${mode === 'compact' ? 'A quick reminder' : 'Think about what a new player needs'}</b></div>${phase === 'practice' ? '<span class="fade-note">Fades as you keep playing</span>' : ''}</div>${gap ? `<div class="guide-gap"><b>Raku needs something here:</b> ${escapeHtml(gap)}</div>` : ''}${renderGuideItems(mode, highlight)}</section>`;
}
function renderGuideItems(mode = 'full', highlight = '') { return `<div class="guide-items ${mode === 'compact' ? 'compact' : ''}">${GUIDE_ITEMS.map(item => `<div class="guide-item ${item.id === highlight ? 'highlight' : ''}"><b>${escapeHtml(item.label)}</b>${mode === 'compact' ? '' : `<span>${escapeHtml(item.prompt)}</span>`}</div>`).join('')}</div>`; }
function inferGuideHighlight(text) { const low = String(text || '').toLowerCase(); if (/win|end|finish|over|complete/.test(low)) return 'ending'; if (/start|setup|begin|before/.test(low)) return 'setup'; if (/turn|next|move|after/.test(low)) return 'turn'; if (/if|when|special|except|unless/.test(low)) return 'special'; if (/goal|trying|aim|objective/.test(low)) return 'goal'; return ''; }
function renderWorldStatus() { const readyLabel = state.world.ready ? 'Playable so far' : 'Still being built'; return `<div class="world-status"><span class="world-ready ${state.world.ready ? 'ready' : ''}">${readyLabel}</span><span>${escapeHtml(state.world.status || '')}</span></div>`; }
function renderWorldSurface() {
  const objects = state.world.objects || [];
  if (!objects.length) return `<div class="empty-world"><div class="empty-world-mark">＋</div><b>Nothing has been built yet.</b><span>Start with whatever Raku needs in order to understand the game.</span></div>`;
  const surface = state.world.surface || { type: 'table' }; const isGrid = surface.type === 'grid'; const columns = clampNumber(surface.columns, 1, 8, isGrid ? 3 : 4); const rows = clampNumber(surface.rows, 0, 8, 0); const style = isGrid ? `--world-columns:${columns};${rows ? `--world-rows:${rows};` : ''}` : '';
  return `<div class="world-surface ${isGrid ? 'grid-surface' : 'table-surface'}" style="${style}">${objects.map(renderWorldObject).join('')}</div>`;
}
function renderWorldObject(object) {
  const id = String(object.id || ''); const kind = normalizeKind(object.kind); const objectState = String(object.state || 'available'); const faceDown = objectState === 'face_down'; const phase = normalizePhase(state.phase); const interactive = Boolean(object.interactive) && ['experience', 'teach', 'practice'].includes(phase) && !state.loading; const symbol = faceDown ? '' : String(object.symbol || object.label || ''); const title = String(object.label || object.symbol || object.id || 'Game object'); const positionStyle = buildObjectPositionStyle(object);
  return `<button class="world-object kind-${kind} state-${escapeAttr(objectState)} ${interactive ? 'interactive' : ''}" data-world-object="${escapeAttr(id)}" style="${positionStyle}" aria-label="${escapeAttr(title)}" ${interactive ? '' : 'disabled'}>${faceDown ? '<span class="object-back"></span>' : `<span class="object-symbol">${escapeHtml(symbol)}</span>`}${object.caption ? `<small>${escapeHtml(object.caption)}</small>` : ''}</button>`;
}
function renderSupport(phase) {
  if (!state.support || phase === 'transfer' || phase === 'complete') return '';
  if (state.support.type === 'teach_moment') return `<section class="teach-panel"><div class="teach-kicker">Raku got stuck for a real reason</div><h4>${escapeHtml(state.support.headline || 'What does Raku still need?')}</h4><p>${escapeHtml(state.support.principle || '')}</p>${state.support.listener_gap ? `<div class="listener-gap"><b>Raku still needs:</b> ${escapeHtml(state.support.listener_gap)}</div>` : ''}${state.support.question ? `<div class="teach-question">${escapeHtml(state.support.question)}</div>` : ''}</section>`;
  if (state.support.type === 'guide_hint') return `<section class="hint-panel"><b>Need a hint?</b><span>${escapeHtml(state.support.listener_gap || 'Think about what Raku needs before the next move.')}</span></section>`;
  if (state.support.type === 'locate_step') { const steps = Array.isArray(state.support.steps) ? state.support.steps : []; return `<section class="repair-panel"><h4>${escapeHtml(state.support.prompt || 'Which step should Raku change?')}</h4><p>Point to the part that did not match what you meant.</p><div class="repair-steps">${steps.map((step, index) => `<button class="repair-step" data-repair-index="${index}">${escapeHtml(step)}</button>`).join('')}</div></section>`; }
  return '';
}
function renderWorldFooter() { const counters = Array.isArray(state.world.counters) ? state.world.counters : []; return `<div class="world-footer"><div class="world-meta">${state.world.turn ? `<span><b>Turn:</b> ${escapeHtml(state.world.turn)}</span>` : '<span>Explain first, then play.</span>'}${counters.map(counter => `<span><b>${escapeHtml(counter.label || counter.id)}:</b> ${escapeHtml(counter.value ?? 0)}</span>`).join('')}</div><button class="secondary" id="restartButton">Start over</button></div>`; }

function bindEvents() {
  document.querySelector('#startButton')?.addEventListener('click', startLesson);
  document.querySelectorAll('[data-familiarity]').forEach(button => button.addEventListener('click', () => chooseFamiliarity(button.dataset.familiarity)));
  document.querySelectorAll('[data-model-know]').forEach(button => button.addEventListener('click', () => answerModelKnowledge(button.dataset.modelKnow === 'yes')));
  document.querySelector('#modelNextSection')?.addEventListener('click', advanceModelSection);
  document.querySelectorAll('[data-tic-cell]').forEach(button => button.addEventListener('click', () => playModelMove(Number(button.dataset.ticCell))));
  document.querySelector('#teachRakuButton')?.addEventListener('click', beginTeaching);
  document.querySelector('#sendButton')?.addEventListener('click', () => submitMessage());
  document.querySelector('#micButton')?.addEventListener('click', toggleVoiceInput);
  document.querySelector('#studentInput')?.addEventListener('input', event => { state.inputDraft = event.currentTarget.value; });
  document.querySelector('#studentInput')?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitMessage(); } });
  document.querySelector('#restartButton')?.addEventListener('click', restartLesson);
  document.querySelectorAll('[data-world-object]').forEach(button => button.addEventListener('click', () => submitWorldEvent({ type: 'object_click', object_id: button.dataset.worldObject })));
  document.querySelectorAll('[data-repair-index]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.repairIndex); const step = state.support?.steps?.[index]; if (step) submitWorldEvent({ type: 'repair_step_selected', index, step }); }));
  requestAnimationFrame(() => { const log = document.querySelector('#chatLog'); if (log) log.scrollTop = log.scrollHeight; });
}
function startLesson() {
  stopRecognition(); state.screen = 'model'; state.phase = 'experience'; state.apiError = ''; state.inputDraft = ''; state.voiceMeta = null; state.world = blankWorld(); state.worldBaseline = null; state.support = null; state.guideMode = 'full'; state.conversationId = ''; state.messages = [];
  state.modelFamiliarity = null; state.modelSectionIndex = 0; state.modelSectionMode = 'question'; state.modelCompletedSections = []; state.modelBoard = Array(9).fill(''); state.modelTurn = 'X'; state.modelGameOver = false; state.modelMessage = 'I have a quick game for us: Tic-Tac-Toe. How well do you know it?';
  sessionStorage.removeItem('gameTeacherConversationId'); render();
}
function chooseFamiliarity(level) {
  state.modelFamiliarity = ['know', 'some', 'new'].includes(level) ? level : 'some'; state.modelSectionIndex = 0; state.modelSectionMode = state.modelFamiliarity === 'new' ? 'explain' : 'question';
  state.modelMessage = state.modelFamiliarity === 'know' ? 'Great — I will check the important parts and skip anything you already know.' : state.modelFamiliarity === 'some' ? 'Perfect. I will check each part so I only explain what you need.' : 'No problem. I will introduce it one small part at a time.'; render();
}
function answerModelKnowledge(knows) { const section = MODEL_SECTIONS[state.modelSectionIndex]; if (!section) return; if (knows) completeModelSection(); else { state.modelSectionMode = 'explain'; state.modelMessage = `Here is the ${section.label.toLowerCase()} part.`; render(); } }
function advanceModelSection() { completeModelSection(); }
function completeModelSection() {
  const section = MODEL_SECTIONS[state.modelSectionIndex]; if (section && !state.modelCompletedSections.includes(section.id)) state.modelCompletedSections.push(section.id); state.modelSectionIndex += 1; state.modelSectionMode = state.modelFamiliarity === 'new' ? 'explain' : 'question';
  state.modelMessage = state.modelSectionIndex >= MODEL_SECTIONS.length ? 'That is enough to start. Now let us actually play — you are X and you go first.' : `Next: ${MODEL_SECTIONS[state.modelSectionIndex].label}. I will check what you already know first.`; render();
}
function playModelMove(index) { if (state.modelGameOver || state.modelTurn !== 'X' || state.modelBoard[index]) return; state.modelBoard[index] = 'X'; if (finishModelGameIfNeeded()) return; state.modelTurn = 'O'; state.modelMessage = 'Nice — I know enough to take my turn too.'; render(); window.setTimeout(playRakuModelMove, 380); }
function playRakuModelMove() { if (state.modelGameOver || state.modelTurn !== 'O') return; const priority = [4,8,0,2,6,1,3,5,7]; const index = priority.find(i => !state.modelBoard[i]); if (index == null) return; state.modelBoard[index] = 'O'; if (finishModelGameIfNeeded()) return; state.modelTurn = 'X'; state.modelMessage = 'Your turn again. The explanation stays the same — now we just use it.'; render(); }
function finishModelGameIfNeeded() { const winner = findModelWinner(state.modelBoard); const full = state.modelBoard.every(Boolean); if (!winner && !full) return false; state.modelGameOver = true; state.modelMessage = winner ? `${winner === 'X' ? 'You' : 'I'} made a line of three. That ending rule tells us the game is over.` : 'The grid is full and nobody has a line of three, so this one is a draw.'; render(); return true; }
function findModelWinner(board) { const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]; return ''; }
function modelResultText(winner, full) { if (winner === 'X') return 'You made three in a row. The game ended exactly when the explanation said it would.'; if (winner === 'O') return 'Raku made three in a row. The ending was clear before it happened.'; if (full) return 'The grid is full, so the game is a draw.'; return 'Game finished.'; }
function beginTeaching() { state.screen = 'lesson'; state.phase = 'experience'; state.world = blankWorld(); state.worldBaseline = null; state.support = null; state.guideMode = 'full'; state.conversationId = ''; state.messages = [{ role: 'ai', text: "Now switch roles. Teach me a game you know — I’ll only use the game rules you explain." }]; sessionStorage.removeItem('gameTeacherConversationId'); render(); document.querySelector('#studentInput')?.focus(); }
function restartLesson() { stopRecognition(); state.screen = 'home'; state.phase = 'experience'; state.apiError = ''; state.inputDraft = ''; state.voiceMeta = null; state.world = blankWorld(); state.worldBaseline = null; state.support = null; state.guideMode = 'full'; state.conversationId = ''; state.messages = []; sessionStorage.removeItem('gameTeacherConversationId'); render(); }

async function submitMessage(overrideMessage = '') { if (state.loading || normalizePhase(state.phase) === 'complete') return; const input = document.querySelector('#studentInput'); const message = (overrideMessage || input?.value || state.inputDraft).trim(); if (!message) return; stopRecognition(); state.messages.push({ role: 'student', text: message }); const speech = state.voiceMeta; state.inputDraft = ''; state.voiceMeta = null; await requestLessonTurn({ message, speech }); }
async function submitWorldEvent(event) { if (state.loading || normalizePhase(state.phase) === 'complete') return; state.messages.push({ role: 'action', text: describeWorldEvent(event) }); await requestLessonTurn({ event }); }
async function requestLessonTurn({ message = '', event = null, speech = null }) {
  state.loading = true; state.apiError = ''; render(); let result;
  try { result = await sendToDify({ message, event, speech }); } catch (error) { state.loading = false; state.apiError = formatDifyError(error); console.error('Dify request failed.', error); render(); return; }
  state.loading = false; if (result.conversationId) { state.conversationId = result.conversationId; sessionStorage.setItem('gameTeacherConversationId', result.conversationId); }
  state.phase = normalizePhase(result.phase || state.phase); if (result.world_patch) applyWorldPatch(result.world_patch); if (result.capture_baseline) state.worldBaseline = cloneWorld(state.world); if (result.reply) state.messages.push({ role: 'ai', text: result.reply }); state.support = result.support || null; updateGuideMode(result); await applyUiAction(result.ui_action || { type: 'none', payload: {} }); render();
}
function updateGuideMode(result) { const phase = normalizePhase(result.phase || state.phase); const support = result.support || null; if (phase === 'experience' || phase === 'teach') { state.guideMode = 'full'; return; } if (phase === 'practice') { if (support?.type === 'game_guide') state.guideMode = support.mode === 'compact' ? 'compact' : 'full'; else if (support?.type === 'guide_hint' || support?.type === 'teach_moment') state.guideMode = 'compact'; else state.guideMode = 'hidden'; return; } state.guideMode = 'hidden'; }
async function sendToDify({ message = '', event = null, speech = null }) {
  let response; try { response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, event, speech, conversationId: state.conversationId, userId: state.userId }) }); } catch (cause) { const error = new Error('The /api/chat endpoint could not be reached.'); error.code = 'NETWORK'; error.cause = cause; throw error; }
  if (!response.ok) { const raw = await response.text(); let detail = raw; try { const parsed = JSON.parse(raw); detail = parsed.detail || parsed.error || raw; } catch {} const error = new Error(String(detail || `HTTP ${response.status}`)); error.status = response.status; throw error; }
  const payload = await response.json(); if (!payload || typeof payload !== 'object') { const error = new Error('The Dify proxy returned an invalid response.'); error.code = 'INVALID_RESPONSE'; throw error; } return payload;
}
function formatDifyError(error) { const message = error instanceof Error ? error.message : String(error || ''); if (error?.status === 503 || /DIFY_API_KEY/i.test(message)) return 'Dify is not configured. Load DIFY_API_KEY into the environment running `vercel dev`.'; if (error?.status === 501 || /Unsupported method.*POST/i.test(message)) return 'This page is being served by a static server. Run it through `npx vercel dev`.'; if (error?.status === 404 || /\/api\/chat.*not.*reach/i.test(message)) return 'The Dify API proxy is not available. Run this project with `npx vercel dev`, or deploy it to Vercel.'; if (error?.code === 'NETWORK') return 'The Dify API proxy could not be reached. Check that the local Vercel server is running.'; return `Could not reach Dify: ${message}`; }

function applyWorldPatch(patch) {
  if (!patch || typeof patch !== 'object') return; if (patch.replace && typeof patch.replace === 'object') { state.world = normalizeWorld(patch.replace); return; }
  if (typeof patch.name === 'string') state.world.name = patch.name; if (typeof patch.status === 'string') state.world.status = patch.status; if (typeof patch.ready === 'boolean') state.world.ready = patch.ready; if (patch.turn === null || typeof patch.turn === 'string') state.world.turn = patch.turn;
  if (patch.surface && typeof patch.surface === 'object') state.world.surface = { ...state.world.surface, ...sanitizeSurfacePatch(patch.surface) };
  if (Array.isArray(patch.remove_object_ids)) { const removed = new Set(patch.remove_object_ids.map(String)); state.world.objects = state.world.objects.filter(object => !removed.has(String(object.id))); }
  if (Array.isArray(patch.add_objects)) for (const raw of patch.add_objects) upsertWorldObject(raw, false); if (Array.isArray(patch.update_objects)) for (const raw of patch.update_objects) upsertWorldObject(raw, true); if (Array.isArray(patch.counters)) state.world.counters = patch.counters.map(normalizeCounter).filter(Boolean).slice(0, 8);
}
function upsertWorldObject(raw, mergeExisting) { if (!raw || typeof raw !== 'object' || !raw.id) return; const id = String(raw.id).slice(0, 64); const index = state.world.objects.findIndex(item => String(item.id) === id); if (mergeExisting) { if (index === -1) return; state.world.objects[index] = { ...state.world.objects[index], ...normalizeWorldObjectPatch(raw), id }; return; } const object = normalizeWorldObject(raw); if (!object) return; if (index === -1) { if (state.world.objects.length < 36) state.world.objects.push(object); return; } state.world.objects[index] = object; }
async function applyUiAction(action) { const type = action?.type || 'none'; const payload = action?.payload || {}; if (type === 'action_sequence') { for (const step of payload.actions || []) await applyAtomicAction(step); return; } if (type === 'reset_to_baseline') { if (state.worldBaseline) state.world = cloneWorld(state.worldBaseline); return; } if (type === 'lesson_complete') state.phase = 'complete'; }
async function applyAtomicAction(action) { if (!action || typeof action !== 'object') return; switch (action.type) { case 'update_object': { const id = String(action.object_id || ''); const index = state.world.objects.findIndex(item => String(item.id) === id); if (index !== -1) state.world.objects[index] = { ...state.world.objects[index], ...normalizeWorldObjectPatch(action.patch || {}) }; render(); await wait(action.delay_ms || 450); break; } case 'reveal_object': await updateObjectState(action.object_id, 'face_up', action.delay_ms || 500); break; case 'hide_object': await updateObjectState(action.object_id, 'face_down', action.delay_ms || 420); break; case 'remove_object': await updateObjectState(action.object_id, 'removed', action.delay_ms || 380); break; case 'set_turn': state.world.turn = action.to || null; render(); await wait(action.delay_ms || 260); break; case 'set_counter': { const id = String(action.counter_id || ''); const counter = state.world.counters.find(item => String(item.id) === id); if (counter) counter.value = action.value; else if (id && state.world.counters.length < 8) state.world.counters.push({ id, label: action.label || id, value: action.value ?? 0 }); render(); await wait(action.delay_ms || 220); break; } case 'set_status': state.world.status = String(action.text || ''); render(); await wait(action.delay_ms || 220); break; case 'reset_to_baseline': if (state.worldBaseline) state.world = cloneWorld(state.worldBaseline); render(); await wait(action.delay_ms || 300); break; case 'wait': await wait(clampNumber(action.ms, 0, 2000, 300)); break; default: break; } }
async function updateObjectState(id, objectState, delay) { const object = state.world.objects.find(item => String(item.id) === String(id)); if (object) object.state = objectState; render(); await wait(delay); }

function toggleVoiceInput() {
  if (!state.voiceSupported || state.loading || normalizePhase(state.phase) === 'complete') return; if (state.listening) { stopRecognition(); render(); return; }
  recognition = new SpeechRecognitionCtor(); recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 3;
  recognition.onstart = () => { state.listening = true; state.apiError = ''; render(); };
  recognition.onresult = event => { let transcript = ''; let confidence = 0; let alternatives = []; for (let i = event.resultIndex; i < event.results.length; i += 1) { const result = event.results[i]; transcript += result[0]?.transcript || ''; confidence = Math.max(confidence, Number(result[0]?.confidence || 0)); alternatives = Array.from(result).slice(0, 3).map(item => item.transcript).filter(Boolean); } state.inputDraft = transcript.trim(); state.voiceMeta = { confidence, alternatives, is_final: Boolean(event.results[event.results.length - 1]?.isFinal) }; render(); document.querySelector('#studentInput')?.focus(); };
  recognition.onerror = event => { state.listening = false; if (event.error !== 'aborted' && event.error !== 'no-speech') state.apiError = `Speech input error: ${event.error}`; render(); };
  recognition.onend = () => { state.listening = false; recognition = null; render(); document.querySelector('#studentInput')?.focus(); }; recognition.start();
}
function stopRecognition() { if (recognition) { recognition.onend = null; try { recognition.abort(); } catch {} recognition = null; } state.listening = false; }
function normalizeWorld(raw) { const world = blankWorld(); if (!raw || typeof raw !== 'object') return world; if (typeof raw.name === 'string') world.name = raw.name; if (typeof raw.status === 'string') world.status = raw.status; if (typeof raw.ready === 'boolean') world.ready = raw.ready; if (raw.turn === null || typeof raw.turn === 'string') world.turn = raw.turn; world.surface = sanitizeSurface(raw.surface || {}); world.objects = Array.isArray(raw.objects) ? raw.objects.map(normalizeWorldObject).filter(Boolean).slice(0, 36) : []; world.counters = Array.isArray(raw.counters) ? raw.counters.map(normalizeCounter).filter(Boolean).slice(0, 8) : []; return world; }
function sanitizeSurface(raw) { const type = ['table', 'grid'].includes(raw?.type) ? raw.type : 'table'; return { type, rows: clampNumber(raw?.rows, 0, 8, 0), columns: clampNumber(raw?.columns, 0, 8, type === 'grid' ? 3 : 0) }; }
function sanitizeSurfacePatch(raw) { if (!raw || typeof raw !== 'object') return {}; const patch = {}; if ('type' in raw && ['table', 'grid'].includes(raw.type)) patch.type = raw.type; if ('rows' in raw && raw.rows !== null && raw.rows !== '') patch.rows = clampNumber(raw.rows, 0, 8, 0); if ('columns' in raw && raw.columns !== null && raw.columns !== '') patch.columns = clampNumber(raw.columns, 0, 8, 0); return patch; }
function normalizeWorldObject(raw) { if (!raw || typeof raw !== 'object' || !raw.id) return null; return { id: String(raw.id).slice(0, 64), kind: normalizeKind(raw.kind), label: String(raw.label || '').slice(0, 80), symbol: String(raw.symbol || '').slice(0, 12), caption: String(raw.caption || '').slice(0, 80), state: String(raw.state || 'available').slice(0, 32), row: clampNullableNumber(raw.row, 1, 8), column: clampNullableNumber(raw.column, 1, 8), owner: raw.owner == null ? null : String(raw.owner).slice(0, 40), interactive: Boolean(raw.interactive) }; }
function normalizeWorldObjectPatch(raw) { if (!raw || typeof raw !== 'object') return {}; const patch = {}; if ('kind' in raw) patch.kind = normalizeKind(raw.kind); if ('label' in raw) patch.label = String(raw.label || '').slice(0, 80); if ('symbol' in raw) patch.symbol = String(raw.symbol || '').slice(0, 12); if ('caption' in raw) patch.caption = String(raw.caption || '').slice(0, 80); if ('state' in raw) patch.state = String(raw.state || 'available').slice(0, 32); if ('row' in raw) patch.row = clampNullableNumber(raw.row, 1, 8); if ('column' in raw) patch.column = clampNullableNumber(raw.column, 1, 8); if ('owner' in raw) patch.owner = raw.owner == null ? null : String(raw.owner).slice(0, 40); if ('interactive' in raw) patch.interactive = Boolean(raw.interactive); return patch; }
function normalizeCounter(raw) { if (!raw || typeof raw !== 'object' || !raw.id) return null; return { id: String(raw.id).slice(0, 64), label: String(raw.label || raw.id).slice(0, 40), value: ['string', 'number'].includes(typeof raw.value) ? raw.value : 0 }; }
function normalizeKind(kind) { return ['card', 'token', 'piece', 'cell', 'marker', 'object'].includes(kind) ? kind : 'object'; }
function buildObjectPositionStyle(object) { const declarations = []; if (object.column) declarations.push(`grid-column:${clampNumber(object.column, 1, 8, 1)}`); if (object.row) declarations.push(`grid-row:${clampNumber(object.row, 1, 8, 1)}`); return declarations.join(';'); }
function describeWorldEvent(event) { if (event?.type === 'object_click') { const object = state.world.objects.find(item => String(item.id) === String(event.object_id)); return `You interacted with ${object?.label || object?.symbol || 'a game piece'}.`; } if (event?.type === 'repair_step_selected') return `You pointed to: ${event.step}`; return 'You interacted with the game.'; }
function cloneWorld(world) { return JSON.parse(JSON.stringify(world)); }
function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback; }
function clampNullableNumber(value, min, max) { return value === null || value === undefined || value === '' ? null : clampNumber(value, min, max, null); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function escapeAttr(value) { return escapeHtml(value).replaceAll('`', '&#096;'); }

render();
