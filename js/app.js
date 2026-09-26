const roomClient = new RoomClient();
let currentPage = 'home', currentProblem = null, gameEngine = null;
let selectedRule = null, selectedMode = 'single', selectedDifficulty = 'normal', customPiles = null;
let myPlayerNumber = null, myRoomCode = null, timerInterval = null, timeLeft = 0, roomVersion = 0, multiplayerStarted = false;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const isSingle = () => myRoomCode?.startsWith('single-');
const myTurn = () => Boolean(gameEngine) && (isSingle() ? gameEngine.currentPlayer === 1 : multiplayerStarted && gameEngine.currentPlayer === myPlayerNumber);

function toast(message, type = '') {
    const element = $('#toast'); element.textContent = message; element.className = `toast show ${type}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => element.className = 'toast', 2600);
}

function cycleTheme() {
    const names = { aurora: ['✦', '极光'], paper: ['☀', '明纸'], arcade: ['◆', '街机'] };
    const current = document.body.dataset.theme || APP_CONFIG.defaultTheme;
    const next = APP_CONFIG.themes[(APP_CONFIG.themes.indexOf(current) + 1) % APP_CONFIG.themes.length];
    document.body.dataset.theme = next; localStorage.setItem('baba-theme', next);
    $('#theme-icon').textContent = names[next][0]; $('#theme-name').textContent = names[next][1];
}
function loadTheme() {
    const saved = localStorage.getItem('baba-theme');
    if (APP_CONFIG.themes.includes(saved)) { document.body.dataset.theme = APP_CONFIG.themes[(APP_CONFIG.themes.indexOf(saved) + APP_CONFIG.themes.length - 1) % APP_CONFIG.themes.length]; cycleTheme(); }
}

function switchPage(page) {
    $$('.page').forEach(item => item.classList.remove('active')); $$('.nav-btn').forEach(item => item.classList.remove('active'));
    $(`#${page}`).classList.add('active'); $(`[data-page="${page}"]`)?.classList.add('active'); currentPage = page;
    if (page === 'problems') renderProblems();
    if (page === 'battle' && !gameEngine?.finished && !myRoomCode) initBattlePage();
}
$$('.nav-btn').forEach(button => button.addEventListener('click', () => switchPage(button.dataset.page)));

function renderProblems() {
    $('#problem-grid').innerHTML = PROBLEMS.map((problem, index) => `<article class="problem-card reveal" style="--delay:${index * 45}ms">
        <div class="card-top"><span class="problem-icon">${problem.icon}</span><span class="diff diff-${problem.difficulty}">${problem.difficulty === 'easy' ? '简单' : problem.difficulty === 'medium' ? '中等' : '困难'}</span></div>
        <h3>${problem.name}</h3><p>${problem.description}</p>
        <div class="card-actions"><button class="text-button" onclick="quickPlay('${problem.id}')">立即试玩 →</button><a href="${problem.link}" target="_blank" rel="noreferrer">原题 ↗</a></div>
    </article>`).join('');
}
function quickPlay(id) { switchPage('battle'); const card = $(`.rule-card[data-rule="${id}"]`); selectRule(id, card); $('#step-config').scrollIntoView({ behavior: 'smooth' }); }

function resetSession() {
    clearInterval(timerInterval); roomClient.close(false); gameEngine = null; currentProblem = null; myRoomCode = null; myPlayerNumber = null; multiplayerStarted = false;
}
function initBattlePage() {
    clearInterval(timerInterval); selectedRule = null; selectedMode = 'single'; selectedDifficulty = 'normal'; customPiles = null;
    $('#room-lobby').style.display = 'block'; $('#game-room').style.display = 'none'; $('#step-rule').classList.remove('hidden'); $('#step-config').classList.add('hidden');
    $('#custom-stones').value = ''; selectMode('single'); selectDifficulty('normal');
    $('#rule-cards').innerHTML = PROBLEMS.map((problem, index) => `<button class="rule-card reveal" data-rule="${problem.id}" style="--delay:${index * 35}ms" onclick="selectRule('${problem.id}',this)">
        <span class="rule-icon">${problem.icon}</span><span class="rule-name">${problem.name}</span><span class="diff diff-${problem.difficulty}">${problem.difficulty === 'easy' ? '简单' : problem.difficulty === 'medium' ? '中等' : '困难'}</span>
    </button>`).join('');
}
function selectRule(ruleId, card) {
    selectedRule = ruleId; $$('.rule-card').forEach(item => item.classList.remove('selected')); card?.classList.add('selected'); $('#step-config').classList.remove('hidden');
    const problem = PROBLEMS.find(item => item.id === ruleId); const customRow = $('#custom-config-row');
    $('#config-label').textContent = `${problem.configLabel || '随机局面'}：`; $('#custom-stones').placeholder = problem.configPlaceholder || '该玩法自动生成局面'; $('#custom-stones').value = '';
    customRow.classList.toggle('hidden', !problem.customizable); customRow.querySelector('input').disabled = !problem.customizable;
}
function selectMode(mode) {
    selectedMode = mode; $$('.mode-btn').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    $('#single-config').classList.toggle('hidden', mode !== 'single'); $('#multi-config').classList.toggle('hidden', mode !== 'multi'); $('#start-game-btn').classList.toggle('hidden', mode !== 'single');
}
function selectDifficulty(value) { selectedDifficulty = value; $$('.diff-btn').forEach(button => button.classList.toggle('active', button.dataset.diff === value)); }

