class GameEngine {
    constructor(problem) {
        this.problem = problem;
        this.rule = problem.rule;
        this.piles = [...(problem.piles || problem.defaultPiles || [])];
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.selectedPile = null;
        this.grid = problem.board ? problem.board.map(r => [...r]) : null;
        this.emptyPos = null;
        this.scores = { p1: 0, p2: 0 };
        this.selectedCell = null;
    }

    isValidMove(pileIndex, count) {
        if (['euclid','bunny-egg','wood-chess','tree-game','tom-jerry','string-game'].includes(this.rule)) return true;
        if (pileIndex < 0 || pileIndex >= this.piles.length) return false;
        if (count <= 0 || count > this.piles[pileIndex]) return false;
        if (this.rule === 'bash' && this.problem.maxTake && count > this.problem.maxTake) return false;
        if (this.rule === 'yet-another') {
            if (pileIndex === -1) {
                const mn = Math.min(...this.piles);
                if (count <= 0 || count > mn) return false;
            } else {
                if (count <= 0 || count > this.piles[pileIndex]) return false;
            }
        }
        return true;
    }

    makeMove(pileIndex, count) {
        if (!this.isValidMove(pileIndex, count)) return false;
        if (this.rule === 'yet-another' && pileIndex === -1) {
            for (let i = 0; i < this.piles.length; i++) this.piles[i] -= count;
        } else {
            this.piles[pileIndex] -= count;
        }
        this.moveHistory.push({ player: this.currentPlayer, pileIndex, count, pilesAfter: [...this.piles] });
        return true;
    }

    checkGameOver() {
        switch (this.rule) {
            case 'bash': case 'nim': case 'wythoff': case 'fragmented-nim': case 'yet-another':
                const total = this.piles.reduce((a,b)=>a+b,0);
                return total === 0 ? this.currentPlayer : null;
            case 'euclid':
                return (this.piles[0]===0||this.piles[1]===0) ? this.currentPlayer : null;
            case 'bunny-egg':
                return this._bunnyEggNoMoves() ? (this.currentPlayer===1?2:1) : null;
            case 'wood-chess':
                return this._woodChessFull() ? null : null;
            default: return null;
        }
    }

    _bunnyEggNoMoves() {
        if (!this.grid || !this.emptyPos) return true;
        const [er, ec] = this.emptyPos;
        const targetColor = this.currentPlayer === 1 ? 'O' : 'X';
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        for (const [dr,dc] of dirs) {
            const nr = er+dr, nc = ec+dc;
            if (nr>=0 && nr<this.grid.length && nc>=0 && nc<this.grid[0].length && this.grid[nr][nc]===targetColor) {
                return false;
            }
        }
        return true;
    }

    _woodChessFull() {
        if (!this.grid) return true;
        for (let r=0; r<this.grid.length; r++)
            for (let c=0; c<this.grid[0].length; c++)
                if (this.grid[r][c]===null) return false;
        return true;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        this.selectedPile = null;
        this.selectedCell = null;
    }

    getState() {
        return {
            piles: [...this.piles], currentPlayer: this.currentPlayer,
            moveHistory: [...this.moveHistory], problemId: this.problem.id,
            grid: this.grid, emptyPos: this.emptyPos, scores: {...this.scores}
        };
    }

    loadState(state) {
        this.piles = [...(state.piles||[])];
        this.currentPlayer = state.currentPlayer;
        this.moveHistory = state.moveHistory || [];
        this.grid = state.grid;
        this.emptyPos = state.emptyPos;
        this.scores = state.scores || {p1:0,p2:0};
    }
}