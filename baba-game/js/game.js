class GameEngine {
    constructor(problem) {
        this.problem = problem;
        this.piles = [...problem.piles];
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.selectedPile = null;
    }

    // 检查是否合法
    isValidMove(pileIndex, count) {
        if (pileIndex < 0 || pileIndex >= this.piles.length) return false;
        if (count <= 0) return false;
        if (count > this.piles[pileIndex]) return false;

        if (this.problem.rule === 'bash' && this.problem.maxTake) {
            if (count > this.problem.maxTake) return false;
        }
        return true;
    }

    // 执行操作
    makeMove(pileIndex, count) {
        if (!this.isValidMove(pileIndex, count)) return false;

        this.piles[pileIndex] -= count;
        this.moveHistory.push({
            player: this.currentPlayer,
            pileIndex,
            count,
            pilesAfter: [...this.piles]
        });

        return true;
    }

    // 检查游戏结束
    checkGameOver() {
        const totalStones = this.piles.reduce((a, b) => a + b, 0);
        if (totalStones === 0) {
            // 取走最后一个石子的人获胜
            return this.currentPlayer;
        }
        return null;
    }

    // 切换玩家
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.selectedPile = null;
    }

    // 获取当前局面描述
    getState() {
        return {
            piles: [...this.piles],
            currentPlayer: this.currentPlayer,
            moveHistory: [...this.moveHistory],
            problemId: this.problem.id
        };
    }

    // 加载状态
    loadState(state) {
        this.piles = [...state.piles];
        this.currentPlayer = state.currentPlayer;
        this.moveHistory = state.moveHistory || [];
    }
}