function randomStones() {
    const problem = PROBLEMS.find(item => item.id === selectedRule), input = $('#custom-stones'); if (!problem) return;
    if (problem.rule === 'bash') input.value = Math.floor(Math.random() * 40) + 10;
    else if (['nim', 'fragmented-nim'].includes(problem.rule)) input.value = Math.floor(Math.random() * 4) + 2;
    else if (problem.rule === 'wythoff') input.value = `${Math.floor(Math.random() * 15) + 3}, ${Math.floor(Math.random() * 15) + 3}`;
    else if (problem.rule === 'euclid') input.value = `${Math.floor(Math.random() * 50) + 10}, ${Math.floor(Math.random() * 20) + 3}`;
    else if (problem.rule === 'yet-another') input.value = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => Math.floor(Math.random() * 10) + 1).join(', ');
}
function getCustomPiles() {
    const value = $('#custom-stones')?.value.trim(), problem = PROBLEMS.find(item => item.id === selectedRule); if (!value || !problem) return null;
    if (problem.rule === 'bash') { const amount = Number(value); return Number.isInteger(amount) && amount > 0 && amount <= 200 ? [amount] : null; }
    if (['nim', 'fragmented-nim'].includes(problem.rule)) { const count = Number(value); return Number.isInteger(count) && count >= 2 && count <= 8 ? Array.from({ length: count }, () => Math.floor(Math.random() * 10) + 1) : null; }
    const parts = value.split(',').map(part => Number(part.trim()));
    if (['wythoff', 'euclid'].includes(problem.rule)) return parts.length === 2 && parts.every(Number.isInteger) && parts.every(number => number > 0 && number <= 200) ? [Math.max(...parts), Math.min(...parts)] : null;
    if (problem.rule === 'yet-another') return parts.length >= 1 && parts.length <= 3 && parts.every(Number.isInteger) && parts.every(number => number >= 0 && number <= 40) && parts.some(Boolean) ? parts : null;
    return null;
}

function buildProblem(base) {
    if (typeof base.randomChallenge === 'function') {
        const challenge = base.randomChallenge(), setup = { ...base, ...challenge }; delete setup.randomChallenge; delete setup.challenges; return setup;
    }
    let piles = getCustomPiles();
    if (!piles) {
        if (base.rule === 'bash') piles = [Math.floor(Math.random() * 35) + 12];
        else if (['nim', 'fragmented-nim'].includes(base.rule)) piles = Array.from({ length: Math.floor(Math.random() * 3) + 3 }, () => Math.floor(Math.random() * 9) + 2);
        else if (base.rule === 'wythoff') piles = [Math.floor(Math.random() * 15) + 3, Math.floor(Math.random() * 15) + 3];
        else if (base.rule === 'euclid') piles = [Math.floor(Math.random() * 45) + 12, Math.floor(Math.random() * 12) + 3].sort((a, b) => b - a);
        else if (base.rule === 'yet-another') piles = Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => Math.floor(Math.random() * 8) + 1);
        else piles = [...(base.defaultPiles || [])];
    }
    const setup = { ...base, piles }; delete setup.randomChallenge; delete setup.challenges; return setup;
}
function createEngine(problem) {
    const engine = new GameEngine(problem);
    if (problem.rule === 'wood-chess') engine.grid = Array.from({ length: problem.n }, () => Array(problem.m).fill(null));
    return engine;
}

function startGame() { if (!selectedRule) return toast('请先选择一个规则', 'error'); startSinglePlayer(); }
function startSinglePlayer() {
    const base = PROBLEMS.find(item => item.id === selectedRule); if (!base) return;
    currentProblem = buildProblem(base); gameEngine = createEngine(currentProblem); myRoomCode = `single-${Date.now()}`; myPlayerNumber = 1; openGameRoom();
    $('#room-badge').textContent = selectedDifficulty === 'hard' ? '单人 · 困难' : '单人 · 普通';
    addLog(`【${currentProblem.name}】开始，你是玩家1。`); beginTurn();
}

