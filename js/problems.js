const PROBLEMS = [
    // ========== 经典基础 ==========
    {
        id: 'bash',
        name: '巴什博弈',
        icon: '🪨',
        description: '一堆石子，两人轮流取1~m个，取走最后一个者胜。',
        difficulty: 'easy',
        defaultPiles: [20],
        maxTake: 3,
        rule: 'bash',
        timeLimit: 30,
        boardType: 'single-row',
        ai: { style: 'aggressive' },
        customizable: true
    },
    {
        id: 'nim',
        name: 'Nim 游戏',
        icon: '🎯',
        description: '多堆石子，轮流从任意一堆取任意数量，取走最后一个者胜。',
        difficulty: 'medium',
        defaultPiles: [3, 4, 5],
        maxTake: null,
        rule: 'nim',
        timeLimit: 45,
        boardType: 'multi-pile',
        ai: { style: 'destroyer' },
        customizable: true
    },
    {
        id: 'wythoff',
        name: '威佐夫博弈',
        icon: '⚖️',
        description: '两堆石子，可从一堆取任意数量，或从两堆取相同数量。',
        difficulty: 'hard',
        defaultPiles: [6, 10],
        maxTake: null,
        rule: 'wythoff',
        timeLimit: 45,
        boardType: 'wythoff',
        ai: { style: 'balancer' },
        customizable: true
    },

    // ========== 新增趣味博弈 ==========
    {
        id: 'euclid',
        name: '欧几里德的游戏',
        icon: '📐',
        description: '两个正整数，每次将较大数减去较小数的任意倍（非负），先减到0者胜。',
        difficulty: 'medium',
        defaultPiles: [25, 7],
        maxTake: null,
        rule: 'euclid',
        timeLimit: 60,
        boardType: 'euclid',
        ai: { style: 'balancer' },
        customizable: true
    },
    {
        id: 'decreasing',
        name: '递减游戏',
        icon: '📉',
        description: '多个正整数，每次选一个>1的数减1，无法操作者输。',
        difficulty: 'easy',
        defaultPiles: [3, 4, 5],
        maxTake: null,
        rule: 'decreasing',
        timeLimit: 45,
        boardType: 'multi-pile',
        ai: { style: 'cautious' },
        customizable: true
    },
    {
        id: 'fragmented-nim',
        name: '碎片化 Nim',
        icon: '🧩',
        description: '你选堆，对手指定你从哪堆取！颠覆传统Nim规则。',
        difficulty: 'hard',
        defaultPiles: [3, 5, 7],
        maxTake: null,
        rule: 'fragmented-nim',
        timeLimit: 60,
        boardType: 'multi-pile',
        ai: { style: 'tricky' },
        customizable: true
    },
    {
        id: 'letter-picking',
        name: '字符串取牌',
        icon: '🔤',
        description: '从字符串两端取字符拼成自己的序列，比字典序大小。',
        difficulty: 'hard',
        defaultPiles: [],
        maxTake: null,
        rule: 'letter-picking',
        timeLimit: 90,
        boardType: 'text',
        ai: { style: 'destroyer' },
        customizable: true
    }
];