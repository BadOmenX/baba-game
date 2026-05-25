const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const AI_WORKER_URL = 'https://green-river-5b45.2560349809.workers.dev/';

let currentPage = 'home';
let myPlayerNumber = null;
let myRoomCode = null;
let gameEngine = null;
let currentProblem = null;
let timerInterval = null;
let timeLeft = 0;
let channel = null;
let selectedRule = null;
let selectedMode = 'single';
let selectedDifficulty = 'normal';
let customPiles = null;
let treeCanvasCtx = null, graphCanvasCtx = null;

// ==================== 页面切换 ====================
function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(page).classList.add('active');
    const navBtn = document.querySelector(`[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');
    currentPage = page;
    if (page === 'problems') renderProblems();
    if (page === 'battle') initBattlePage();
}
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', function() {
    switchPage(this.getAttribute('data-page'));
}));

// ==================== 题库 ====================
function renderProblems() {
    const grid = document.getElementById('problem-grid');
    grid.innerHTML = PROBLEMS.map(p => `
        <div class="problem-card">
            <h3>${p.icon} ${p.name}</h3>
            <p>${p.description}</p>
            <span class="diff diff-${p.difficulty}">${p.difficulty==='easy'?'简单':p.difficulty==='medium'?'中等':'困难'}</span>
            <a href="${p.link}" target="_blank" style="display:block;margin-top:8px;color:#3b82f6;font-size:12px;">📋 查看原题 →</a>
        </div>
    `).join('');
}

// ==================== 对战初始化 ====================
function initBattlePage() {
    document.getElementById('room-lobby').style.display = 'block';
    document.getElementById('game-room').style.display = 'none';
    document.getElementById('step-rule').classList.remove('hidden');
    document.getElementById('step-config').classList.add('hidden');
    selectedRule = null; selectedMode = 'single'; selectedDifficulty = 'normal'; customPiles = null;
    resetModeButtons(); resetDiffButtons();
    document.getElementById('custom-stones').value = '';
    document.getElementById('config-label').textContent = '自定义配置：';
    const ruleCards = document.getElementById('rule-cards');
    ruleCards.innerHTML = PROBLEMS.map(p => `
        <div class="rule-card ${selectedRule===p.id?'selected':''}" onclick="selectRule('${p.id}')">
            <div class="rule-icon">${p.icon}</div>
            <div class="rule-name">${p.name}</div>
            <div class="diff diff-${p.difficulty}">${p.difficulty==='easy'?'简单':p.difficulty==='medium'?'中等':'困难'}</div>
            <a href="${p.link}" target="_blank" onclick="event.stopPropagation()" style="display:block;margin-top:6px;color:#3b82f6;font-size:11px;">📋 原题链接</a>
        </div>
    `).join('');
}

function selectRule(ruleId) {
    selectedRule = ruleId;
    document.querySelectorAll('.rule-card').forEach(c => c.classList.remove('selected'));
    event.target.closest('.rule-card').classList.add('selected');
    document.getElementById('step-config').classList.remove('hidden');
    const p = PROBLEMS.find(x => x.id === ruleId);
    if (p) {
        document.getElementById('config-label').textContent = (p.configLabel || '自定义配置：') + '：';
        document.getElementById('custom-stones').placeholder = p.configPlaceholder || '留空则随机';
        document.getElementById('custom-stones').value = '';
        const customRow = document.getElementById('custom-config-row');
        if (p.mode === 'challenge') {
            customRow.classList.add('hidden');
        } else {
            customRow.classList.remove('hidden');
        }
    }
}

function selectMode(mode) { selectedMode = mode; resetModeButtons(); document.querySelector(`[data-mode="${mode}"]`).classList.add('active'); document.getElementById('single-config').classList.toggle('hidden', mode!=='single'); document.getElementById('multi-config').classList.toggle('hidden', mode!=='multi'); }
function resetModeButtons() { document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); }
function selectDifficulty(diff) { selectedDifficulty = diff; resetDiffButtons(); document.querySelector(`[data-diff="${diff}"]`).classList.add('active'); }
function resetDiffButtons() { document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active')); }

// ==================== 随机与自定义 ====================
function randomStones() {
    const p = PROBLEMS.find(x => x.id === selectedRule); if (!p) return;
    const input = document.getElementById('custom-stones');
    if (p.rule === 'bash') input.value = Math.floor(Math.random()*40)+10;
    else if (['nim','fragmented-nim'].includes(p.rule)) input.value = Math.floor(Math.random()*4)+2;
    else if (p.rule === 'wythoff') input.value = (Math.floor(Math.random()*15)+3)+', '+(Math.floor(Math.random()*15)+3);
    else if (p.rule === 'euclid') input.value = (Math.floor(Math.random()*50)+10)+', '+(Math.floor(Math.random()*20)+3);
    else if (p.rule === 'yet-another') { const n = Math.floor(Math.random()*3)+1; const vals=[]; for (let i=0;i<n;i++) vals.push(Math.floor(Math.random()*10)+1); input.value = vals.join(', '); }
}
function getCustomPiles() {
    const val = document.getElementById('custom-stones')?.value?.trim(); if (!val) return null;
    const p = PROBLEMS.find(x => x.id === selectedRule); if (!p) return null;
    if (p.rule === 'bash') { const n=parseInt(val); return (isNaN(n)||n<1)?null:[n]; }
    if (['nim','fragmented-nim'].includes(p.rule)) { const n=parseInt(val); if(isNaN(n)||n<2)return null; const piles=[]; for(let i=0;i<n;i++)piles.push(Math.floor(Math.random()*10)+1); return piles; }
    if (['wythoff','euclid'].includes(p.rule)) { const parts=val.split(',').map(s=>parseInt(s.trim())); if(parts.length!==2||parts.some(isNaN)||parts[0]<1||parts[1]<1)return null; return [Math.max(parts[0],parts[1]), Math.min(parts[0],parts[1])]; }
    if (p.rule === 'yet-another') { const parts=val.split(',').map(s=>parseInt(s.trim())); if(parts.length<1||parts.length>3||parts.some(v=>isNaN(v)||v<0))return null; return parts; }
    return null;
}

// ==================== 开始游戏 ====================
function startGame() {
    if (!selectedRule) { alert('请先选择博弈规则！'); return; }
    const problem = PROBLEMS.find(p => p.id === selectedRule);
    customPiles = getCustomPiles();
    if (selectedMode === 'single') startSinglePlayer();
    else { document.getElementById('step-rule').classList.add('hidden'); document.getElementById('step-config').classList.add('hidden'); document.getElementById('multi-config').classList.remove('hidden'); }
}

async function startSinglePlayer() {
    
    const problem = PROBLEMS.find(p => p.id === selectedRule);
    if (!problem) return;

    if (problem.mode === 'challenge') {
        const challenge = problem.randomChallenge();
        currentProblem = { ...problem, ...challenge };
    } else {
        if (!customPiles) {
            if (problem.rule === 'bash') customPiles = [Math.floor(Math.random()*40)+10];
            else if (problem.rule === 'nim' || problem.rule === 'fragmented-nim') {
                const n = Math.floor(Math.random()*4)+2;
                customPiles = Array(n).fill().map(() => Math.floor(Math.random()*10)+1);
            } else if (problem.rule === 'wythoff') {
                customPiles = [Math.floor(Math.random()*15)+3, Math.floor(Math.random()*15)+3];
            } else if (problem.rule === 'euclid') {
                customPiles = [Math.floor(Math.random()*50)+10, Math.floor(Math.random()*20)+3];
            } else if (problem.rule === 'yet-another') {
                const n = Math.floor(Math.random()*3)+1;
                customPiles = Array(n).fill().map(() => Math.floor(Math.random()*10)+1);
            }
        }
        if (problem.rule === 'euclid') {
            currentProblem = { ...problem, piles: [Math.max(...customPiles), Math.min(...customPiles)] };
        } else {
            currentProblem = { ...problem, piles: customPiles || [...problem.defaultPiles] };
        }
    }

    myRoomCode = 'single-' + Date.now(); myPlayerNumber = 1;
    document.getElementById('room-lobby').style.display = 'none';
    document.getElementById('game-room').style.display = 'block';
    document.getElementById('room-badge').textContent = `单人 · ${selectedDifficulty === 'hard' ? '困难' : '普通'}`;
    document.getElementById('room-badge').style.display = 'none';
    document.getElementById('name-p1').textContent = '你';
    document.getElementById('name-p2').textContent = '🤖 AI';
    document.getElementById('log-list').innerHTML = '';
    const hintEl = document.getElementById('rule-hint');
    hintEl.style.display = 'block';
    hintEl.textContent = '📖 ' + (currentProblem.ruleHint || currentProblem.description || '');

    gameEngine = new GameEngine(currentProblem);
    if (currentProblem.rule === 'bunny-egg') {
        gameEngine.grid = currentProblem.board.map(r => [...r]);
        gameEngine.emptyPos = _findEmpty(gameEngine.grid);
    }
    if (currentProblem.rule === 'wood-chess') {
        const n=currentProblem.n, m=currentProblem.m;
        gameEngine.grid = Array.from({length:n}, ()=>Array(m).fill(null));
    }

    renderBoard();
    updateTurnDisplaySingle();
    startTimer();
    addLog(`【${currentProblem.name}】${selectedDifficulty==='hard'?'困难':'普通'}模式开始！你是先手。`);
}

function _findEmpty(grid) { for(let r=0;r<grid.length;r++)for(let c=0;c<grid[0].length;c++)if(grid[r][c]==='.')return[r,c]; return[0,0]; }

// ==================== AI 核心 ====================
function getMaxPileIndex() { let maxIdx=0; for(let i=1;i<gameEngine.piles.length;i++)if(gameEngine.piles[i]>gameEngine.piles[maxIdx])maxIdx=i; return maxIdx; }
function getMaxTake(pileIndex) { let max=gameEngine.piles[pileIndex]; if(currentProblem.maxTake)max=Math.min(max,currentProblem.maxTake); return max; }
function getBashBestMove() { const total=gameEngine.piles[0]; const m=currentProblem.maxTake; const remainder=total%(m+1); if(remainder!==0&&remainder<=m)return{pileIndex:0,count:remainder}; return null; }
function getNimBestMove() { let nimSum=0; gameEngine.piles.forEach(c=>nimSum^=c); if(nimSum===0)return null; for(let i=0;i<gameEngine.piles.length;i++){const target=gameEngine.piles[i]^nimSum; if(target<gameEngine.piles[i])return{pileIndex:i,count:gameEngine.piles[i]-target};} return null; }
function getEuclidBestMove() { let a=gameEngine.piles[0],b=gameEngine.piles[1]; if(a<b)[a,b]=[b,a]; if(a%b===0)return{k:Math.floor(a/b)}; if(a>=2*b)return{k:Math.floor(a/b)}; return{k:1}; }

async function aiMove() {
    if (gameEngine.currentPlayer !== 2) return;
    document.getElementById('turn-indicator').textContent = '🤖 AI 思考中...';
    document.getElementById('game-controls').innerHTML = '<div class="waiting-overlay">🤖 AI 思考中...</div>';
    const rule = currentProblem.rule;

    if (rule === 'bunny-egg') { bunnyAiMove(); return; }
    if (rule === 'wood-chess') { woodAiMove(); return; }
    if (['tree-game','tom-jerry','string-game'].includes(rule)) return;

    if (selectedDifficulty === 'hard' && ['fragmented-nim','yet-another'].includes(rule)) {
        let rulesText = rule==='fragmented-nim'?'碎片化Nim：对手指定堆，你取子。':'Yet Another Number Game：可选一堆减任意或全局减相同值。';
        const prompt = `${currentProblem.name}。${rulesText} 当前：${gameEngine.piles.map((c,i)=>`堆${i+1}=${c}`).join('，')}。请给出最优走法。只回复JSON：{"pile":堆号或-1表示全局,"count":数量}`;
        try {
            const res = await fetch(AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
            const data = await res.json(); const content = data.content||'';
            const jsonMatch = content.match(/\{[^}]+\}/); if(!jsonMatch)throw new Error('格式错误');
            const move = JSON.parse(jsonMatch[0]);
            let pi=move.pile-1, cnt=move.count;
            if(pi<-1||pi>=gameEngine.piles.length)pi=getMaxPileIndex();
            cnt=Math.max(1,Math.min(cnt,pi===-1?Math.min(...gameEngine.piles):gameEngine.piles[pi]));
            executeAiMove(pi,cnt);
        } catch(e) { fallbackAiMove(); }
        return;
    }

    if (rule==='bash'){const best=getBashBestMove(); if(best)executeAiMove(best.pileIndex,best.count);else executeAiMove(0,1);}
    else if(rule==='nim'||rule==='wythoff'){const best=getNimBestMove(); if(best)executeAiMove(best.pileIndex,best.count);else{const idx=getMaxPileIndex();executeAiMove(idx,1);}}
    else if(rule==='euclid'){const best=getEuclidBestMove();executeAiMoveEuclid(best.k);}
    else if(rule==='fragmented-nim'||rule==='yet-another'){fallbackAiMove();}
}

function executeAiMove(pileIndex, count) {
    setTimeout(() => {
        if(pileIndex===-1){for(let i=0;i<gameEngine.piles.length;i++)gameEngine.piles[i]-=count;addLog(`🤖 AI 全局减去${count}`);}
        else{gameEngine.makeMove(pileIndex,count);addLog(`🤖 AI 从第${pileIndex+1}堆取走${count}个石子`);}
        afterMove();
    },600);
}
function executeAiMoveEuclid(k) {
    setTimeout(()=>{const a=gameEngine.piles[0],b=gameEngine.piles[1];gameEngine.piles[0]=a-k*b;addLog(`🤖 AI 将较大数减去${k}倍较小数`);if(gameEngine.piles[0]<gameEngine.piles[1])[gameEngine.piles[0],gameEngine.piles[1]]=[gameEngine.piles[1],gameEngine.piles[0]];afterMove();},600);
}
function fallbackAiMove() {
    const rule=currentProblem.rule;
    if(rule==='bash'){const best=getBashBestMove();if(best)executeAiMove(best.pileIndex,best.count);else executeAiMove(0,1);}
    else if(rule==='nim'||rule==='fragmented-nim'){const best=getNimBestMove();if(best)executeAiMove(best.pileIndex,best.count);else{const idx=getMaxPileIndex();executeAiMove(idx,1);}}
    else if(rule==='euclid'){const best=getEuclidBestMove();executeAiMoveEuclid(best.k);}
    else if(rule==='yet-another'){const idx=getMaxPileIndex();executeAiMove(idx,1);}
}
function afterMove() {
    const winner=gameEngine.checkGameOver();
    if(winner){endGameSingle(winner);return;}
    gameEngine.switchPlayer();renderBoard();updateTurnDisplaySingle();resetTimer();
    if(gameEngine.currentPlayer===2)aiMove();
}
function endGameSingle(winner) {
    clearInterval(timerInterval);
    const isMeWin=winner===1;
    document.getElementById('turn-indicator').textContent=isMeWin?'🎉 你赢了！':'😢 AI 赢了！';
    document.getElementById('game-controls').innerHTML=`<div style="text-align:center;padding:20px;"><h2>${isMeWin?'🎉 恭喜获胜！':'😢 败北！'}</h2><button class="btn-primary" onclick="location.reload()">🔄 再来一局</button></div>`;
}
function surrender() { if(!gameEngine)return; if(myRoomCode?.startsWith('single-')){endGameSingle(2);addLog('🏳️ 你认输了！');}else{endGame(myPlayerNumber===1?2:1);} }

// ==================== 双人模式（完整） ====================
function generateRoomCode(){return Math.random().toString(36).substring(2,8).toUpperCase();}
async function createRoom(){
    if(!selectedRule){alert('请先选择博弈规则！');return;}
    const problem=PROBLEMS.find(p=>p.id===selectedRule);
    customPiles=getCustomPiles();const piles=customPiles||[...problem.defaultPiles];
    const roomCode=generateRoomCode();
    const{error}=await supabaseClient.from('rooms').insert({room_code:roomCode,problem_id:selectedRule,game_state:{piles,currentPlayer:1,moveHistory:[]},current_turn:'player1',player1_name:'玩家1',player2_name:'等待中...',status:'waiting'});
    if(error){alert('创建房间失败');return;}
    myRoomCode=roomCode;myPlayerNumber=1;currentProblem={...problem,piles};
    document.getElementById('room-lobby').style.display='none';document.getElementById('game-room').style.display='block';
    document.getElementById('room-badge').textContent = roomCode;
    document.getElementById('room-badge').style.display = 'inline-block';
    document.getElementById('name-p1').textContent='你 (玩家1)';document.getElementById('name-p2').textContent='等待加入...';
    document.getElementById('game-board').innerHTML='';document.getElementById('game-controls').innerHTML='';
    document.getElementById('turn-indicator').textContent='等待对手加入...';
    document.getElementById('timer-p1').textContent='--';document.getElementById('timer-p2').textContent='--';
    document.getElementById('log-list').innerHTML='';
    alert(`房间创建成功！\n房间号: ${roomCode}`);
    const checkInterval=setInterval(async()=>{const{data:room}=await supabaseClient.from('rooms').select('status,player2_name').eq('room_code',roomCode).single();if(room&&room.status==='playing'){clearInterval(checkInterval);document.getElementById('name-p2').textContent='玩家2';subscribeToRoom(roomCode);enterGameRoom(roomCode,currentProblem);addLog('对手已加入！游戏开始！');document.getElementById('turn-indicator').textContent='⚡ 轮到你出手！';}},1000);
}
async function joinRoom(){
    const roomCode=document.getElementById('room-code-input').value.toUpperCase();if(!roomCode)return alert('请输入房间号');
    const{data:room,error}=await supabaseClient.from('rooms').select('*').eq('room_code',roomCode).single();
    if(error||!room){alert('房间不存在！');return;}if(room.status!=='waiting'){alert('房间已开始对战！');return;}
    myRoomCode=roomCode;myPlayerNumber=2;currentProblem=PROBLEMS.find(p=>p.id===room.problem_id);currentProblem={...currentProblem,piles:room.game_state.piles};
    await supabaseClient.from('rooms').update({status:'playing',player2_name:'玩家2'}).eq('room_code',roomCode);
    subscribeToRoom(roomCode);enterGameRoom(roomCode,currentProblem);
}
async function subscribeToRoom(roomCode){channel=supabaseClient.channel(`room:${roomCode}`);channel.on('broadcast',{event:'move'},(payload)=>handleRemoteMove(payload.payload)).on('broadcast',{event:'game_over'},(payload)=>endGame(payload.winner)).subscribe();}
function enterGameRoom(roomCode,problem){document.getElementById('room-badge').style.display = 'inline-block';document.getElementById('room-lobby').style.display='none';document.getElementById('game-room').style.display='block';document.getElementById('room-badge').textContent=roomCode;document.getElementById('name-p1').textContent=myPlayerNumber===1?'你 (玩家1)':'玩家1';document.getElementById('name-p2').textContent=myPlayerNumber===2?'你 (玩家2)':'玩家2';gameEngine=new GameEngine(problem);renderBoard();updateTurnDisplay();startTimer();}
function handleRemoteMove(payload){gameEngine.loadState(payload.state);addLog(`玩家${gameEngine.currentPlayer===1?2:1} 从第${payload.pileIndex+1}堆取走${payload.count}个石子`);gameEngine.selectedPile=null;const winner=gameEngine.checkGameOver();if(winner){endGame(winner);return;}gameEngine.switchPlayer();renderBoard();updateTurnDisplay();resetTimer();}
function endGame(winner){clearInterval(timerInterval);const isMe=winner===myPlayerNumber;document.getElementById('turn-indicator').textContent=isMe?'🎉 你赢了！':'😢 你输了！';document.getElementById('game-controls').innerHTML=`<div style="text-align:center;padding:20px;"><h2>${isMe?'🎉 恭喜获胜！':'😢 败北！'}</h2><button class="btn-primary" onclick="location.reload()">🔄 再来一局</button></div>`;if(channel)channel.send({type:'game_over',payload:{winner}});supabaseClient.from('rooms').update({status:'finished',winner:`player${winner}`}).eq('room_code',myRoomCode);}

// ==================== 棋盘渲染 ====================
function renderBoard() {
    const board = document.getElementById('game-board');
    const boardType = currentProblem.boardType || 'multi-pile';
    const piles = gameEngine.piles;
    switch (boardType) {
        case 'single-row':
            const total = piles[0]; let sz = total>50?16:total>30?20:28;
            board.innerHTML = `<div class="bash-row"><div class="bash-label">石子总数：<strong>${total}</strong></div><div class="bash-stones">${Array(total).fill(0).map(()=>`<div class="stone" style="width:${sz}px;height:${sz}px;"></div>`).join('')}</div></div>`;
            break;
        case 'wythoff':
            board.innerHTML = `<div class="board-row">${piles.map((c,i)=>`<div class="pile ${gameEngine.selectedPile===i?'selected':''}" onclick="selectPile(${i})"><div class="pile-label">第${i+1}堆</div><div class="pile-stones">${Array(Math.min(c,20)).fill(0).map(()=>'<div class="stone"></div>').join('')}${c>20?`<div class="stone-more">+${c-20}</div>`:''}</div><div class="pile-count">${c}</div></div>`).join('')}</div><div style="text-align:center;margin-top:12px;"><button class="btn-secondary btn-sm" onclick="selectBothPiles()">🎯 从两堆同时取</button></div>`;
            break;
        case 'euclid':
            board.innerHTML = `<div class="board-row">${piles.map((c,i)=>`<div class="pile"><div class="pile-label">${i===0?'较大数':'较小数'}</div><div class="pile-count" style="font-size:36px;">${c}</div></div>`).join('')}</div>`;
            break;
        case 'grid': _renderGridBoard(board); return;
        case 'grid-score': _renderWoodChessBoard(board); return;
        case 'tree': _renderTreeBoard(board); return;
        case 'graph': _renderGraphBoard(board); return;
        case 'text-info': _renderTextInfoBoard(board); return;
        default:
            if(!piles||piles.length===0){board.innerHTML='<div class="bash-row">等待开始...</div>';break;}
            board.innerHTML = `<div class="board-row">${piles.map((c,i)=>`<div class="pile ${gameEngine.selectedPile===i?'selected':''}" onclick="selectPile(${i})"><div class="pile-label">第${i+1}堆</div><div class="pile-stones">${Array(Math.min(c,15)).fill(0).map(()=>'<div class="stone"></div>').join('')}${c>15?`<div class="stone-more">+${c-15}</div>`:''}</div><div class="pile-count">${c}</div></div>`).join('')}</div>`;
    }
    renderControls();
}

// ==================== 网格棋盘（兔兔与蛋蛋） ====================
function _renderGridBoard(board) {
    const grid = gameEngine.grid; const rows=grid.length, cols=grid[0].length;
    let html = `<div class="grid-board" style="grid-template-columns:repeat(${cols},54px);">`;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const cell=grid[r][c]; const isSelected=gameEngine.selectedCell&&gameEngine.selectedCell[0]===r&&gameEngine.selectedCell[1]===c;
        let cls='grid-cell',content='';
        if(cell==='.'){cls+=' empty';}else if(cell==='X'){cls+=' black';content='⬤';}else if(cell==='O'){cls+=' white';content='⭕';}
        if(isSelected)cls+=' selected-cell';
        html+=`<div class="${cls}" onclick="clickGridCell(${r},${c})">${content}</div>`;
    }
    html+='</div>'; board.innerHTML=html;
    _renderBunnyEggControls();
}
function _renderBunnyEggControls(){
    const controls=document.getElementById('game-controls');
    const isMyTurn=gameEngine.currentPlayer===myPlayerNumber;
    if(!isMyTurn){controls.innerHTML='<div class="waiting-overlay">🤖 AI 思考中...</div>';}
    else if(!gameEngine.selectedCell){controls.innerHTML='<div class="waiting-overlay">👆 点击一个棋子将其移入空格</div>';}
    else{controls.innerHTML='<div class="take-controls"><span>已选中棋子，再点击空格确认移动</span></div>';}
}
function clickGridCell(r,c){
    const isMyTurn=gameEngine.currentPlayer===myPlayerNumber; if(!isMyTurn)return;
    const grid=gameEngine.grid; const cell=grid[r][c]; const[er,ec]=gameEngine.emptyPos;
    if(cell==='.'&&gameEngine.selectedCell){const[sr,sc]=gameEngine.selectedCell;grid[er][ec]=grid[sr][sc];grid[sr][sc]='.';gameEngine.emptyPos=[sr,sc];gameEngine.selectedCell=null;addLog(`${myRoomCode?.startsWith('single-')?'你':'玩家'+myPlayerNumber} 移动了 (${sr+1},${sc+1}) 到空格`);_finishBunnyTurn();}
    else if(cell!=='.'){const targetColor=gameEngine.currentPlayer===1?'O':'X';if(cell!==targetColor)return;const dist=Math.abs(r-er)+Math.abs(c-ec);if(dist!==1)return;gameEngine.selectedCell=[r,c];_renderGridBoard(document.getElementById('game-board'));}
}
function _finishBunnyTurn(){const winner=gameEngine.checkGameOver();if(winner){endGameSingle(winner);return;}gameEngine.switchPlayer();renderBoard();updateTurnDisplaySingle();resetTimer();if(gameEngine.currentPlayer===2)bunnyAiMove();}
function bunnyAiMove(){setTimeout(()=>{const grid=gameEngine.grid;const[er,ec]=gameEngine.emptyPos;const targetColor='X';const dirs=[[0,1],[0,-1],[1,0],[-1,0]];const candidates=[];for(const[dr,dc]of dirs){const nr=er+dr,nc=ec+dc;if(nr>=0&&nr<grid.length&&nc>=0&&nc<grid[0].length&&grid[nr][nc]===targetColor)candidates.push([nr,nc]);}if(candidates.length>0){const[sr,sc]=candidates[Math.floor(Math.random()*candidates.length)];grid[er][ec]=grid[sr][sc];grid[sr][sc]='.';gameEngine.emptyPos=[sr,sc];addLog('🤖 AI 移动了 ('+(sr+1)+','+(sc+1)+') 到空格');}_finishBunnyTurn();},600+Math.random()*800);}

// ==================== 木棋棋盘 ====================
function _renderWoodChessBoard(board){
    const grid=gameEngine.grid; const n=currentProblem.n,m=currentProblem.m; const a=currentProblem.a,b=currentProblem.b;
    let html=`<div class="grid-board" style="grid-template-columns:repeat(${m},58px);">`;
    for(let r=0;r<n;r++)for(let c=0;c<m;c++){
        const val=grid[r][c]; let cls='grid-cell',content='';
        if(val===null){const canPlace=_canPlaceWood(r,c);cls+=canPlace?' wood-available':' wood-empty';if(canPlace)content=`<span class="cell-score">${a[r][c]}/${b[r][c]}</span>`;}
        else if(val===1){cls+=' wood-black';content='⚫';}else if(val===2){cls+=' wood-white';content='⚪';}
        html+=`<div class="${cls}" onclick="clickWoodCell(${r},${c})">${content}</div>`;
    }
    html+='</div>'; board.innerHTML=html; _renderWoodControls();
}
function _canPlaceWood(r,c){if(gameEngine.grid[r][c]!==null)return false;for(let rr=0;rr<r;rr++)if(gameEngine.grid[rr][c]===null)return false;for(let cc=0;cc<c;cc++)if(gameEngine.grid[r][cc]===null)return false;return true;}
function _renderWoodControls(){const controls=document.getElementById('game-controls');const isMyTurn=gameEngine.currentPlayer===myPlayerNumber;if(!isMyTurn){controls.innerHTML='<div class="waiting-overlay">🤖 AI 思考中...</div>';}else{controls.innerHTML='<div class="waiting-overlay">👆 点击高亮格子落子</div>';}const full=gameEngine._woodChessFull();if(full){const a=currentProblem.a,b=currentProblem.b;let s1=0,s2=0;const g=gameEngine.grid;for(let r=0;r<g.length;r++)for(let c=0;c<g[0].length;c++){if(g[r][c]===1)s1+=a[r][c];if(g[r][c]===2)s2+=b[r][c];}const diff=s1-s2;document.getElementById('turn-indicator').textContent=`游戏结束！分数差: ${diff}`;document.getElementById('game-controls').innerHTML=`<div style="text-align:center;padding:20px;"><h2>黑方 ${s1} - ${s2} 白方</h2><h3>分数差: ${diff}</h3><button class="btn-primary" onclick="location.reload()">🔄 再来一局</button></div>`;clearInterval(timerInterval);}}
function clickWoodCell(r,c){const isMyTurn=gameEngine.currentPlayer===myPlayerNumber;if(!isMyTurn)return;if(!_canPlaceWood(r,c))return;gameEngine.grid[r][c]=gameEngine.currentPlayer;addLog(`${myRoomCode?.startsWith('single-')?'你':'玩家'+myPlayerNumber} 在 (${r+1},${c+1}) 落子`);_finishWoodTurn();}
function _finishWoodTurn(){if(gameEngine._woodChessFull()){renderBoard();return;}gameEngine.switchPlayer();renderBoard();updateTurnDisplaySingle();resetTimer();if(gameEngine.currentPlayer===2)woodAiMove();}
function woodAiMove(){setTimeout(()=>{const cands=[];const g=gameEngine.grid;for(let r=0;r<g.length;r++)for(let c=0;c<g[0].length;c++){if(g[r][c]===null&&_canPlaceWood(r,c))cands.push([r,c]);}if(cands.length>0){const[r,c]=cands[Math.floor(Math.random()*cands.length)];g[r][c]=2;addLog('🤖 AI 在 ('+(r+1)+','+(c+1)+') 落子');}_finishWoodTurn();},500+Math.random()*800);}

// ==================== 树、图、信息展示 ====================
function _renderTreeBoard(board){
    const c=currentProblem;
    board.innerHTML=`<div class="tree-container"><canvas id="tree-canvas" width="600" height="300"></canvas></div>
        <div class="info-panel"><div class="sub-text">根节点: ${c.root} | 各节点棋子数: [${c.pieces.join(', ')}]</div><div class="sub-text">开局先在节点${c.startNode}放一枚棋子</div></div>`;
    document.getElementById('game-controls').innerHTML='<div class="info-panel"><div class="sub-text">此题仅展示局面，最佳结果见原题</div></div>';
    setTimeout(()=>{const canvas=document.getElementById('tree-canvas');if(canvas){treeCanvasCtx=canvas.getContext('2d');_drawTree(c,treeCanvasCtx);}},100);
}
function _drawTree(c,ctx){
    if(!ctx)return;const canvas=ctx.canvas;const n=c.edges.length+1;const pos={};
    for(let i=0;i<n;i++){const ang=(2*Math.PI*i)/n;pos[i+1]={x:canvas.width/2+180*Math.cos(ang),y:canvas.height/2+120*Math.sin(ang)};}
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#475569';ctx.lineWidth=2;
    c.edges.forEach(([u,v])=>{ctx.beginPath();ctx.moveTo(pos[u].x,pos[u].y);ctx.lineTo(pos[v].x,pos[v].y);ctx.stroke();});
    for(let i=1;i<=n;i++){const p=pos[i];ctx.fillStyle='#1e293b';ctx.beginPath();ctx.arc(p.x,p.y,20,0,2*Math.PI);ctx.fill();ctx.strokeStyle=i===c.root?'#fbbf24':'#3b82f6';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e2e8f0';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(i+(c.pieces[i-1]>0?' ('+c.pieces[i-1]+')':''),p.x,p.y+5);}
}
function _renderGraphBoard(board){
    const c=currentProblem;
    board.innerHTML=`<div class="tree-container"><canvas id="graph-canvas" width="600" height="300"></canvas></div><div class="info-panel"><div class="sub-text">Tom(🐱) 起点: ${c.tom} | Jerry(🐭) 起点: ${c.jerry}</div><div class="big-text">${c.answer==='Yes'?'✅ Tom 必胜':'❌ Tom 不胜'}</div></div>`;
    document.getElementById('game-controls').innerHTML='<div class="info-panel"><div class="sub-text">此题仅展示局面，最佳结果见原题</div></div>';
    setTimeout(()=>{const canvas=document.getElementById('graph-canvas');if(canvas){graphCanvasCtx=canvas.getContext('2d');_drawGraph(c,graphCanvasCtx);}},100);
}
function _drawGraph(c,ctx){
    if(!ctx)return;const canvas=ctx.canvas;const n=c.n;const pos={};
    for(let i=0;i<n;i++){const ang=(2*Math.PI*i)/n;pos[i+1]={x:canvas.width/2+180*Math.cos(ang),y:canvas.height/2+120*Math.sin(ang)};}
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#475569';ctx.lineWidth=2;
    c.edges.forEach(([u,v])=>{ctx.beginPath();ctx.moveTo(pos[u].x,pos[u].y);ctx.lineTo(pos[v].x,pos[v].y);ctx.stroke();});
    for(let i=1;i<=n;i++){const p=pos[i];ctx.fillStyle='#1e293b';ctx.beginPath();ctx.arc(p.x,p.y,18,0,2*Math.PI);ctx.fill();ctx.strokeStyle=i===c.tom?'#3b82f6':i===c.jerry?'#f87171':'#475569';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e2e8f0';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText(i+(i===c.tom?'🐱':i===c.jerry?'🐭':''),p.x,p.y+4);}
}
function _renderTextInfoBoard(board){
    const c=currentProblem;
    board.innerHTML=`<div class="info-panel"><div class="sub-text">字符串: <strong style="font-size:22px;letter-spacing:4px;">${c.s}</strong></div><div class="big-text">最佳分数差: ${c.answer}</div></div>`;
    document.getElementById('game-controls').innerHTML='<div class="info-panel"><div class="sub-text">此题仅展示局面，最佳结果见原题</div></div>';
}

// ==================== 操作控件 ====================
function renderControls(){
    const controls=document.getElementById('game-controls');
    const isSingle=myRoomCode?.startsWith('single-');
    if(isSingle&&gameEngine.currentPlayer===2){controls.innerHTML='<div class="waiting-overlay">🤖 AI 思考中...</div>';return;}
    if(!isSingle&&gameEngine.currentPlayer!==myPlayerNumber){controls.innerHTML='<div class="waiting-overlay">⏳ 等待对手出手...</div>';return;}
    if(currentProblem.rule==='fragmented-nim'){
        if(gameEngine.selectedPile===null){const cands=[];gameEngine.piles.forEach((v,i)=>{if(v>0)cands.push(i);});if(cands.length>0){gameEngine.selectedPile=cands[Math.floor(Math.random()*cands.length)];addLog(`对手指定了第${gameEngine.selectedPile+1}堆`);}}
        const pc=gameEngine.piles[gameEngine.selectedPile];controls.innerHTML=`<div class="take-controls"><span>对手指定了第${gameEngine.selectedPile+1}堆，取走</span><input type="number" id="take-count" min="1" max="${pc}" value="1"><span>个</span><button class="btn-primary" onclick="makeMove()">✅ 确认</button></div>`;return;
    }
    if(currentProblem.rule==='yet-another'){
        controls.innerHTML=`<div class="pick-buttons"><button class="btn-secondary" onclick="selectPile(-1)">🌐 全局减</button></div><div class="board-row" style="margin-top:12px;">${gameEngine.piles.map((c,i)=>`<div class="pile ${gameEngine.selectedPile===i?'selected':''}" onclick="selectPile(${i})"><div class="pile-label">第${i+1}堆</div><div class="pile-count">${c}</div></div>`).join('')}</div>`;
        if(gameEngine.selectedPile!==null){const pc=gameEngine.selectedPile===-1?Math.min(...gameEngine.piles):gameEngine.piles[gameEngine.selectedPile];controls.innerHTML+=`<div class="take-controls" style="margin-top:8px;"><span>减去</span><input type="number" id="take-count" min="1" max="${pc}" value="1"><span>个</span><button class="btn-primary" onclick="makeMove()">✅ 确认</button></div>`;}return;
    }
    if(currentProblem.rule==='euclid'&&gameEngine.selectedPile===null)gameEngine.selectedPile=0;
    if(currentProblem.boardType==='single-row'&&gameEngine.selectedPile===null)gameEngine.selectedPile=0;
    if(gameEngine.selectedPile===null){controls.innerHTML='<div class="waiting-overlay">👆 请先选择一堆石子</div>';return;}
    if(currentProblem.rule==='euclid'){const a=gameEngine.piles[0],b=gameEngine.piles[1];const maxK=Math.floor(a/b);controls.innerHTML=`<div class="take-controls"><span>${a} 减去 ${b} 的</span><input type="number" id="take-count" min="1" max="${maxK}" value="1"><span>倍</span><button class="btn-primary" onclick="makeMove()">✅ 确认</button></div>`;return;}
    if(currentProblem.boardType==='wythoff'&&gameEngine.selectedPile===-1){const min=Math.min(gameEngine.piles[0],gameEngine.piles[1]);controls.innerHTML=`<div class="take-controls"><span>两堆同时取</span><input type="number" id="take-count" min="1" max="${min}" value="1"><span>个</span><button class="btn-primary" onclick="makeMove()">✅ 确认</button></div>`;return;}
    const pc=gameEngine.piles[gameEngine.selectedPile];let maxTake=pc;if(currentProblem.rule==='bash'&&currentProblem.maxTake)maxTake=Math.min(pc,currentProblem.maxTake);
    const label=currentProblem.boardType==='single-row'?'取走':`从第${gameEngine.selectedPile+1}堆取走`;
    controls.innerHTML=`<div class="take-controls"><span>${label}</span><input type="number" id="take-count" min="1" max="${maxTake}" value="1"><span>个（最多${maxTake}）</span><button class="btn-primary" onclick="makeMove()">✅ 确认</button></div>`;
}

function selectPile(index){const isSingle=myRoomCode?.startsWith('single-');if(isSingle&&gameEngine.currentPlayer!==1)return;if(!isSingle&&gameEngine.currentPlayer!==myPlayerNumber)return;if(index!==-1&&gameEngine.piles[index]===0)return;gameEngine.selectedPile=gameEngine.selectedPile===index?null:index;renderBoard();}
function selectBothPiles(){if(myRoomCode?.startsWith('single-')&&gameEngine.currentPlayer!==1)return;gameEngine.selectedPile=-1;renderBoard();}

function makeMove(){
    const isSingle=myRoomCode?.startsWith('single-');if(!isSingle&&gameEngine.currentPlayer!==myPlayerNumber)return;if(isSingle&&gameEngine.currentPlayer!==1)return;
    if(currentProblem.rule==='euclid'){const k=parseInt(document.getElementById('take-count').value);const a=gameEngine.piles[0],b=gameEngine.piles[1];if(k<1||k*b>a){alert('非法操作！');return;}gameEngine.piles[0]=a-k*b;gameEngine.moveHistory.push({player:gameEngine.currentPlayer,pileIndex:0,count:k,pilesAfter:[...gameEngine.piles]});addLog(`${isSingle?'你':'玩家'+myPlayerNumber} 将较大数减去${k}倍较小数`);if(gameEngine.piles[0]<gameEngine.piles[1])[gameEngine.piles[0],gameEngine.piles[1]]=[gameEngine.piles[1],gameEngine.piles[0]];finishTurn(isSingle);return;}
    if(currentProblem.rule==='wythoff'&&gameEngine.selectedPile===-1){const count=parseInt(document.getElementById('take-count').value);if(count>gameEngine.piles[0]||count>gameEngine.piles[1]){alert('超过数量！');return;}gameEngine.piles[0]-=count;gameEngine.piles[1]-=count;gameEngine.moveHistory.push({player:gameEngine.currentPlayer,pileIndex:-1,count,pilesAfter:[...gameEngine.piles]});addLog(`${isSingle?'你':'玩家'+myPlayerNumber} 从两堆同时取走${count}个石子`);finishTurn(isSingle);return;}
    if(currentProblem.rule==='yet-another'&&gameEngine.selectedPile===-1){const count=parseInt(document.getElementById('take-count').value);const mn=Math.min(...gameEngine.piles);if(count<1||count>mn){alert('非法操作！');return;}for(let i=0;i<gameEngine.piles.length;i++)gameEngine.piles[i]-=count;gameEngine.moveHistory.push({player:gameEngine.currentPlayer,pileIndex:-1,count,pilesAfter:[...gameEngine.piles]});addLog(`${isSingle?'你':'玩家'+myPlayerNumber} 全局减去${count}`);finishTurn(isSingle);return;}
    const pileIndex=gameEngine.selectedPile;const count=parseInt(document.getElementById('take-count').value);
    if(!gameEngine.isValidMove(pileIndex,count)){alert('非法操作！');return;}
    gameEngine.makeMove(pileIndex,count);addLog(`${isSingle?'你':'玩家'+myPlayerNumber} 从第${pileIndex+1}堆取走${count}个石子`);
    if(!isSingle&&channel)channel.send({type:'move',payload:{pileIndex,count,state:gameEngine.getState()}});
    finishTurn(isSingle);
}
function finishTurn(isSingle){const winner=gameEngine.checkGameOver();if(winner){isSingle?endGameSingle(winner):endGame(winner);return;}gameEngine.switchPlayer();renderBoard();if(isSingle){updateTurnDisplaySingle();resetTimer();if(gameEngine.currentPlayer===2)aiMove();}else{updateTurnDisplay();resetTimer();}}

// ==================== 计时器 ====================
function startTimer(){timeLeft=currentProblem.timeLimit||30;updateTimerDisplay();clearInterval(timerInterval);timerInterval=setInterval(()=>{timeLeft--;updateTimerDisplay();if(timeLeft<=0){clearInterval(timerInterval);handleTimeout();}},1000);}
function resetTimer(){clearInterval(timerInterval);startTimer();}
function updateTimerDisplay(){const cp=gameEngine.currentPlayer;const el=document.getElementById(cp===1?'timer-p1':'timer-p2');if(!el)return;el.textContent=timeLeft;if(timeLeft<=10)el.classList.add('danger');else el.classList.remove('danger');if(myRoomCode?.startsWith('single-')){const other=document.getElementById(cp===1?'timer-p2':'timer-p1');if(other)other.textContent='--';}}
function handleTimeout(){const loser=gameEngine.currentPlayer;const winner=loser===1?2:1;addLog(`⏰ 玩家${loser} 超时！`);(myRoomCode?.startsWith('single-'))?endGameSingle(winner):endGame(winner);}
function updateTurnDisplay(){const isMyTurn=gameEngine.currentPlayer===myPlayerNumber;document.getElementById('panel-p1').classList.toggle('active-turn',gameEngine.currentPlayer===1);document.getElementById('panel-p2').classList.toggle('active-turn',gameEngine.currentPlayer===2);document.getElementById('turn-indicator').textContent=isMyTurn?'⚡ 轮到你出手！':'⏳ 等待对手...';}
function updateTurnDisplaySingle(){const isMyTurn=gameEngine.currentPlayer===1;document.getElementById('panel-p1').classList.toggle('active-turn',isMyTurn);document.getElementById('panel-p2').classList.toggle('active-turn',!isMyTurn);document.getElementById('turn-indicator').textContent=isMyTurn?'⚡ 轮到你出手！':'🤖 AI 思考中...';}
function addLog(msg){const log=document.getElementById('log-list');log.innerHTML+=`<div class="log-item">[${new Date().toLocaleTimeString()}] ${msg}</div>`;log.scrollTop=log.scrollHeight;}

// ==================== 初始化 ====================
switchPage('home');