function openGameRoom(waiting = false) {
    $('#room-lobby').style.display = 'none'; $('#game-room').style.display = 'block'; $('#log-list').innerHTML = '';
    $('#name-p1').textContent = myPlayerNumber === 1 ? '你 · 玩家1' : '玩家1'; $('#name-p2').textContent = isSingle() ? 'AI · 玩家2' : myPlayerNumber === 2 ? '你 · 玩家2' : waiting ? '等待加入…' : '玩家2';
    $('#rule-hint').textContent = `玩法 · ${currentProblem.ruleHint || currentProblem.description}`; $('#room-badge').style.display = 'inline-flex'; if (isSingle()) $('#connection-status').textContent = '';
    if (waiting) $('#timer-p1').textContent = $('#timer-p2').textContent = '--';
    renderBoard(); updateTurnDisplay();
}

async function createRoom() {
    if (!selectedRule) return toast('请先选择一个规则', 'error');
    const button = $('#create-room-btn'); button.disabled = true; button.textContent = '正在创建…';
    try {
        currentProblem = buildProblem(PROBLEMS.find(item => item.id === selectedRule)); gameEngine = createEngine(currentProblem);
        const result = await roomClient.create(selectedRule, currentProblem, gameEngine.getState());
        myPlayerNumber = 1; myRoomCode = result.room.roomCode; roomVersion = result.room.version; multiplayerStarted = false;
        openGameRoom(true); $('#room-badge').textContent = myRoomCode; $('#turn-indicator').textContent = '等待朋友加入房间…'; $('#connection-status').textContent = '● 已连接';
        addLog(`房间 ${myRoomCode} 已创建，点击房间号即可复制。`); clearInterval(timerInterval); $('#timer-p1').textContent = $('#timer-p2').textContent = '--';
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = false; button.textContent = '🏠 创建房间'; }
}
async function joinRoom() {
    const roomCode = $('#room-code-input').value.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(roomCode)) return toast('请输入6位房间号', 'error');
    try {
        const result = await roomClient.join(roomCode); myPlayerNumber = 2; myRoomCode = roomCode; roomVersion = result.room.version; multiplayerStarted = true;
        currentProblem = result.room.setup; gameEngine = createEngine(currentProblem); gameEngine.loadState(result.room.state);
        openGameRoom(); $('#room-badge').textContent = roomCode; $('#connection-status').textContent = '● 双方在线'; addLog('成功加入房间，对局开始。'); beginTurn();
    } catch (error) { toast(error.message, 'error'); }
}
function copyRoomCode() {
    if (!myRoomCode || isSingle()) return;
    navigator.clipboard?.writeText(myRoomCode).then(() => toast(`房间号 ${myRoomCode} 已复制`)).catch(() => toast(`房间号：${myRoomCode}`));
}

roomClient.addEventListener('player_joined', event => {
    roomVersion = event.detail.room.version; multiplayerStarted = true; $('#name-p2').textContent = '玩家2'; $('#connection-status').textContent = '● 双方在线';
    addLog('玩家2已加入，对局开始。'); beginTurn();
});
roomClient.addEventListener('state_updated', event => {
    const message = event.detail; roomVersion = message.room.version; gameEngine.loadState(message.room.state); if (message.playerNumber !== myPlayerNumber) addLog(message.description || `玩家${message.playerNumber}完成操作`);
    animateBoard(); renderBoard(); updateTurnDisplay(); resetTimer();
});
roomClient.addEventListener('state_conflict', event => { roomVersion = event.detail.room.version; gameEngine.loadState(event.detail.room.state); renderBoard(); toast('状态已刷新，请重新操作'); });
roomClient.addEventListener('game_finished', event => { roomVersion = event.detail.room.version; gameEngine.loadState(event.detail.room.state); showResult(event.detail.winner, event.detail.reason); });
roomClient.addEventListener('presence', event => { $('#connection-status').textContent = event.detail.connected ? '● 对手已重连' : '○ 对手暂时离线'; addLog(event.detail.connected ? '对手已重新连接。' : '对手连接中断，仍可等待其重连。'); });
roomClient.addEventListener('connection', () => { if (myRoomCode && !isSingle()) $('#connection-status').textContent = '○ 连接已断开'; });

