// 初始化 Supabase 客户端
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== 全局状态 ====================
let currentPage = 'home';
let myPlayerNumber = null;
let myRoomCode = null;
let gameEngine = null;
let currentProblem = null;
let timerInterval = null;
let timeLeft = 0;
let channel = null;

// ==================== 页面切换 ====================
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(page).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    currentPage = page;

    if (page === 'problems') renderProblems();
    if (page === 'battle') renderProblemSelect();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        switchPage(this.getAttribute('data-page'));
    });
});

// ==================== 题库渲染 ====================
function renderProblems() {
    const grid = document.getElementById('problem-grid');
    grid.innerHTML = PROBLEMS.map(p => `
        <div class="problem-card" onclick="selectProblem('${p.id}')">
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <span class="diff diff-${p.difficulty}">${p.difficulty === 'easy' ? '简单' : p.difficulty === 'medium' ? '中等' : '困难'}</span>
        </div>
    `).join('');
}

function renderProblemSelect() {
    const select = document.getElementById('problem-select');
    select.innerHTML = PROBLEMS.map(p =>
        `<option value="${p.id}">${p.name} (${p.difficulty === 'easy' ? '简单' : p.difficulty === 'medium' ? '中等' : '困难'})</option>`
    ).join('');
}

function selectProblem(problemId) {
    document.getElementById('problem-select').value = problemId;
    switchPage('battle');
}

// ==================== 房间管理 ====================
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom() {
    const problemId = document.getElementById('problem-select').value;
    const problem = PROBLEMS.find(p => p.id === problemId);
    const roomCode = generateRoomCode();

    const { error } = await supabaseClient
        .from('rooms')
        .insert({
            room_code: roomCode,
            problem_id: problemId,
            game_state: { piles: [...problem.piles], currentPlayer: 1, moveHistory: [] },
            current_turn: 'player1',
            player1_name: '玩家1',
            player2_name: '玩家2',
            status: 'waiting',
        });

    if (error) {
        alert('创建房间失败: ' + error.message);
        return;
    }

    myRoomCode = roomCode;
    myPlayerNumber = 1;
    currentProblem = problem;

    enterGameRoom(roomCode, problem);
    subscribeToRoom(roomCode);
    alert(`房间创建成功！\n房间号: ${roomCode}\n\n请把房间号发给对手加入。`);
}

async function joinRoom() {
    const roomCode = document.getElementById('room-code-input').value.toUpperCase();
    if (!roomCode) return alert('请输入房间号');

    const { data: room, error } = await supabaseClient
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

    if (error || !room) {
        alert('房间不存在！请检查房间号。');
        return;
    }

    if (room.status !== 'waiting') {
        alert('房间已开始对战，请创建新房间。');
        return;
    }

    myRoomCode = roomCode;
    myPlayerNumber = 2;
    currentProblem = PROBLEMS.find(p => p.id === room.problem_id);

    await supabaseClient.from('rooms').update({ status: 'playing' }).eq('room_code', roomCode);

    enterGameRoom(roomCode, currentProblem);
    subscribeToRoom(roomCode);

    await channel.send({
        type: 'game_start',
        problem: currentProblem
    });
}

async function subscribeToRoom(roomCode) {
    channel = supabaseClient.channel(`room:${roomCode}`);

    channel
        .on('broadcast', { event: 'move' }, (payload) => handleRemoteMove(payload.payload))
        .on('broadcast', { event: 'game_start' }, (payload) => handleGameStart(payload.payload))
        .on('broadcast', { event: 'game_over' }, (payload) => handleGameOver(payload.payload))
        .subscribe();
}

// ==================== 游戏房间 UI ====================
function enterGameRoom(roomCode, problem) {
    document.getElementById('room-lobby').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
    document.getElementById('room-badge').textContent = roomCode;
    document.getElementById('name-p1').textContent = myPlayerNumber === 1 ? '你 (玩家1)' : '玩家1';
    document.getElementById('name-p2').textContent = myPlayerNumber === 2 ? '你 (玩家2)' : '玩家2';

    gameEngine = new GameEngine(problem);
    renderBoard();
    updateTurnDisplay();
    startTimer();
}

function renderBoard() {
    const board = document.getElementById('game-board');
    const piles = gameEngine.piles;

    board.innerHTML = `<div class="board-row">` + piles.map((count, i) => `
        <div class="pile ${gameEngine.selectedPile === i ? 'selected' : ''}"
             onclick="selectPile(${i})" data-pile="${i}">
            <div class="pile-stones">
                ${Array(count).fill(0).map(() => '<div class="stone"></div>').join('')}
            </div>
            <div class="pile-count">${count}</div>
        </div>
    `).join('') + `</div>`;

    renderControls();
}

