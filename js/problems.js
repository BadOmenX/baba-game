function qualityRandom(factory, accept, maxAttempts = 80) {
    let candidate;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        candidate = factory();
        if (accept(candidate)) return candidate;
    }
    return candidate;
}

const PROBLEMS = [
    // 基础交互类（保持不变，配置已支持随机）
    {
        id: 'bash', name: '巴什博弈', icon: '🪨',
        description: '一堆石子，两人轮流取1~m个，取走最后一个者胜。',
        difficulty: 'easy', defaultPiles: [20], maxTake: 3, rule: 'bash',
        timeLimit: 30, boardType: 'single-row', ai: { style: 'aggressive' },
        customizable: true, configLabel: '石子数量', configPlaceholder: '石子数量',
        ruleHint: '每次可取 1~3 个，取走最后石子者胜。',
        link: 'https://www.luogu.com.cn/problem/P2197', mode: 'interactive'
    },
    {
        id: 'nim', name: 'Nim 游戏', icon: '🎯',
        description: '多堆石子，轮流从任意一堆取任意数量，取走最后一个者胜。',
        difficulty: 'medium', defaultPiles: [3,4,5], maxTake: null, rule: 'nim',
        timeLimit: 45, boardType: 'multi-pile', ai: { style: 'destroyer' },
        customizable: true, configLabel: '堆数', configPlaceholder: '堆数（随机每堆数量）',
        ruleHint: '每次选一堆取任意数量（至少1个），取完最后石子者胜。',
        link: 'https://www.luogu.com.cn/problem/P2197', mode: 'interactive'
    },
    {
        id: 'wythoff', name: '威佐夫博弈', icon: '⚖️',
        description: '两堆石子，可从一堆取任意数量，或从两堆取相同数量。',
        difficulty: 'hard', defaultPiles: [6,10], maxTake: null, rule: 'wythoff',
        timeLimit: 45, boardType: 'wythoff', ai: { style: 'balancer' },
        customizable: true, configLabel: '两堆数量（逗号分隔）', configPlaceholder: '如 6,10',
        ruleHint: '每次可从一堆取任意数量，或同时从两堆取相同数量。取完者胜。',
        link: 'https://www.luogu.com.cn/problem/P2252', mode: 'interactive'
    },
    {
        id: 'euclid', name: '欧几里得的游戏', icon: '📐',
        description: '两个正整数，每次将较大数减去较小数的任意倍（非负），先使一个数为0者胜。',
        difficulty: 'medium', defaultPiles: [25,7], maxTake: null, rule: 'euclid',
        timeLimit: 60, boardType: 'euclid', ai: { style: 'balancer' },
        customizable: true, configLabel: '两个数（逗号分隔）', configPlaceholder: '如 25,7',
        ruleHint: '每次将较大数减去较小数的任意倍（结果≥0），先使一个数为0者获胜。',
        link: 'https://www.luogu.com.cn/problem/P1290', mode: 'interactive'
    },
    {
        id: 'fragmented-nim', name: '碎片化 Nim', icon: '🧩',
        description: '对手指定一堆，你从该堆取石子。取走最后一个者胜。',
        difficulty: 'hard', defaultPiles: [3,5,7], maxTake: null, rule: 'fragmented-nim',
        timeLimit: 60, boardType: 'multi-pile', ai: { style: 'tricky' },
        customizable: true, configLabel: '堆数', configPlaceholder: '堆数',
        ruleHint: '从对手指定的堆取至少1个，再指定对手下一回合要取的非空堆。取完最后石子者胜。',
        link: 'https://www.luogu.com.cn/problem/CF2181F', mode: 'interactive'
    },
    {
        id: 'yet-another', name: 'Yet Another Number Game', icon: '🔢',
        description: 'n≤3堆，每次选一堆减任意，或全局减相同值。无法操作者输。',
        difficulty: 'medium', defaultPiles: [1,2,1], maxTake: null, rule: 'yet-another',
        timeLimit: 60, boardType: 'multi-pile', ai: { style: 'tricky' },
        customizable: true, configLabel: '各堆数量（逗号分隔，≤3堆）', configPlaceholder: '如 1,2,1',
        ruleHint: '每回合可选：①选一堆减去任意正数；②全局所有堆减去相同正数（不超过最小值）。无法操作者输。',
        link: 'https://www.luogu.com.cn/problem/CF282D', mode: 'interactive'
    },
    // 挑战类：新增随机生成函数
    {
        id: 'bunny-egg', name: '兔兔与蛋蛋游戏', icon: '🐰',
        description: '棋盘上移动黑白棋子，兔兔移白棋，蛋蛋移黑棋，无法移动者输。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'bunny-egg',
        timeLimit: 120, boardType: 'grid', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '兔兔(🔴)移白棋⭕到空格，蛋蛋(🔵)移黑棋⬤到空格。空格初始在棋盘某处。无法移动者输。点击棋子移动。',
        link: 'https://www.luogu.com.cn/problem/P1971', mode: 'interactive',
        randomChallenge: function() {
            return qualityRandom(() => {
                const sizes = [[4,4],[4,5],[5,5]], [r,c] = sizes[Math.floor(Math.random()*sizes.length)];
                const board = Array.from({ length:r }, (_,row) => Array.from({ length:c }, (_,col) => (row + col + Math.floor(Math.random()*2)) % 2 ? 'O' : 'X'));
                const er=1+Math.floor(Math.random()*(r-2)), ec=1+Math.floor(Math.random()*(c-2));
                board[er][ec]='.';
                const around=[[er-1,ec],[er+1,ec],[er,ec-1],[er,ec+1]];
                board[around[0][0]][around[0][1]]='O'; board[around[1][0]][around[1][1]]='X';
                return { board, name:`精选随机 ${r}×${c}` };
            }, value => {
                const flat=value.board.flat(); return flat.filter(cell=>cell==='O').length>=5 && flat.filter(cell=>cell==='X').length>=5;
            });
        },
        challenges: [
            { name: '例1: 3×3 简单', board: [['X','O','.'],['X','O','X'],['O','X','O']] },
            { name: '例2: 3×3 中等', board: [['.','O','X'],['O','X','O'],['X','O','X']] },
            { name: '例3: 4×3 进阶', board: [['X','O','X','O'],['O','X','O','.'],['X','O','X','O']] }
        ]
    },
    {
        id: 'wood-chess', name: '一双木棋', icon: '♟️',
        description: '阶梯状落子，菲菲(黑)和牛牛(白)轮流下，格子有分数，分数差定胜负。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'wood-chess',
        timeLimit: 120, boardType: 'grid-score', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '落子规则：左方和上方所有格子都已有棋子才可落子。黑方得分=Σa(i,j)，白方得分=Σb(i,j)。最终分数差=黑-白。',
        link: 'https://www.luogu.com.cn/problem/P4363', mode: 'interactive',
        randomChallenge: function() {
            const n=3+Math.floor(Math.random()*2), m=3+Math.floor(Math.random()*2);
            const a=Array(n).fill().map(()=>Array(m).fill().map(()=>Math.floor(Math.random()*12)+1));
            const b=Array(n).fill().map(()=>Array(m).fill().map(()=>Math.floor(Math.random()*12)+1));
            return { n, m, a, b, name:`精选随机 ${n}×${m}` };
        },
        challenges: [
            { name: '例1: 2×3', n:2, m:3, a:[[2,7,3],[9,1,2]], b:[[3,7,2],[2,3,1]] },
            { name: '例2: 3×3', n:3, m:3, a:[[1,2,3],[4,5,6],[7,8,9]], b:[[9,8,7],[6,5,4],[3,2,1]] },
            { name: '例3: 2×2', n:2, m:2, a:[[5,3],[2,4]], b:[[1,2],[6,3]] }
        ]
    },
    {
        id: 'tree-game', name: '经典游戏（树上）', icon: '🌳',
        description: '树上棋子向根的后代节点移动，无法移动的一方失败。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'tree-game',
        timeLimit: 0, boardType: 'tree', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '每次把一枚棋子移到当前节点的任意后代节点（不含自身）；所有棋子都到叶子、无法移动者输。',
        link: 'https://www.luogu.com.cn/problem/P8994', mode: 'interactive',
        randomChallenge: function() {
            return qualityRandom(() => {
                const n=6+Math.floor(Math.random()*4), edges=[];
                for(let i=2; i<=n; i++) edges.push([1+Math.floor(Math.random()*(i-1)),i]);
                const parents=new Set(edges.map(edge=>edge[0]));
                const pieces=Array.from({ length:n }, (_,index) => parents.has(index+1) ? 1+Math.floor(Math.random()*3) : Math.floor(Math.random()*2));
                const startNode=1+Math.floor(Math.random()*n);
                return { edges, root:1, pieces, startNode, name:`精选随机树 ${n}节点` };
            }, value => value.pieces.reduce((sum,n)=>sum+n,0)>=6 && value.edges.filter(([from])=>value.pieces[from-1]>0).length>=4);
        },
        challenges: [
            { name: '例1: 链3', edges:[[1,2],[2,3]], root:1, pieces:[1,2,0], startNode:1 },
            { name: '例2: 星型4', edges:[[1,2],[1,3],[1,4]], root:1, pieces:[0,1,2,1], startNode:2 },
            { name: '例3: 二叉树5', edges:[[1,2],[1,3],[2,4],[2,5]], root:1, pieces:[2,0,1,1,0], startNode:1 }
        ]
    },
    {
        id: 'tom-jerry', name: 'Tom & Jerry', icon: '🐱',
        description: '图上追逐，Jerry快但怕被抓，Tom慢但想抓。预置图挑战。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'tom-jerry',
        timeLimit: 0, boardType: 'graph', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: 'Jerry先走，可走到不经过Tom的任意节点；Tom每次至多走1边。Tom抓到Jerry获胜，Jerry坚持12轮获胜。',
        link: 'https://www.luogu.com.cn/problem/P7353', mode: 'interactive', maxRounds: 12,
        randomChallenge: function() {
            return qualityRandom(() => {
                const n=6+Math.floor(Math.random()*4), edges=[], used=new Set();
                for(let v=2; v<=n; v++){
                    const u=1+Math.floor(Math.random()*(v-1));
                    edges.push([u,v]); used.add(`${Math.min(u,v)}-${Math.max(u,v)}`);
                }
                const target=n+2+Math.floor(Math.random()*3);
                while(edges.length<target){
                    const u=1+Math.floor(Math.random()*n), v=1+Math.floor(Math.random()*n), key=`${Math.min(u,v)}-${Math.max(u,v)}`;
                    if(u!==v&&!used.has(key)){ edges.push([u,v]); used.add(key); }
                }
                const tom=1+Math.floor(Math.random()*n); let jerry;
                do{ jerry=1+Math.floor(Math.random()*n); }while(jerry===tom || edges.some(([a,b])=>(a===tom&&b===jerry)||(a===jerry&&b===tom)));
                const answer=GameSolvers.tomCanForceWin(n,edges,tom,jerry)?'Yes':'No';
                return { n, edges, tom, jerry, answer, name:`精选随机图 ${n}节点` };
            }, value => value.tom!==value.jerry && value.edges.length>=value.n+2);
        },
        challenges: [
            { name: '例1: 4环', n:4, edges:[[1,2],[2,3],[3,4],[4,1]], tom:1, jerry:3, answer:'No' },
            { name: '例2: 星型', n:5, edges:[[1,2],[1,3],[1,4],[1,5]], tom:2, jerry:4, answer:'Yes' },
            { name: '例3: 复杂', n:8, edges:[[1,2],[2,3],[3,4],[4,1],[6,4],[5,6],[6,7],[8,7],[8,5]], tom:6, jerry:4, answer:'No' }
        ]
    },
    {
        id: 'string-game', name: '字符串游戏', icon: '📝',
        description: '轮流选前缀删去获得分数，分数差定胜负。预置字符串挑战。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'string-game',
        timeLimit: 0, boardType: 'text-info', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '每次选一个非空前缀，获得等于该前缀出现次数的分数，然后删去该前缀。字符串为空时结束。最终分数差=先手-后手。',
        link: 'https://www.luogu.com.cn/problem/P10215', mode: 'interactive',
        randomChallenge: function() {
            return qualityRandom(() => {
                const chars='abc', len=7+Math.floor(Math.random()*4); let s='';
                for(let i=0; i<len; i++) s+=chars[Math.floor(Math.random()*chars.length)];
                return { s, answer: GameSolvers.stringScore(s), name:`精选随机字符串 "${s}"` };
            }, value => new Set(value.s).size>=2 && Math.max(...[...new Set(value.s)].map(char=>[...value.s].filter(item=>item===char).length))<=value.s.length-2);
        },
        challenges: [
            { name: '例1: ababa', s:'ababa', answer:2 },
            { name: '例2: aaaaa', s:'aaaaa', answer:3 },
            { name: '例3: abcabc', s:'abcabc', answer:1 }
        ]
    },
    {
        id: 'tic-tac-toe', name: '井字棋', icon: '❎',
        description: '三连成线的经典零和博弈，易上手却很考验预判。',
        difficulty: 'easy', defaultPiles: [], maxTake: null, rule: 'tic-tac-toe',
        timeLimit: 30, boardType: 'classic-grid', ai: { style: 'perfect' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '双方轮流落下 X 与 O，率先在横、竖或对角线上连成三枚者获胜。',
        link: 'https://en.wikipedia.org/wiki/Tic-tac-toe', mode: 'interactive', rows: 3, cols: 3
    },
    {
        id: 'connect-four', name: '四子棋', icon: '🔴',
        description: '从列顶落下棋子，率先横竖斜连成四枚即获胜。',
        difficulty: 'medium', defaultPiles: [], maxTake: null, rule: 'connect-four',
        timeLimit: 45, boardType: 'connect-grid', ai: { style: 'tactical' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '选择一列落子，棋子会落到最低空位；横、竖或斜向连成四枚即可获胜。',
        link: 'https://en.wikipedia.org/wiki/Connect_Four', mode: 'interactive', rows: 6, cols: 7
    },
    {
        id: 'chomp', name: 'Chomp 巧克力', icon: '🍫',
        description: '咬下一格及其右下区域，但吃到左上角毒块的人会输。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'chomp',
        timeLimit: 45, boardType: 'chomp-grid', ai: { style: 'positional' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '每次选择一块巧克力，并吃掉它右下方的所有块；被迫吃下左上角毒块者失败。',
        link: 'https://en.wikipedia.org/wiki/Chomp', mode: 'interactive', rows: 4, cols: 6
    }
];