function beginTurn() {
    const preWinner = ['bunny-egg', 'tree-game'].includes(currentProblem.rule) ? gameEngine.checkGameOver() : null;
    if (preWinner !== null) return finishGame(preWinner, '无合法操作');
    renderBoard(); updateTurnDisplay(); startTimer(); if (isSingle() && gameEngine.currentPlayer === 2) aiMove();
}
function finishTurn(description) {
    if (isSingle() && gameEngine.currentPlayer === 2 && description) addLog(description);
    let winner = ['bunny-egg', 'tree-game'].includes(currentProblem.rule) ? null : gameEngine.checkGameOver();
    if (winner === null) { gameEngine.switchPlayer(); winner = gameEngine.checkGameOver(); }
    if (winner !== null) { finishGame(winner, description); return; }
    animateBoard(); renderBoard(); updateTurnDisplay(); resetTimer();
    if (isSingle()) { if (gameEngine.currentPlayer === 2) aiMove(); }
    else { roomClient.send('sync_state', { baseVersion: roomVersion, state: gameEngine.getState(), description }); }
}
function finishGame(winner, reason = '') {
    gameEngine.finished = true; clearInterval(timerInterval);
    if (!isSingle()) roomClient.send('finish_game', { winner, state: gameEngine.getState(), reason });
    showResult(winner, reason);
}
function showResult(winner, reason = '') {
    if (!gameEngine) return; gameEngine.finished = true; clearInterval(timerInterval);
    const tie = winner === 0, mine = winner === myPlayerNumber;
    $('#turn-indicator').textContent = tie ? '🤝 平局' : mine ? '🎉 你赢了！' : '本局结束';
    $('#game-controls').innerHTML = `<div class="result-card pop-in"><div class="result-icon">${tie ? '🤝' : mine ? '🏆' : '🎯'}</div><h2>${tie ? '势均力敌' : mine ? '漂亮的一局！' : isSingle() ? 'AI 赢下本局' : `玩家${winner}获胜`}</h2>${reason ? `<p>${escapeHtml(reason)}</p>` : ''}<button class="btn-primary" onclick="leaveGame()">再来一局</button></div>`;
    addLog(tie ? '本局平局。' : `玩家${winner}获胜。`);
}
function leaveGame() { roomClient.close(true); resetSession(); switchPage('battle'); initBattlePage(); }
function surrender() {
    if (!gameEngine || gameEngine.finished) return; const winner = gameEngine.currentPlayer === myPlayerNumber || isSingle() ? (myPlayerNumber === 1 ? 2 : 1) : gameEngine.currentPlayer;
    finishGame(winner, `玩家${myPlayerNumber || 1}认输`);
}

