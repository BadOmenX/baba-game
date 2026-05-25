class GameEngine {
    constructor(problem) {
        this.problem = problem;
        this.rule = problem.rule;
        this.piles = [...problem.piles];
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.selectedPile = null;
    }

    // 通用移动验证
    isValidMove(pileIndex, count) {
        if (this.rule === 'euclid' || this.rule === 'decreasing' || this.rule === 'letter-picking') {
            return true; // 这些规则在外部自定义验证
        }
        if (pileIndex < 0 || pileIndex >= this.piles.length) return false;
        if (count <= 0 || count > this.piles[pileIndex]) return false;
        if (this.rule === 'bash' && this.problem.maxTake && count > this.problem.maxTake) return false;
        return true;
    }

    // 执行通用移动（Nim/Bash/Wythoff 等）
    makeMove(pileIndex, count) {
        if (!this.isValidMove(pileIndex, count)) return false;
        this.piles[pileIndex] -= count;
        this.moveHistory.push({ player: this.currentPlayer, pileIndex, count, pilesAfter: [...this.piles] });
        return true;
    }

    // 根据规则判断游戏是否结束及胜者
    checkGameOver() {
        switch (this.rule) {
            case 'bash':
            case 'nim':
            case 'wythoff':
            case 'fragmented-nim':
                const total = this.piles.reduce((a, b) => a + b, 0);
                if (total === 0) return this.currentPlayer; // 取走最后一个者胜
                return null;
            case 'euclid':
                // 两个数，有一个为 0 则当前玩家胜（上一步操作者）
                if (this.piles[0] === 0 || this.piles[1] === 0) return this.currentPlayer;
                return null;
            case 'decreasing':
                // 所有数都 <=1 时，当前玩家无法操作，对方胜
                const allOneOrZero = this.piles.every(v => v <= 1);
                if (allOneOrZero) return this.currentPlayer === 1 ? 2 : 1;
                return null;
            case 'letter-picking':
                // 字符串为空时，由外部比较字典序，这里返回特殊值
                if (!this.problem.word || this.problem.word.length === 0) return 0; // 0 表示需要外部处理
                return null;
            default:
                return null;
        }
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.selectedPile = null;
    }

    getState() {
        return {
            piles: [...this.piles],
            currentPlayer: this.currentPlayer,
            moveHistory: [...this.moveHistory],
            problemId: this.problem.id
        };
    }

    loadState(state) {
        this.piles = [...state.piles];
        this.currentPlayer = state.currentPlayer;
        this.moveHistory = state.moveHistory || [];
    }
}