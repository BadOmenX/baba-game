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
        ruleHint: '每回合对手先指定一堆，然后你从该堆取石子（至少1个），取完最后石子者胜。',
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
        link: 'https://www.luogu.com.cn/problem/P1971', mode: 'challenge',
        randomChallenge: function() {
            const sizes = [[3,3],[3,4],[4,4]];
            const [r,c] = sizes[Math.floor(Math.random()*sizes.length)];
            const board = Array(r).fill().map(()=>Array(c).fill('X'));
            const pieces = Math.floor(r*c/2);
            for(let i=0; i<pieces; i++){
                const rr=Math.floor(Math.random()*r), cc=Math.floor(Math.random()*c);
                if(board[rr][cc]==='X') board[rr][cc]='O';
            }
            const er=Math.floor(Math.random()*r), ec=Math.floor(Math.random()*c);
            board[er][ec]='.';
            return { board, name:`随机 ${r}x${c}` };
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
        link: 'https://www.luogu.com.cn/problem/P4363', mode: 'challenge',
        randomChallenge: function() {
            const n=2+Math.floor(Math.random()*2), m=2+Math.floor(Math.random()*3);
            const a=Array(n).fill().map(()=>Array(m).fill().map(()=>Math.floor(Math.random()*9)+1));
            const b=Array(n).fill().map(()=>Array(m).fill().map(()=>Math.floor(Math.random()*9)+1));
            return { n, m, a, b, name:`随机 ${n}x${m}` };
        },
        challenges: [
            { name: '例1: 2×3', n:2, m:3, a:[[2,7,3],[9,1,2]], b:[[3,7,2],[2,3,1]] },
            { name: '例2: 3×3', n:3, m:3, a:[[1,2,3],[4,5,6],[7,8,9]], b:[[9,8,7],[6,5,4],[3,2,1]] },
            { name: '例3: 2×2', n:2, m:2, a:[[5,3],[2,4]], b:[[1,2],[6,3]] }
        ]
    },
    {
        id: 'tree-game', name: '经典游戏（树上）', icon: '🌳',
        description: '树上棋子下移，C可换根，K加棋子。预置局面挑战。',
        difficulty: 'hard', defaultPiles: [], maxTake: null, rule: 'tree-game',
        timeLimit: 0, boardType: 'tree', ai: { style: 'tricky' },
        customizable: false, configLabel: '', configPlaceholder: '',
        ruleHint: '树上每个节点有棋子。每次选一个棋子移到其子树内任意节点（不含自身）。无法移动者输。C可选换根。',
        link: 'https://www.luogu.com.cn/problem/P8994', mode: 'challenge',
        randomChallenge: function() {
            const n=3+Math.floor(Math.random()*4);
            const edges=[], nodes=[1];
            for(let i=2; i<=n; i++){
                const parent=nodes[Math.floor(Math.random()*nodes.length)];
                edges.push([parent,i]);
                nodes.push(i);
            }
            const root=1;
            const pieces=Array(n).fill().map(()=>Math.floor(Math.random()*3));
            const startNode=1+Math.floor(Math.random()*n);
            return { edges, root, pieces, startNode, name:`随机树 ${n}节点` };
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
        ruleHint: 'Jerry先走，可走任意多边但不能经过Tom；Tom每次至多走1边。Tom到达Jerry位置即胜。判断Tom能否必胜。',
        link: 'https://www.luogu.com.cn/problem/P7353', mode: 'challenge',
        randomChallenge: function() {
            const n=4+Math.floor(Math.random()*5);
            const edges=[], used=new Set();
            for(let i=0; i<n-1; i++){
                const u=1+Math.floor(Math.random()*n), v=1+Math.floor(Math.random()*n);
                if(u!==v && !used.has(`${Math.min(u,v)}-${Math.max(u,v)}`)){
                    edges.push([u,v]);
                    used.add(`${Math.min(u,v)}-${Math.max(u,v)}`);
                }
            }
            if(edges.length<2) edges.push([1,2]);
            const tom=1+Math.floor(Math.random()*n);
            let jerry;
            do{ jerry=1+Math.floor(Math.random()*n); }while(jerry===tom);
            const answer= Math.random()<0.5?'Yes':'No';
            return { n, edges, tom, jerry, answer, name:`随机图 ${n}节点` };
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
        link: 'https://www.luogu.com.cn/problem/P10215', mode: 'challenge',
        randomChallenge: function() {
            const chars='ab';
            const len=4+Math.floor(Math.random()*5);
            let s='';
            for(let i=0; i<len; i++) s+=chars[Math.floor(Math.random()*chars.length)];
            return { s, answer: Math.floor(Math.random()*5)+1, name:`随机字符串 "${s}"` };
        },
        challenges: [
            { name: '例1: ababa', s:'ababa', answer:2 },
            { name: '例2: aaaaa', s:'aaaaa', answer:5 },
            { name: '例3: abcabc', s:'abcabc', answer:3 }
        ]
    }
];