function renderBoard() {
    if (!gameEngine || !currentProblem) return;
    const board = $('#game-board'), type = currentProblem.boardType;
    if (type === 'grid') renderBunny(board);
    else if (type === 'grid-score') renderWood(board);
    else if (type === 'tree') renderTree(board);
    else if (type === 'graph') renderGraph(board);
    else if (type === 'text-info') renderString(board);
    else renderPiles(board);
}
function stones(amount, limit = 22) { return `${Array.from({ length: Math.min(amount, limit) }, () => '<i class="stone"></i>').join('')}${amount > limit ? `<span class="stone-more">+${amount - limit}</span>` : ''}`; }
function renderPiles(board) {
    if (currentProblem.rule === 'euclid') board.innerHTML = `<div class="number-duel"><div><span>较大数</span><strong>${gameEngine.piles[0]}</strong></div><em>− k ×</em><div><span>较小数</span><strong>${gameEngine.piles[1]}</strong></div></div>`;
    else if (currentProblem.boardType === 'single-row') board.innerHTML = `<div class="bash-row"><div class="board-kicker">剩余石子</div><strong class="hero-number">${gameEngine.piles[0]}</strong><div class="bash-stones">${stones(gameEngine.piles[0], 50)}</div></div>`;
    else board.innerHTML = `<div class="board-row">${gameEngine.piles.map((amount, index) => `<button class="pile ${gameEngine.selectedPile === index ? 'selected' : ''} ${gameEngine.forcedPile === index ? 'forced' : ''}" onclick="selectPile(${index})" ${amount === 0 ? 'disabled' : ''}><span class="pile-label">第${index + 1}堆${gameEngine.forcedPile === index ? ' · 指定' : ''}</span><span class="pile-stones">${stones(amount, 16)}</span><strong class="pile-count">${amount}</strong></button>`).join('')}</div>`;
    renderControls();
}
function renderBunny(board) {
    const legal = new Set(gameEngine.legalBunnyMoves().map(move => move.from.join('-'))), cols = gameEngine.grid[0].length;
    board.innerHTML = `<div class="grid-board" style="grid-template-columns:repeat(${cols},54px)">${gameEngine.grid.flatMap((row, r) => row.map((cell, c) => `<button class="grid-cell ${cell === '.' ? 'empty' : ''} ${legal.has(`${r}-${c}`) && myTurn() ? 'legal' : ''}" onclick="clickBunny(${r},${c})">${cell === 'O' ? '○' : cell === 'X' ? '●' : ''}</button>`)).join('')}</div>`;
    $('#game-controls').innerHTML = myTurn() ? '<div class="waiting-overlay">点击高亮棋子，将它滑入空格</div>' : '<div class="waiting-overlay">等待对手移动棋子…</div>';
}
function renderWood(board) {
    const cols = currentProblem.m;
    board.innerHTML = `<div class="score-strip"><span>黑方 <b>${gameEngine.scores.p1}</b></span><span>白方 <b>${gameEngine.scores.p2}</b></span></div><div class="grid-board" style="grid-template-columns:repeat(${cols},58px)">${gameEngine.grid.flatMap((row, r) => row.map((cell, c) => { const available = gameEngine.canPlaceWood(r, c); return `<button class="grid-cell ${cell === null ? available ? 'wood-available' : 'wood-empty' : cell === 1 ? 'wood-black' : 'wood-white'}" onclick="clickWood(${r},${c})"><span class="cell-score">${cell === null ? `${currentProblem.a[r][c]}/${currentProblem.b[r][c]}` : ''}</span>${cell === 1 ? '●' : cell === 2 ? '○' : ''}</button>`; })).join('')}</div>`;
    $('#game-controls').innerHTML = myTurn() ? '<div class="waiting-overlay">选择高亮格落子 · 角标为黑/白得分</div>' : '<div class="waiting-overlay">等待对手落子…</div>';
}
function networkPositions(count) { return Array.from({ length: count }, (_, index) => { const angle = (Math.PI * 2 * index / count) - Math.PI / 2; return { x: 50 + 38 * Math.cos(angle), y: 50 + 38 * Math.sin(angle) }; }); }
function networkMarkup(edges, count, nodeContent, clickHandler, legal = []) {
    const positions = networkPositions(count), legalSet = new Set(legal);
    const lines = edges.map(([a, b]) => `<line x1="${positions[a - 1].x}" y1="${positions[a - 1].y}" x2="${positions[b - 1].x}" y2="${positions[b - 1].y}"/>`).join('');
    const nodes = positions.map((pos, index) => `<button class="network-node ${legalSet.has(index + 1) ? 'legal' : ''}" style="left:${pos.x}%;top:${pos.y}%" onclick="${clickHandler}(${index + 1})">${nodeContent(index + 1)}</button>`).join('');
    return `<div class="network-board"><svg viewBox="0 0 100 100">${lines}</svg>${nodes}</div>`;
}
function renderTree(board) {
    const n = gameEngine.tree.pieces.length, selected = gameEngine.selectedCell, moves = gameEngine.legalTreeMoves(), legal = selected ? moves.filter(move => move.from === selected).map(move => move.to) : [...new Set(moves.map(move => move.from))];
    board.innerHTML = `${networkMarkup(gameEngine.tree.edges, n, node => `<small>${node}</small><b>${gameEngine.tree.pieces[node - 1]}</b>`, 'clickTreeNode', myTurn() ? legal : [])}<div class="board-caption">根节点 ${gameEngine.tree.root} · 节点数字下方为棋子数</div>`;
    $('#game-controls').innerHTML = myTurn() ? `<div class="waiting-overlay">${selected ? `已选节点 ${selected}，请选择它的后代节点` : '先选择有棋子的节点，再选择后代节点'}</div>` : '<div class="waiting-overlay">等待对手移动棋子…</div>';
}
function renderGraph(board) {
    const legal = myTurn() ? gameEngine.legalTomMoves() : [];
    board.innerHTML = `${networkMarkup(currentProblem.edges, currentProblem.n, node => `<small>${node}</small><b>${node === gameEngine.tom ? '🐱' : ''}${node === gameEngine.jerry ? '🐭' : ''}</b>`, 'clickGraphNode', legal)}<div class="score-strip"><span>🐭 Jerry · 玩家1</span><span>第 ${gameEngine.round}/${gameEngine.maxRounds} 轮</span><span>🐱 Tom · 玩家2</span></div>`;
    $('#game-controls').innerHTML = myTurn() ? `<div class="waiting-overlay">${gameEngine.currentPlayer === 1 ? 'Jerry：选择任一不经过 Tom 的节点' : 'Tom：移动一条边，或原地等待'}</div>` : '<div class="waiting-overlay">等待对手行动…</div>';
}
function renderString(board) {
    const letters = gameEngine.text ? [...gameEngine.text].map((letter, index) => `<span style="--i:${index}">${escapeHtml(letter)}</span>`).join('') : '<em>已清空</em>';
    board.innerHTML = `<div class="score-strip"><span>玩家1 <b>${gameEngine.scores.p1}</b></span><span>玩家2 <b>${gameEngine.scores.p2}</b></span></div><div class="string-board">${letters}</div>`;
    $('#game-controls').innerHTML = myTurn() ? `<div class="prefix-grid">${Array.from({ length: gameEngine.text.length }, (_, index) => { const length = index + 1; return `<button class="prefix-button" onclick="playPrefix(${length})"><span>${escapeHtml(gameEngine.text.slice(0, length))}</span><small>+${gameEngine.prefixOccurrences(length)}</small></button>`; }).join('')}</div>` : '<div class="waiting-overlay">等待对手选择前缀…</div>';
}

