// 初始化 Supabase 客户端
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cloudflare Worker AI 地址
const AI_WORKER_URL = 'https://green-river-5b45.2560349809.workers.dev/';

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
    addLog(`【${currentProblem.name}】单人模式开始！你是先手。`);
}

// ========== AI 辅助函数 ==========
function getMaxPileIndex() {
    let maxIdx = 0;
    for (let i = 1; i < gameEngine.piles.length; i++) {
        if (gameEngine.piles[i] > gameEngine.piles[maxIdx]) maxIdx = i;
    }
    return maxIdx;
}

function getMaxTake(pileIndex) {
    let max = gameEngine.piles[pileIndex];
    if (currentProblem.maxTake) max = Math.min(max, currentProblem.maxTake);
    return max;
}

function getBashBestMove() {
    const total = gameEngine.piles[0];
    const m = currentProblem.maxTake;
    const remainder = total % (m + 1);
    if (remainder !== 0 && remainder <= m) {
        return { pileIndex: 0, count: remainder };
    }
    return null;
}

function getNimBestMove() {
    let nimSum = 0;
    gameEngine.piles.forEach(c => nimSum ^= c);
    if (nimSum === 0) return null;

    for (let i = 0; i < gameEngine.piles.length; i++) {
        const target = gameEngine.piles[i] ^ nimSum;
        if (target < gameEngine.piles[i]) {
            return { pileIndex: i, count: gameEngine.piles[i] - target };
        }
    }
    return null;
}

