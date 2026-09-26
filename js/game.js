class GameEngine {
    constructor(problem) {
        this.problem = problem;
        this.rule = problem.rule;
        this.piles = [...(problem.piles || problem.defaultPiles || [])];
        this.currentPlayer = 1;
        this.moveHistory = [];
        this.selectedPile = null;
        this.grid = problem.board ? problem.board.map(row => [...row]) : null;
        this.emptyPos = this.grid ? GameEngine.findEmpty(this.grid) : null;
        this.scores = { p1: 0, p2: 0 };
        this.selectedCell = null;
        this.finished = false;
    }

    static findEmpty(grid) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) if (grid[r][c] === '.') return [r, c];
        }
        return null;
    }

    isValidMove(pileIndex, count) {
        if (!Number.isInteger(count) || count <= 0) return false;
        if (pileIndex === -1) {
            return ['wythoff', 'yet-another'].includes(this.rule) &&
                this.piles.length > 0 && count <= Math.min(...this.piles);
        }
        if (!Number.isInteger(pileIndex) || pileIndex < 0 || pileIndex >= this.piles.length) return false;
        if (count > this.piles[pileIndex]) return false;
        return !(this.rule === 'bash' && this.problem.maxTake && count > this.problem.maxTake);
    }

    makeMove(pileIndex, count) {
        if (this.finished || !this.isValidMove(pileIndex, count)) return false;
        if (pileIndex === -1) this.piles = this.piles.map(value => value - count);
        else this.piles[pileIndex] -= count;
        this.moveHistory.push({ player: this.currentPlayer, pileIndex, count, pilesAfter: [...this.piles] });
        return true;
    }

    checkGameOver() {
        if (['bash', 'nim', 'wythoff', 'fragmented-nim', 'yet-another'].includes(this.rule)) {
            return this.piles.every(value => value === 0) ? this.currentPlayer : null;
        }
        if (this.rule === 'euclid') return this.piles.some(value => value === 0) ? this.currentPlayer : null;
        if (this.rule === 'bunny-egg') return this._bunnyEggNoMoves() ? (this.currentPlayer === 1 ? 2 : 1) : null;
        return null;
    }

    _bunnyEggNoMoves() {
        if (!this.grid || !this.emptyPos) return true;
        const [er, ec] = this.emptyPos;
        const target = this.currentPlayer === 1 ? 'O' : 'X';
        return ![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => {
            const r = er + dr, c = ec + dc;
            return r >= 0 && r < this.grid.length && c >= 0 && c < this.grid[r].length && this.grid[r][c] === target;
        });
    }

    _woodChessFull() {
        return !this.grid || this.grid.every(row => row.every(cell => cell !== null));
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
            grid: this.grid ? this.grid.map(row => [...row]) : null,
            emptyPos: this.emptyPos ? [...this.emptyPos] : null,
            scores: { ...this.scores }, selectedPile: this.selectedPile, finished: this.finished
        };
    }

    loadState(state) {
        this.piles = [...(state.piles || [])];
        this.currentPlayer = state.currentPlayer === 2 ? 2 : 1;
        this.moveHistory = Array.isArray(state.moveHistory) ? [...state.moveHistory] : [];
        this.grid = state.grid ? state.grid.map(row => [...row]) : null;
        this.emptyPos = state.emptyPos ? [...state.emptyPos] : GameEngine.findEmpty(this.grid || []);
        this.scores = state.scores || { p1: 0, p2: 0 };
        this.selectedPile = Number.isInteger(state.selectedPile) ? state.selectedPile : null;
        this.finished = Boolean(state.finished);
    }
}