function renderControls() {
    const controls = document.getElementById('game-controls');
    const isMyTurn = gameEngine.currentPlayer === myPlayerNumber;

    if (!isMyTurn) {
        controls.innerHTML = `<div class="waiting-overlay">⏳ 等待对手出手...</div>`;
        return;
    }

    if (gameEngine.selectedPile === null) {
        controls.innerHTML = `<div class="waiting-overlay">👆 请先点击选择一堆石子</div>`;
        return;
    }

    const pileCount = gameEngine.piles[gameEngine.selectedPile];
    let maxTake = pileCount;
    if (currentProblem.rule === 'bash' && currentProblem.maxTake) {
        maxTake = Math.min(pileCount, currentProblem.maxTake);
    }

    controls.innerHTML = `
        <div class="take-controls">
            <span>取走</span>
            <input type="number" id="take-count" min="1" max="${maxTake}" value="1">
            <span>个石子（最多${maxTake}个）</span>
            <button class="btn-primary" onclick="makeMove()">✅ 确认</button>
        </div>
    `;
}

function selectPile(index) {
    if (gameEngine.currentPlayer !== myPlayerNumber) return;
    if (gameEngine.piles[index] === 0) return;

    gameEngine.selectedPile = gameEngine.selectedPile === index ? null : index;
    renderBoard();
}

async function makeMove() {
    if (gameEngine.currentPlayer !== myPlayerNumber) return;
    if (gameEngine.selectedPile === null) return;

    const count = parseInt(document.getElementById('take-count').value);
    const pileIndex = gameEngine.selectedPile;

    if (!gameEngine.isValidMove(pileIndex, count)) {
        alert('非法操作！');
        return;
    }

    gameEngine.makeMove(pileIndex, count);
    addLog(`玩家${myPlayerNumber} 从第${pileIndex + 1}堆取走${count}个石子`);

    await channel.send({
        type: 'move',
        payload: {
            pileIndex,
            count,
            state: gameEngine.getState()
        }
    });

    await supabaseClient.from('moves').insert({
        room_code: myRoomCode,
        player: `player${myPlayerNumber}`,
        move_data: { pileIndex, count }
    });

    const winner = gameEngine.checkGameOver();
    if (winner) {
        endGame(winner);
        return;
    }

    gameEngine.switchPlayer();
    renderBoard();
    updateTurnDisplay();
    resetTimer();
}

function handleRemoteMove(payload) {
    gameEngine.loadState(payload.state);
    gameEngine.selectedPile = null;
    addLog(`玩家${gameEngine.currentPlayer === 1 ? 2 : 1} 从第${payload.pileIndex + 1}堆取走${payload.count}个石子`);

    const winner = gameEngine.checkGameOver();
    if (winner) {
        endGame(winner);
        return;
    }

    gameEngine.switchPlayer();
    renderBoard();
    updateTurnDisplay();
    resetTimer();
}

function handleGameStart(payload) {
    currentProblem = payload.problem;
    gameEngine = new GameEngine(currentProblem);
    renderBoard();
    updateTurnDisplay();
    resetTimer();
}

function handleGameOver(payload) {
    endGame(payload.winner);
}

function endGame(winner) {
    clearInterval(timerInterval);

    const isMe = winner === myPlayerNumber;
    document.getElementById('turn-indicator').textContent = isMe ? '🎉 你赢了！' : '😢 你输了！';
    document.getElementById('game-controls').innerHTML = `
        <div style="text-align:center;padding:20px;">
            <h2>${isMe ? '🎉 恭喜获胜！' : '😢 败北！'}</h2>
            <button class="btn-primary" onclick="location.reload()">🔄 再来一局</button>
        </div>
    `;

    channel.send({
        type: 'game_over',
        payload: { winner }
    });

    supabaseClient.from('rooms').update({ status: 'finished', winner: `player${winner}` }).eq('room_code', myRoomCode);
}

// ==================== 计时器 ====================
function startTimer() {
    timeLeft = currentProblem.timeLimit;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    startTimer();
}

function updateTimerDisplay() {
    const timerId = gameEngine.currentPlayer === 1 ? 'timer-p1' : 'timer-p2';
    const el = document.getElementById(timerId);
    el.textContent = timeLeft;
    if (timeLeft <= 10) el.classList.add('danger');
    else el.classList.remove('danger');
}

function handleTimeout() {
    const loser = gameEngine.currentPlayer;
    const winner = loser === 1 ? 2 : 1;
    addLog(`⏰ 玩家${loser} 超时！玩家${winner} 获胜！`);
    endGame(winner);
}

function updateTurnDisplay() {
    const indicator = document.getElementById('turn-indicator');
    const isMyTurn = gameEngine.currentPlayer === myPlayerNumber;

    document.getElementById('panel-p1').classList.toggle('active-turn', gameEngine.currentPlayer === 1);
    document.getElementById('panel-p2').classList.toggle('active-turn', gameEngine.currentPlayer === 2);

    indicator.textContent = isMyTurn ? '⚡ 轮到你出手！' : '⏳ 等待对手...';
}

function addLog(msg) {
    const log = document.getElementById('log-list');
    const time = new Date().toLocaleTimeString();
    log.innerHTML += `<div class="log-item">[${time}] ${msg}</div>`;
    log.scrollTop = log.scrollHeight;
}

// ==================== 初始化 ====================
switchPage('home');
renderProblemSelect();
