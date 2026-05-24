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
            player2_name: '等待中...',
            status: 'waiting',
        });

    if (error) {
        alert('创建房间失败: ' + error.message);
        return;
    }

    myRoomCode = roomCode;
    myPlayerNumber = 1;
    currentProblem = problem;

    // 显示等待界面
    document.getElementById('room-lobby').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
    document.getElementById('room-badge').textContent = roomCode;
    document.getElementById('name-p1').textContent = '你 (玩家1)';
    document.getElementById('name-p2').textContent = '等待加入...';
    document.getElementById('game-board').innerHTML = '';
    document.getElementById('game-controls').innerHTML = '';
    document.getElementById('turn-indicator').textContent = '等待对手加入...';
    document.getElementById('timer-p1').textContent = '--';
    document.getElementById('timer-p2').textContent = '--';
    document.getElementById('log-list').innerHTML = '';

    alert(`房间创建成功！\n房间号: ${roomCode}\n\n请把房间号发给对手加入。`);

    // 轮询检测对手是否加入
    const checkInterval = setInterval(async () => {
        const { data: room } = await supabaseClient
            .from('rooms')
            .select('status, player2_name')
            .eq('room_code', roomCode)
            .single();

        if (room && room.status === 'playing') {
            clearInterval(checkInterval);
            document.getElementById('name-p2').textContent = '玩家2';
            subscribeToRoom(roomCode);
            enterGameRoom(roomCode, currentProblem);
            addLog('对手已加入！游戏开始！');
            document.getElementById('turn-indicator').textContent = '⚡ 轮到你出手！';
        }
    }, 1000);
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

    await supabaseClient.from('rooms').update({
        status: 'playing',
        player2_name: '玩家2'
    }).eq('room_code', roomCode);

    subscribeToRoom(roomCode);
    enterGameRoom(roomCode, currentProblem);
}

// ==================== 单人模式 ====================
async function startSinglePlayer() {
    const problemId = document.getElementById('problem-select').value;
    currentProblem = PROBLEMS.find(p => p.id === problemId);
    myRoomCode = 'single-' + Date.now();
    myPlayerNumber = 1;

    document.getElementById('room-lobby').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
    document.getElementById('room-badge').textContent = '单人模式';
    document.getElementById('name-p1').textContent = '你';
    document.getElementById('name-p2').textContent = '🤖 AI';
    document.getElementById('log-list').innerHTML = '';

    gameEngine = new GameEngine(currentProblem);
    renderBoard();
    updateTurnDisplaySingle();
    startTimer();
    addLog('单人模式开始！你是先手。');
}

function updateTurnDisplaySingle() {
    const indicator = document.getElementById('turn-indicator');
    const isMyTurn = gameEngine.currentPlayer === 1;

    document.getElementById('panel-p1').classList.toggle('active-turn', isMyTurn);
    document.getElementById('panel-p2').classList.toggle('active-turn', !isMyTurn);

    indicator.textContent = isMyTurn ? '⚡ 轮到你出手！' : '🤖 AI 思考中...';
}

function aiMove() {
    if (gameEngine.currentPlayer !== 2) return;

    const nonEmptyPiles = [];
    gameEngine.piles.forEach((count, i) => {
        if (count > 0) nonEmptyPiles.push(i);
    });

    if (nonEmptyPiles.length === 0) return;

    const pileIndex = nonEmptyPiles[Math.floor(Math.random() * nonEmptyPiles.length)];
    let maxTake = gameEngine.piles[pileIndex];
    if (currentProblem.rule === 'bash' && currentProblem.maxTake) {
        maxTake = Math.min(maxTake, currentProblem.maxTake);
    }

    const count = Math.floor(Math.random() * maxTake) + 1;

    setTimeout(() => {
        gameEngine.makeMove(pileIndex, count);
        addLog(`🤖 AI 从第${pileIndex + 1}堆取走${count}个石子`);

        const winner = gameEngine.checkGameOver();
        if (winner) {
            endGameSingle(winner);
            return;
        }

        gameEngine.switchPlayer();
        renderBoard();
        updateTurnDisplaySingle();
        resetTimer();
    }, 800 + Math.random() * 1200);
}

