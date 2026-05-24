const PROBLEMS = [
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
    }
];