function renderControls() {
    const controls = $('#game-controls'); if (!myTurn()) { controls.innerHTML = `<div class="waiting-overlay">${isSingle() ? 'AI 正在思考…' : '等待对手出手…'}</div>`; return; }
    const rule = currentProblem.rule;
    if (rule === 'euclid') { const max = Math.floor(gameEngine.piles[0] / gameEngine.piles[1]); controls.innerHTML = numberControl(`${gameEngine.piles[0]} 减去 ${gameEngine.piles[1]} 的`, max, '倍'); return; }
    if (rule === 'fragmented-nim') {
        const max = gameEngine.piles[gameEngine.forcedPile], projected = gameEngine.piles.map((value, index) => index === gameEngine.forcedPile ? value - 1 : value);
        controls.innerHTML = `<div class="take-controls"><span>从指定的第${gameEngine.forcedPile + 1}堆取</span><input id="take-count" type="number" min="1" max="${max}" value="1"><span>个</span><label>再指定</label><select id="next-pile">${projected.map((value, index) => value > 0 ? `<option value="${index}">第${index + 1}堆</option>` : '').join('')}</select><button class="btn-primary" onclick="makeMove()">确认回合</button></div>`; return;
    }
    if (rule === 'yet-another') {
        controls.innerHTML = `<div class="pick-buttons"><button class="btn-secondary" onclick="selectPile(-1)">所有堆同时减</button></div>${gameEngine.selectedPile !== null ? numberControl('减去', gameEngine.selectedPile === -1 ? Math.min(...gameEngine.piles) : gameEngine.piles[gameEngine.selectedPile], '个') : '<div class="waiting-overlay">选择一堆，或选择全局减</div>'}`; return;
    }
    if (currentProblem.boardType === 'single-row' && gameEngine.selectedPile === null) gameEngine.selectedPile = 0;
    if (rule === 'wythoff' && gameEngine.selectedPile === null) { controls.innerHTML = '<div class="pick-buttons"><button class="btn-secondary" onclick="selectPile(-1)">两堆同时取</button><span>或选择上方一堆</span></div>'; return; }
    if (gameEngine.selectedPile === null) { controls.innerHTML = '<div class="waiting-overlay">请先选择一堆石子</div>'; return; }
    const max = gameEngine.selectedPile === -1 ? Math.min(...gameEngine.piles) : Math.min(gameEngine.piles[gameEngine.selectedPile], currentProblem.maxTake || Infinity);
    controls.innerHTML = numberControl(gameEngine.selectedPile === -1 ? '两堆同时取' : '取走', max, '个');
}
function numberControl(label, max, unit) { return `<div class="take-controls"><span>${label}</span><input id="take-count" type="number" min="1" max="${max}" value="1"><span>${unit}（最多${max}）</span><button class="btn-primary" onclick="makeMove()">确认</button></div>`; }
function selectPile(index) { if (!myTurn() || (index >= 0 && !gameEngine.piles[index])) return; if (currentProblem.rule === 'fragmented-nim') return; gameEngine.selectedPile = gameEngine.selectedPile === index ? null : index; renderBoard(); }
function makeMove() {
    if (!myTurn()) return; const count = Number($('#take-count')?.value); let ok = false, description = '';
    if (currentProblem.rule === 'euclid') { ok = gameEngine.makeEuclidMove(count); description = `玩家${gameEngine.currentPlayer} 减去 ${count} 倍较小数`; }
    else { const pile = currentProblem.rule === 'fragmented-nim' ? gameEngine.forcedPile : gameEngine.selectedPile, nextPile = Number($('#next-pile')?.value); ok = gameEngine.makeMove(pile, count, { nextPile }); description = `玩家${gameEngine.currentPlayer}${pile === -1 ? ' 全局/两堆减' : ` 从第${pile + 1}堆取`} ${count}`; if (ok && currentProblem.rule === 'fragmented-nim' && gameEngine.piles.some(Boolean)) description += `，指定第${nextPile + 1}堆`; }
    if (!ok) return toast('这个操作不符合当前规则', 'error'); addLog(description); finishTurn(description);
}
function clickBunny(row, col) { if (!myTurn() || !gameEngine.makeBunnyMove(row, col)) return; const text = `玩家${gameEngine.currentPlayer} 移动棋子`; addLog(text); finishTurn(text); }
function clickWood(row, col) { if (!myTurn() || !gameEngine.makeWoodMove(row, col)) return; const text = `玩家${gameEngine.currentPlayer} 在 (${row + 1},${col + 1}) 落子`; addLog(text); finishTurn(text); }
function clickTreeNode(node) {
    if (!myTurn()) return; const moves = gameEngine.legalTreeMoves();
    if (gameEngine.selectedCell && moves.some(move => move.from === gameEngine.selectedCell && move.to === node)) { const from = gameEngine.selectedCell; gameEngine.selectedCell = null; gameEngine.makeTreeMove(from, node); const text = `玩家${gameEngine.currentPlayer} 将棋子从节点${from}移到${node}`; addLog(text); finishTurn(text); }
    else { gameEngine.selectedCell = moves.some(move => move.from === node) ? node : null; renderBoard(); }
}
function clickGraphNode(node) { if (!myTurn() || !gameEngine.makeTomMove(node)) return; const role = gameEngine.currentPlayer === 1 ? 'Jerry' : 'Tom', text = `${role} 移动到节点${node}`; addLog(text); finishTurn(text); }
function playPrefix(length) { if (!myTurn()) return; const gain = gameEngine.prefixOccurrences(length); if (!gameEngine.makeStringMove(length)) return; const text = `玩家${gameEngine.currentPlayer} 删除长度${length}的前缀，获得${gain}分`; addLog(text); finishTurn(text); }