async function aiMove() {
    if (gameEngine.currentPlayer !== 2) return;

    const nonEmptyPiles = [];
    gameEngine.piles.forEach((count, i) => {
        if (count > 0) nonEmptyPiles.push(i);
    });
    if (nonEmptyPiles.length === 0) return;

    document.getElementById('turn-indicator').textContent = '🤖 AI 思考中...';
    document.getElementById('game-controls').innerHTML = '<div class="waiting-overlay">🤖 AI 思考中...</div>';

    let rulesText = '';
    if (currentProblem.rule === 'bash') {
        rulesText = `巴什博弈：只有1堆石子，每次取1~${currentProblem.maxTake}个，取走最后一个获胜。`;
    } else if (currentProblem.rule === 'nim') {
        rulesText = `Nim游戏：有${gameEngine.piles.length}堆石子，每次从任意一堆取任意数量（至少1个），取走最后一个获胜。`;
    } else if (currentProblem.rule === 'wythoff') {
        rulesText = `威佐夫博弈：有2堆石子，每次可以从一堆取任意数量，或从两堆取相同数量，取走最后一个获胜。`;
    }

    const prompt = `你是一个博弈论高手。现在正在进行${currentProblem.name}。

规则：${rulesText}

当前局面：${gameEngine.piles.map((c, i) => `第${i + 1}堆: ${c}个`).join('，')}

轮到你出手。请选择最优策略。
请只回复JSON格式：{"pile": 堆号(从1开始), "count": 取走数量}${currentProblem.rule === 'wythoff' ? ' 或 {"pile": 0, "count": N} 表示两堆同时取N个' : ''}
不要回复其他内容。`;

    try {
        const response = await fetch(AI_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        const content = data.content || '';

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI返回格式错误');

        const move = JSON.parse(jsonMatch[0]);
        let pileIndex = move.pile - 1;
        let count = move.count;

        if (pileIndex === -1 && currentProblem.rule === 'wythoff') {
            count = Math.max(1, Math.min(count, gameEngine.piles[0], gameEngine.piles[1]));
        } else {
            if (pileIndex < 0 || pileIndex >= gameEngine.piles.length) {
                pileIndex = getMaxPileIndex();
            }
            count = Math.max(1, Math.min(count, gameEngine.piles[pileIndex]));
            if (currentProblem.maxTake) count = Math.min(count, currentProblem.maxTake);
        }

        setTimeout(() => {
            if (pileIndex === -1) {
                gameEngine.piles[0] -= count;
                gameEngine.piles[1] -= count;
                gameEngine.moveHistory.push({ player: 2, pileIndex: -1, count, pilesAfter: [...gameEngine.piles] });
                addLog(`🤖 AI 从两堆同时取走${count}个石子`);
            } else {
                gameEngine.makeMove(pileIndex, count);
                addLog(`🤖 AI 从第${pileIndex + 1}堆取走${count}个石子`);
            }

            const winner = gameEngine.checkGameOver();
            if (winner) { endGameSingle(winner); return; }

            gameEngine.switchPlayer();
            renderBoard();
            updateTurnDisplaySingle();
            resetTimer();
        }, 800);

    } catch (err) {
        console.error('AI调用失败，使用本地策略:', err);
        addLog('⚠️ AI 断线，使用本地策略');
        fallbackAiMove();
    }
}

function fallbackAiMove() {
    const nonEmptyPiles = [];
    gameEngine.piles.forEach((count, i) => { if (count > 0) nonEmptyPiles.push(i); });

    let pileIndex, count;
    let bestMove = null;
    if (currentProblem.rule === 'bash') bestMove = getBashBestMove();
    else if (currentProblem.rule === 'nim') bestMove = getNimBestMove();

    if (bestMove && Math.random() < 0.8) {
        pileIndex = bestMove.pileIndex;
        count = bestMove.count;
    } else {
        pileIndex = nonEmptyPiles[Math.floor(Math.random() * nonEmptyPiles.length)];
        count = Math.floor(Math.random() * getMaxTake(pileIndex)) + 1;
    }

    count = Math.max(1, Math.min(count, gameEngine.piles[pileIndex]));
    if (currentProblem.maxTake) count = Math.min(count, currentProblem.maxTake);

    setTimeout(() => {
        gameEngine.makeMove(pileIndex, count);
        addLog(`🤖 AI 从第${pileIndex + 1}堆取走${count}个石子`);

        const winner = gameEngine.checkGameOver();
        if (winner) { endGameSingle(winner); return; }

        gameEngine.switchPlayer();
        renderBoard();
        updateTurnDisplaySingle();
        resetTimer();
    }, 800);
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

// ==================== Realtime ====================
async function subscribeToRoom(roomCode) {
    channel = supabaseClient.channel(`room:${roomCode}`);
    channel
        .on('broadcast', { event: 'move' }, (payload) => handleRemoteMove(payload.payload))
        .on('broadcast', { event: 'game_start' }, (payload) => handleGameStart(payload.payload))
        .on('broadcast', { event: 'game_over' }, (payload) => handleGameOver(payload.payload))
        .subscribe();
}

// ==================== 游戏房间 ====================
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
    const boardType = currentProblem.boardType || 'multi-pile';
    const piles = gameEngine.piles;

    switch (boardType) {
        case 'single-row':
            board.innerHTML = `
                <div class="bash-row">
                    <div class="bash-label">石子总数：<strong>${piles[0]}</strong></div>
                    <div class="bash-stones">
                        ${Array(piles[0]).fill(0).map(() => '<div class="stone stone-big"></div>').join('')}
                    </div>
                </div>
            `;
            break;

        case 'wythoff':
            board.innerHTML = `
                <div class="board-row">
                    ${piles.map((count, i) => `
                        <div class="pile ${gameEngine.selectedPile === i ? 'selected' : ''}"
                             onclick="selectPile(${i})">
                            <div class="pile-label">第${i + 1}堆</div>
                            <div class="pile-stones">
                                ${Array(count).fill(0).map(() => '<div class="stone"></div>').join('')}
                            </div>
                            <div class="pile-count">${count}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="text-align:center;margin-top:12px;">
                    <button class="btn-secondary btn-sm" onclick="selectBothPiles()">
                        🎯 从两堆同时取（相同数量）
                    </button>
                </div>
            `;
            break;

        case 'multi-pile':
        default:
            board.innerHTML = `
                <div class="board-row">
                    ${piles.map((count, i) => `
                        <div class="pile ${gameEngine.selectedPile === i ? 'selected' : ''}"
                             onclick="selectPile(${i})">
                            <div class="pile-label">第${i + 1}堆</div>
                            <div class="pile-stones">
                                ${Array(count).fill(0).map(() => '<div class="stone"></div>').join('')}
                            </div>
                            <div class="pile-count">${count}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
    }

    renderControls();
}

function selectBothPiles() {
    if (myRoomCode && myRoomCode.startsWith('single-') && gameEngine.currentPlayer !== 1) return;
    if (!myRoomCode.startsWith('single-') && gameEngine.currentPlayer !== myPlayerNumber) return;

    gameEngine.selectedPile = -1;
    renderBoard();
}

function renderControls() {
    const controls = document.getElementById('game-controls');
    const isSingle = myRoomCode && myRoomCode.startsWith('single-');

    if (isSingle && gameEngine.currentPlayer === 2) {
        controls.innerHTML = `<div class="waiting-overlay">🤖 AI 思考中...</div>`;
        return;
    }

    if (!isSingle && gameEngine.currentPlayer !== myPlayerNumber) {
        controls.innerHTML = `<div class="waiting-overlay">⏳ 等待对手出手...</div>`;
        return;
    }

    if (gameEngine.selectedPile === null) {
        controls.innerHTML = `<div class="waiting-overlay">👆 请先点击选择一堆石子</div>`;
        return;
    }

    if (currentProblem.boardType === 'wythoff' && gameEngine.selectedPile === -1) {
        const minPile = Math.min(gameEngine.piles[0], gameEngine.piles[1]);
        controls.innerHTML = `
            <div class="take-controls">
                <span>两堆同时取走</span>
                <input type="number" id="take-count" min="1" max="${minPile}" value="1">
                <span>个石子（最多${minPile}个）</span>
                <button class="btn-primary" onclick="makeMove()">✅ 确认</button>
            </div>
        `;
        return;
    }

    const pileCount = gameEngine.piles[gameEngine.selectedPile];
    let maxTake = pileCount;
    if (currentProblem.rule === 'bash' && currentProblem.maxTake) {
        maxTake = Math.min(pileCount, currentProblem.maxTake);
    }

    const pileLabel = currentProblem.boardType === 'single-row' ? '' : `从第${gameEngine.selectedPile + 1}堆`;
    controls.innerHTML = `
        <div class="take-controls">
            <span>${pileLabel}取走</span>
            <input type="number" id="take-count" min="1" max="${maxTake}" value="1">
            <span>个石子（最多${maxTake}个）</span>
            <button class="btn-primary" onclick="makeMove()">✅ 确认</button>
        </div>
    `;
}

function selectPile(index) {
    const isSingle = myRoomCode && myRoomCode.startsWith('single-');
    if (isSingle && gameEngine.currentPlayer !== 1) return;
    if (!isSingle && gameEngine.currentPlayer !== myPlayerNumber) return;
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
    const isWythoffBoth = gameEngine.selectedPile === -1;

    if (isWythoffBoth) {
        if (count > gameEngine.piles[0] || count > gameEngine.piles[1]) {
            alert('数量超过其中一堆！');
            return;
        }
        gameEngine.piles[0] -= count;
        gameEngine.piles[1] -= count;
        gameEngine.moveHistory.push({
            player: gameEngine.currentPlayer,
            pileIndex: -1,
            count,
            pilesAfter: [...gameEngine.piles]
        });
        addLog(`${isSingle ? '你' : '玩家' + myPlayerNumber} 从两堆同时取走${count}个石子`);
    } else {
        const pileIndex = gameEngine.selectedPile;
        if (!gameEngine.isValidMove(pileIndex, count)) {
            alert('非法操作！');
            return;
        }
        gameEngine.makeMove(pileIndex, count);
        addLog(`${isSingle ? '你' : '玩家' + myPlayerNumber} 从第${pileIndex + 1}堆取走${count}个石子`);
    }

    if (!isSingle && channel) {
        await channel.send({
            type: 'move',
            payload: { isWythoffBoth, pileIndex: gameEngine.selectedPile, count, state: gameEngine.getState() }
        });
        await supabaseClient.from('moves').insert({
            room_code: myRoomCode,
            player: `player${myPlayerNumber}`,
            move_data: { isWythoffBoth, pileIndex: gameEngine.selectedPile, count }
        });
    }

    const winner = gameEngine.checkGameOver();
    if (winner) {
        isSingle ? endGameSingle(winner) : endGame(winner);
        return;
    }

    gameEngine.switchPlayer();
    renderBoard();

    if (isSingle) {
        updateTurnDisplaySingle();
        resetTimer();
        if (gameEngine.currentPlayer === 2) aiMove();
    } else {
        updateTurnDisplay();
        resetTimer();
    }
}

function handleRemoteMove(payload) {
    if (payload.isWythoffBoth) {
        gameEngine.piles[0] -= payload.count;
        gameEngine.piles[1] -= payload.count;
        gameEngine.moveHistory.push({
            player: gameEngine.currentPlayer,
            pileIndex: -1,
            count: payload.count,
            pilesAfter: [...gameEngine.piles]
        });
        addLog(`玩家${gameEngine.currentPlayer} 从两堆同时取走${payload.count}个石子`);
    } else {
        gameEngine.loadState(payload.state);
        addLog(`玩家${gameEngine.currentPlayer === 1 ? 2 : 1} 从第${payload.pileIndex + 1}堆取走${payload.count}个石子`);
    }
    gameEngine.selectedPile = null;

    const winner = gameEngine.checkGameOver();
    if (winner) { endGame(winner); return; }

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

function handleGameOver(payload) { endGame(payload.winner); }

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
    if (channel) channel.send({ type: 'game_over', payload: { winner } });
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
        if (timeLeft <= 0) { clearInterval(timerInterval); handleTimeout(); }
    }, 1000);
}

function resetTimer() { clearInterval(timerInterval); startTimer(); }

function updateTimerDisplay() {
    const cp = gameEngine.currentPlayer;
    const el = document.getElementById(cp === 1 ? 'timer-p1' : 'timer-p2');
    el.textContent = timeLeft;
    if (timeLeft <= 10) el.classList.add('danger');
    else el.classList.remove('danger');
    if (myRoomCode && myRoomCode.startsWith('single-')) {
        document.getElementById(cp === 1 ? 'timer-p2' : 'timer-p1').textContent = '--';
    }
}

function handleTimeout() {
    const loser = gameEngine.currentPlayer;
    const winner = loser === 1 ? 2 : 1;
    addLog(`⏰ 玩家${loser} 超时！玩家${winner} 获胜！`);
    (myRoomCode && myRoomCode.startsWith('single-')) ? endGameSingle(winner) : endGame(winner);
}

// ==================== 显示更新 ====================
function updateTurnDisplay() {
    const isMyTurn = gameEngine.currentPlayer === myPlayerNumber;
    document.getElementById('panel-p1').classList.toggle('active-turn', gameEngine.currentPlayer === 1);
    document.getElementById('panel-p2').classList.toggle('active-turn', gameEngine.currentPlayer === 2);
    document.getElementById('turn-indicator').textContent = isMyTurn ? '⚡ 轮到你出手！' : '⏳ 等待对手...';
}

function updateTurnDisplaySingle() {
    const isMyTurn = gameEngine.currentPlayer === 1;
    document.getElementById('panel-p1').classList.toggle('active-turn', isMyTurn);
    document.getElementById('panel-p2').classList.toggle('active-turn', !isMyTurn);
    document.getElementById('turn-indicator').textContent = isMyTurn ? '⚡ 轮到你出手！' : '🤖 AI 思考中...';
}

function addLog(msg) {
    const log = document.getElementById('log-list');
    log.innerHTML += `<div class="log-item">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    log.scrollTop = log.scrollHeight;
}

// ==================== 初始化 ====================
switchPage('home');
renderProblemSelect();