function endGameSingle(winner) {
    clearInterval(timerInterval);

    const isMeWin = winner === 1;
    document.getElementById('turn-indicator').textContent = isMeWin ? '🎉 你赢了！' : '😢 AI 赢了！';
    document.getElementById('game-controls').innerHTML = `
        <div style="text-align:center;padding:20px;">
            <h2>${isMeWin ? '🎉 恭喜获胜！' : '😢 败北！'}</h2>
            <button class="btn-primary" onclick="location.reload()">🔄 再来一局</button>
        </div>
    `;
}

// ==================== Realtime 订阅 ====================
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

    // 单人模式且轮到AI
    if (myRoomCode && myRoomCode.startsWith('single-') && gameEngine.currentPlayer === 2) {
        controls.innerHTML = `<div class="waiting-overlay">🤖 AI 思考中...</div>`;
        return;
    }

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
    if (myRoomCode && myRoomCode.startsWith('single-')) {
        if (gameEngine.currentPlayer !== 1) return;
    } else {
        if (gameEngine.currentPlayer !== myPlayerNumber) return;
    }
    if (gameEngine.piles[index] === 0) return;

    gameEngine.selectedPile = gameEngine.selectedPile === index ? null : index;
    renderBoard();
}

async function makeMove() {
    const isSingle = myRoomCode && myRoomCode.startsWith('single-');

    if (!isSingle && gameEngine.currentPlayer !== myPlayerNumber) return;
    if (isSingle && gameEngine.currentPlayer !== 1) return;
    if (gameEngine.selectedPile === null) return;

    const count = parseInt(document.getElementById('take-count').value);
    const pileIndex = gameEngine.selectedPile;

    if (!gameEngine.isValidMove(pileIndex, count)) {
        alert('非法操作！');
        return;
    }

    gameEngine.makeMove(pileIndex, count);
    addLog(`${isSingle ? '你' : '玩家' + myPlayerNumber} 从第${pileIndex + 1}堆取走${count}个石子`);

    // 联机模式：广播操作
    if (!isSingle && channel) {
        await channel.send({
            type: 'move',
            payload: { pileIndex, count, state: gameEngine.getState() }
        });

        await supabaseClient.from('moves').insert({
            room_code: myRoomCode,
            player: `player${myPlayerNumber}`,
            move_data: { pileIndex, count }
        });
    }

    // 检查游戏结束
    const winner = gameEngine.checkGameOver();
    if (winner) {
        if (isSingle) {
            endGameSingle(winner);
        } else {
            endGame(winner);
        }
        return;
    }

    gameEngine.switchPlayer();
    renderBoard();

    if (isSingle) {
        updateTurnDisplaySingle();
        resetTimer();
        // AI 回合
        if (gameEngine.currentPlayer === 2) {
            aiMove();
        }
    } else {
        updateTurnDisplay();
        resetTimer();
    }
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

    if (channel) {
        channel.send({ type: 'game_over', payload: { winner } });
    }

    supabaseClient.from('rooms').update({ status: 'finished', winner: `player${winner}` }).eq('room_code', myRoomCode);
}

// ==================== 计时器 ====================
function startTimer() {
    timeLeft = currentProblem.timeLimit;
    updateTimerDisplay();
    clearInterval(timerInterval);
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
    const isSingle = myRoomCode && myRoomCode.startsWith('single-');
    const currentPlayer = gameEngine.currentPlayer;
    const timerId = currentPlayer === 1 ? 'timer-p1' : 'timer-p2';
    const el = document.getElementById(timerId);
    el.textContent = timeLeft;
    if (timeLeft <= 10) el.classList.add('danger');
    else el.classList.remove('danger');

    // 单人模式：隐藏非当前玩家的计时器
    if (isSingle) {
        const otherId = currentPlayer === 1 ? 'timer-p2' : 'timer-p1';
        document.getElementById(otherId).textContent = '--';
    }
}

function handleTimeout() {
    const loser = gameEngine.currentPlayer;
    const winner = loser === 1 ? 2 : 1;
    addLog(`⏰ 玩家${loser} 超时！玩家${winner} 获胜！`);

    if (myRoomCode && myRoomCode.startsWith('single-')) {
        endGameSingle(winner);
    } else {
        endGame(winner);
    }
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