function aiMove() {
    if (!gameEngine || gameEngine.finished || gameEngine.currentPlayer !== 2) return;
    $('#turn-indicator').textContent = 'AI 正在推演…'; setTimeout(() => {
        if (!gameEngine || gameEngine.finished || gameEngine.currentPlayer !== 2) return;
        const rule = currentProblem.rule;
        if (['bash', 'nim', 'wythoff', 'fragmented-nim', 'yet-another'].includes(rule)) aiPileMove();
        else if (rule === 'euclid') { const move = selectedDifficulty === 'hard' && GameSolvers.euclid(gameEngine.piles) || { k: 1 }; gameEngine.makeEuclidMove(move.k); finishTurn(`AI 减去 ${move.k} 倍较小数`); }
        else if (rule === 'bunny-egg') { const moves = gameEngine.legalBunnyMoves(), move = moves[Math.floor(Math.random() * moves.length)]; if (move) gameEngine.makeBunnyMove(...move.from); finishTurn('AI 移动棋子'); }
        else if (rule === 'wood-chess') aiWood();
        else if (rule === 'tree-game') { const moves = gameEngine.legalTreeMoves(), move = selectedDifficulty === 'hard' ? moves.at(-1) : moves[Math.floor(Math.random() * moves.length)]; if (move) gameEngine.makeTreeMove(move.from, move.to); finishTurn(`AI 将棋子移到节点${move?.to}`); }
        else if (rule === 'tom-jerry') aiTom();
        else if (rule === 'string-game') { const length = selectedDifficulty === 'hard' ? GameSolvers.stringMove(gameEngine.text).length : Math.floor(Math.random() * gameEngine.text.length) + 1; const gain = gameEngine.prefixOccurrences(length); gameEngine.makeStringMove(length); finishTurn(`AI 删除长度${length}的前缀，获得${gain}分`); }
    }, 520);
}
function aiPileMove() {
    const rule = currentProblem.rule; let move;
    if (rule === 'bash') { const remainder = gameEngine.piles[0] % (currentProblem.maxTake + 1); move = { pileIndex: 0, count: remainder || 1 }; }
    else if (rule === 'wythoff') move = GameSolvers.wythoff(gameEngine.piles);
    else if (rule === 'yet-another') move = GameSolvers.subtraction(gameEngine.piles, true);
    else if (rule === 'fragmented-nim') move = { pileIndex: gameEngine.forcedPile, count: selectedDifficulty === 'hard' ? Math.max(1, gameEngine.piles[gameEngine.forcedPile] - 1) : 1 };
    else move = GameSolvers.nim(gameEngine.piles);
    if (!move) { move = { pileIndex: gameEngine.piles.findIndex(Boolean), count: 1 }; }
    if (rule === 'fragmented-nim') { const next = gameEngine.piles.map((value, index) => index === move.pileIndex ? value - move.count : value); const candidates = next.map((value, index) => value > 0 ? index : -1).filter(index => index >= 0); gameEngine.makeMove(move.pileIndex, move.count, { nextPile: candidates[0] }); }
    else gameEngine.makeMove(move.pileIndex, move.count);
    finishTurn(`AI ${move.pileIndex === -1 ? '同时减少各堆' : `从第${move.pileIndex + 1}堆取走`} ${move.count}`);
}
function aiWood() {
    const moves = []; for (let r = 0; r < currentProblem.n; r++) for (let c = 0; c < currentProblem.m; c++) if (gameEngine.canPlaceWood(r, c)) moves.push({ r, c, score: currentProblem.b[r][c] });
    moves.sort((a, b) => b.score - a.score); const move = selectedDifficulty === 'hard' ? moves[0] : moves[Math.floor(Math.random() * moves.length)]; if (move) gameEngine.makeWoodMove(move.r, move.c); finishTurn(`AI 在 (${move?.r + 1},${move?.c + 1}) 落子`);
}
function shortestDistance(start, target) { const graph = gameEngine.graph(), seen = new Set([start]), queue = [[start, 0]]; for (let i = 0; i < queue.length; i++) { const [node, distance] = queue[i]; if (node === target) return distance; for (const next of graph[node]) if (!seen.has(next)) { seen.add(next); queue.push([next, distance + 1]); } } return Infinity; }
function aiTom() { const moves = gameEngine.legalTomMoves(); moves.sort((a, b) => shortestDistance(a, gameEngine.jerry) - shortestDistance(b, gameEngine.jerry)); const target = selectedDifficulty === 'hard' ? moves[0] : moves[Math.floor(Math.random() * moves.length)]; gameEngine.makeTomMove(target); finishTurn(`Tom 移动到节点${target}`); }