const GameSolvers = {
    nim(piles) {
        const xor = piles.reduce((sum, value) => sum ^ value, 0);
        if (!xor) return null;
        for (let i = 0; i < piles.length; i++) {
            const target = piles[i] ^ xor;
            if (target < piles[i]) return { pileIndex: i, count: piles[i] - target };
        }
        return null;
    },

    wythoff(piles) {
        const cold = ([x, y]) => {
            const a = Math.min(x, y), b = Math.max(x, y), k = b - a;
            return a === Math.floor(k * (1 + Math.sqrt(5)) / 2);
        };
        const moves = [];
        for (let i = 0; i < 2; i++) for (let count = 1; count <= piles[i]; count++) {
            const next = [...piles]; next[i] -= count;
            moves.push({ pileIndex: i, count, next });
        }
        for (let count = 1; count <= Math.min(...piles); count++) {
            moves.push({ pileIndex: -1, count, next: piles.map(value => value - count) });
        }
        const best = moves.find(move => cold(move.next));
        return best ? { pileIndex: best.pileIndex, count: best.count } : null;
    },

    euclid(piles) {
        const memo = new Map();
        const winning = (x, y) => {
            const a = Math.max(x, y), b = Math.min(x, y);
            if (b === 0) return false;
            const state = `${a},${b}`;
            if (memo.has(state)) return memo.get(state);
            for (let k = 1; k <= Math.floor(a / b); k++) {
                if (!winning(a - k * b, b)) { memo.set(state, true); return true; }
            }
            memo.set(state, false); return false;
        };
        const a = Math.max(...piles), b = Math.min(...piles);
        for (let k = 1; k <= Math.floor(a / b); k++) if (!winning(a - k * b, b)) return { k };
        return null;
    },

    subtraction(piles, allowGlobal = true) {
        const memo = new Map();
        const solve = values => {
            const state = values.join(',');
            if (memo.has(state)) return memo.get(state);
            if (values.every(value => value === 0)) return false;
            const moves = [];
            values.forEach((value, index) => {
                for (let count = 1; count <= value; count++) {
                    const next = [...values]; next[index] -= count;
                    moves.push({ pileIndex: index, count, next });
                }
            });
            if (allowGlobal && Math.min(...values) > 0) {
                for (let count = 1; count <= Math.min(...values); count++) {
                    moves.push({ pileIndex: -1, count, next: values.map(value => value - count) });
                }
            }
            const result = moves.find(move => !solve(move.next)) || false;
            memo.set(state, result);
            return result;
        };
        const result = solve(piles);
        return result && { pileIndex: result.pileIndex, count: result.count };
    },

    stringScore(value) {
        const memo = new Map();
        const occurrences = (text, pattern) => {
            let count = 0;
            for (let i = 0; i + pattern.length <= text.length; i++) if (text.slice(i, i + pattern.length) === pattern) count++;
            return count;
        };
        const solve = text => {
            if (!text) return 0;
            if (memo.has(text)) return memo.get(text);
            let best = -Infinity;
            for (let length = 1; length <= text.length; length++) {
                const prefix = text.slice(0, length);
                best = Math.max(best, occurrences(text, prefix) - solve(text.slice(length)));
            }
            memo.set(text, best);
            return best;
        };
        return solve(value);
    },

    tomCanForceWin(n, edges, tom, jerry) {
        const graph = Array.from({ length: n + 1 }, () => []);
        edges.forEach(([a, b]) => { graph[a].push(b); graph[b].push(a); });
        const id = (turn, t, j) => `${turn}:${t}:${j}`;
        const win = new Set();
        for (let t = 1; t <= n; t++) for (let j = 1; j <= n; j++) if (t === j) {
            win.add(id(0, t, j)); win.add(id(1, t, j));
        }
        const jerryMoves = (blocked, start) => {
            const seen = new Set([start]), queue = [start];
            for (let i = 0; i < queue.length; i++) for (const next of graph[queue[i]]) {
                if (next !== blocked && !seen.has(next)) { seen.add(next); queue.push(next); }
            }
            return [...seen];
        };
        let changed = true;
        while (changed) {
            changed = false;
            for (let t = 1; t <= n; t++) for (let j = 1; j <= n; j++) if (t !== j) {
                if (!win.has(id(1, t, j)) && [t, ...graph[t]].some(next => next === j || win.has(id(0, next, j)))) {
                    win.add(id(1, t, j)); changed = true;
                }
                const moves = jerryMoves(t, j);
                if (!win.has(id(0, t, j)) && moves.every(next => win.has(id(1, t, next)))) {
                    win.add(id(0, t, j)); changed = true;
                }
            }
        }
        return win.has(id(0, tom, jerry));
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { GameEngine, GameSolvers };