function startTimer() {
    clearInterval(timerInterval); if (!gameEngine || gameEngine.finished || (!isSingle() && !multiplayerStarted)) return;
    timeLeft = currentProblem.timeLimit || 60; updateTimerDisplay();
    timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) handleTimeout(); }, 1000);
}
function resetTimer() { startTimer(); }
function updateTimerDisplay() {
    [1, 2].forEach(player => { const element = $(`#timer-p${player}`); if (!element) return; element.textContent = player === gameEngine.currentPlayer ? timeLeft : '--'; element.classList.toggle('danger', player === gameEngine.currentPlayer && timeLeft <= 10); });
}
function handleTimeout() {
    clearInterval(timerInterval); if (!isSingle() && gameEngine.currentPlayer !== myPlayerNumber) return;
    const loser = gameEngine.currentPlayer, winner = loser === 1 ? 2 : 1; finishGame(winner, `玩家${loser}超时`);
}
function updateTurnDisplay() {
    if (!gameEngine) return; $('#panel-p1').classList.toggle('active-turn', gameEngine.currentPlayer === 1); $('#panel-p2').classList.toggle('active-turn', gameEngine.currentPlayer === 2);
    $('#turn-indicator').textContent = myTurn() ? '轮到你 · 选择行动' : isSingle() ? 'AI 正在思考…' : multiplayerStarted ? '等待对手行动…' : '等待朋友加入房间…';
}
function addLog(message) { const log = $('#log-list'); if (!log) return; const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); log.insertAdjacentHTML('beforeend', `<div class="log-item"><time>${time}</time><span>${escapeHtml(message)}</span></div>`); log.scrollTop = log.scrollHeight; }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = String(value); return element.innerHTML; }
function animateBoard() { const board = $('#game-board'); board?.classList.remove('board-update'); requestAnimationFrame(() => board?.classList.add('board-update')); }

async function tryResumeRoom() {
    try {
        const result = await roomClient.resume(); if (!result) return;
        myPlayerNumber = result.playerNumber; myRoomCode = result.room.roomCode; roomVersion = result.room.version; multiplayerStarted = result.room.status === 'playing';
        currentProblem = result.room.setup; gameEngine = createEngine(currentProblem); gameEngine.loadState(result.room.state);
        switchPage('battle'); openGameRoom(!multiplayerStarted); $('#room-badge').textContent = myRoomCode; $('#connection-status').textContent = '● 已恢复房间'; addLog('已恢复上次房间。'); if (result.room.status === 'finished') showResult(result.room.winner, result.room.reason); else if (multiplayerStarted) beginTurn();
    } catch { sessionStorage.removeItem('baba-room'); }
}

loadTheme(); renderProblems(); initBattlePage(); switchPage('home'); tryResumeRoom();
