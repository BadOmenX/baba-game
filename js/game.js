class GameEngine {
    constructor(problem) {
        this.problem = problem; this.rule = problem.rule;
        this.piles = [...(problem.piles || problem.defaultPiles || [])];
        this.currentPlayer = 1; this.moveHistory = []; this.selectedPile = null; this.selectedCell = null;
        this.grid = problem.board ? problem.board.map(row => [...row]) : null;
        this.emptyPos = this.grid ? GameEngine.findEmpty(this.grid) : null;
        this.scores = { p1: 0, p2: 0 }; this.finished = false;
        this.forcedPile = this.rule === 'fragmented-nim' ? this.piles.findIndex(value => value > 0) : null;
        this.text = problem.s || '';
        this.tree = problem.edges ? { edges: problem.edges.map(edge => [...edge]), root: problem.root || 1, pieces: [...(problem.pieces || [])] } : null;
        this.tom = problem.tom || null; this.jerry = problem.jerry || null; this.round = 0; this.maxRounds = problem.maxRounds || 12;
    }

    static findEmpty(grid) {
        for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) if (grid[r][c] === '.') return [r, c];
        return null;
    }

    isValidMove(pileIndex, count) {
        if (this.finished || !Number.isInteger(count) || count <= 0) return false;
        if (pileIndex === -1) return ['wythoff', 'yet-another'].includes(this.rule) && this.piles.length > 0 && count <= Math.min(...this.piles);
        if (!Number.isInteger(pileIndex) || pileIndex < 0 || pileIndex >= this.piles.length || count > this.piles[pileIndex]) return false;
        if (this.rule === 'bash' && this.problem.maxTake && count > this.problem.maxTake) return false;
        return this.rule !== 'fragmented-nim' || pileIndex === this.forcedPile;
    }

    makeMove(pileIndex, count, options = {}) {
        if (!this.isValidMove(pileIndex, count)) return false;
        const next = pileIndex === -1 ? this.piles.map(value => value - count) : [...this.piles];
        if (pileIndex !== -1) next[pileIndex] -= count;
        let forcedPile = this.forcedPile;
        if (this.rule === 'fragmented-nim' && next.some(value => value > 0)) {
            forcedPile = Number(options.nextPile);
            if (!Number.isInteger(forcedPile) || forcedPile < 0 || forcedPile >= next.length || next[forcedPile] <= 0) return false;
        }
        this.piles = next; this.forcedPile = forcedPile;
        this.moveHistory.push({ player: this.currentPlayer, type: 'take', pileIndex, count, nextPile: forcedPile, pilesAfter: [...this.piles] }); return true;
    }

    makeEuclidMove(k) {
        if (this.finished || this.rule !== 'euclid' || !Number.isInteger(k) || k < 1) return false;
        let [a, b] = this.piles; if (b <= 0 || k > Math.floor(a / b)) return false;
        a -= k * b; this.piles = [Math.max(a, b), Math.min(a, b)];
        this.moveHistory.push({ player: this.currentPlayer, type: 'euclid', count: k, pilesAfter: [...this.piles] }); return true;
    }

    legalBunnyMoves(player = this.currentPlayer) {
        if (!this.grid || !this.emptyPos) return [];
        const [er, ec] = this.emptyPos, target = player === 1 ? 'O' : 'X', moves = [];
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const r = er + dr, c = ec + dc;
            if (r >= 0 && r < this.grid.length && c >= 0 && c < this.grid[r].length && this.grid[r][c] === target) moves.push({ from: [r, c], to: [er, ec] });
        }
        return moves;
    }

    makeBunnyMove(row, col) {
        const move = this.legalBunnyMoves().find(item => item.from[0] === row && item.from[1] === col);
        if (!move || this.finished) return false;
        const [er, ec] = this.emptyPos; this.grid[er][ec] = this.grid[row][col]; this.grid[row][col] = '.'; this.emptyPos = [row, col];
        this.moveHistory.push({ player: this.currentPlayer, type: 'slide', from: [row, col], to: [er, ec] }); return true;
    }

    canPlaceWood(row, col) {
        if (!this.grid || this.grid[row]?.[col] !== null) return false;
        for (let r = 0; r < row; r++) if (this.grid[r][col] === null) return false;
        for (let c = 0; c < col; c++) if (this.grid[row][c] === null) return false;
        return true;
    }
    makeWoodMove(row, col) {
        if (this.finished || !this.canPlaceWood(row, col)) return false;
        this.grid[row][col] = this.currentPlayer; const gain = this.currentPlayer === 1 ? this.problem.a[row][col] : this.problem.b[row][col];
        this.scores[`p${this.currentPlayer}`] += gain; this.moveHistory.push({ player: this.currentPlayer, type: 'place', row, col, gain }); return true;
    }
    woodFull() { return Boolean(this.grid) && this.grid.every(row => row.every(cell => cell !== null)); }

    treeOrientation() {
        if (!this.tree) return { children: [], descendants: () => [] };
        const n = this.tree.pieces.length, graph = Array.from({ length: n + 1 }, () => []);
        this.tree.edges.forEach(([a, b]) => { graph[a].push(b); graph[b].push(a); });
        const children = Array.from({ length: n + 1 }, () => []), parent = Array(n + 1).fill(0), queue = [this.tree.root]; parent[this.tree.root] = -1;
        for (let i = 0; i < queue.length; i++) for (const next of graph[queue[i]]) if (!parent[next]) { parent[next] = queue[i]; children[queue[i]].push(next); queue.push(next); }
        const descendants = node => { const result = [], todo = [...children[node]]; for (let i = 0; i < todo.length; i++) { result.push(todo[i]); todo.push(...children[todo[i]]); } return result; };
        return { children, descendants };
    }
    legalTreeMoves() {
        if (!this.tree) return [];
        const { descendants } = this.treeOrientation(), moves = [];
        this.tree.pieces.forEach((amount, index) => { if (amount > 0) descendants(index + 1).forEach(to => moves.push({ from: index + 1, to })); }); return moves;
    }
    makeTreeMove(from, to) {
        if (this.finished || !this.legalTreeMoves().some(move => move.from === from && move.to === to)) return false;
        this.tree.pieces[from - 1]--; this.tree.pieces[to - 1]++; this.moveHistory.push({ player: this.currentPlayer, type: 'tree', from, to }); return true;
    }

    graph() {
        const n = this.problem.n || 0, graph = Array.from({ length: n + 1 }, () => []);
        (this.problem.edges || []).forEach(([a, b]) => { graph[a].push(b); graph[b].push(a); }); return graph;
    }
    legalTomMoves(player = this.currentPlayer) {
        const graph = this.graph();
        if (player === 2) return [...new Set([this.tom, ...graph[this.tom]])];
        const seen = new Set([this.jerry]), queue = [this.jerry];
        for (let i = 0; i < queue.length; i++) for (const next of graph[queue[i]]) if (next !== this.tom && !seen.has(next)) { seen.add(next); queue.push(next); }
        seen.delete(this.jerry); return [...seen];
    }
    makeTomMove(target) {
        if (this.finished || !this.legalTomMoves().includes(target)) return false;
        if (this.currentPlayer === 1) this.jerry = target; else { this.tom = target; this.round++; }
        this.moveHistory.push({ player: this.currentPlayer, type: 'graph', target, tom: this.tom, jerry: this.jerry, round: this.round }); return true;
    }

    prefixOccurrences(length) {
        if (!Number.isInteger(length) || length < 1 || length > this.text.length) return 0;
        const prefix = this.text.slice(0, length); let count = 0;
        for (let i = 0; i + length <= this.text.length; i++) if (this.text.slice(i, i + length) === prefix) count++;
        return count;
    }
    makeStringMove(length) {
        const gain = this.prefixOccurrences(length); if (!gain || this.finished) return false;
        const removed = this.text.slice(0, length); this.text = this.text.slice(length); this.scores[`p${this.currentPlayer}`] += gain;
        this.moveHistory.push({ player: this.currentPlayer, type: 'prefix', length, removed, gain, remaining: this.text }); return true;
    }

    checkGameOver() {
        if (['bash', 'nim', 'wythoff', 'fragmented-nim', 'yet-another'].includes(this.rule) && this.piles.every(value => value === 0)) return this.currentPlayer;
        if (this.rule === 'euclid' && this.piles.some(value => value === 0)) return this.currentPlayer;
        if (this.rule === 'bunny-egg' && this.legalBunnyMoves().length === 0) return this.currentPlayer === 1 ? 2 : 1;
        if (this.rule === 'tree-game' && this.legalTreeMoves().length === 0) return this.currentPlayer === 1 ? 2 : 1;
        if (this.rule === 'wood-chess' && this.woodFull()) return this.scores.p1 === this.scores.p2 ? 0 : this.scores.p1 > this.scores.p2 ? 1 : 2;
        if (this.rule === 'string-game' && !this.text) return this.scores.p1 === this.scores.p2 ? 0 : this.scores.p1 > this.scores.p2 ? 1 : 2;
        if (this.rule === 'tom-jerry') { if (this.tom === this.jerry || this.legalTomMoves(1).length === 0) return 2; if (this.round >= this.maxRounds) return 1; }
        return null;
    }

    switchPlayer() { this.currentPlayer = this.currentPlayer === 1 ? 2 : 1; this.selectedPile = null; this.selectedCell = null; }
    getState() {
        return { piles: [...this.piles], currentPlayer: this.currentPlayer, moveHistory: this.moveHistory.map(item => ({ ...item })), problemId: this.problem.id,
            grid: this.grid ? this.grid.map(row => [...row]) : null, emptyPos: this.emptyPos ? [...this.emptyPos] : null,
            scores: { ...this.scores }, selectedPile: this.selectedPile, forcedPile: this.forcedPile, text: this.text,
            tree: this.tree ? { edges: this.tree.edges.map(edge => [...edge]), root: this.tree.root, pieces: [...this.tree.pieces] } : null,
            tom: this.tom, jerry: this.jerry, round: this.round, maxRounds: this.maxRounds, finished: this.finished };
    }
    loadState(state) {
        this.piles = [...(state.piles || [])]; this.currentPlayer = state.currentPlayer === 2 ? 2 : 1;
        this.moveHistory = Array.isArray(state.moveHistory) ? state.moveHistory.map(item => ({ ...item })) : [];
        this.grid = state.grid ? state.grid.map(row => [...row]) : null; this.emptyPos = state.emptyPos ? [...state.emptyPos] : GameEngine.findEmpty(this.grid || []);
        this.scores = { p1: Number(state.scores?.p1) || 0, p2: Number(state.scores?.p2) || 0 };
        this.selectedPile = Number.isInteger(state.selectedPile) ? state.selectedPile : null; this.forcedPile = Number.isInteger(state.forcedPile) ? state.forcedPile : null;
        this.text = typeof state.text === 'string' ? state.text : this.text;
        this.tree = state.tree ? { edges: state.tree.edges.map(edge => [...edge]), root: state.tree.root, pieces: [...state.tree.pieces] } : this.tree;
        this.tom = state.tom ?? this.tom; this.jerry = state.jerry ?? this.jerry; this.round = Number(state.round) || 0; this.maxRounds = Number(state.maxRounds) || this.maxRounds;
        this.finished = Boolean(state.finished);
    }
}

const GameSolvers = {
    nim(piles) { const xor = piles.reduce((sum, value) => sum ^ value, 0); if (!xor) return null; for (let i = 0; i < piles.length; i++) { const target = piles[i] ^ xor; if (target < piles[i]) return { pileIndex: i, count: piles[i] - target }; } return null; },
    wythoff(piles) {
        const cold = ([x, y]) => { const a = Math.min(x, y), b = Math.max(x, y), k = b - a; return a === Math.floor(k * (1 + Math.sqrt(5)) / 2); }, moves = [];
        for (let i = 0; i < 2; i++) for (let count = 1; count <= piles[i]; count++) { const next = [...piles]; next[i] -= count; moves.push({ pileIndex: i, count, next }); }
        for (let count = 1; count <= Math.min(...piles); count++) moves.push({ pileIndex: -1, count, next: piles.map(value => value - count) });
        const best = moves.find(move => cold(move.next)); return best ? { pileIndex: best.pileIndex, count: best.count } : null;
    },
    euclid(piles) {
        const memo = new Map(), winning = (x, y) => { const a = Math.max(x, y), b = Math.min(x, y); if (b === 0) return false; const key = `${a},${b}`; if (memo.has(key)) return memo.get(key); for (let k = 1; k <= Math.floor(a / b); k++) if (!winning(a - k * b, b)) { memo.set(key, true); return true; } memo.set(key, false); return false; };
        const a = Math.max(...piles), b = Math.min(...piles); for (let k = 1; k <= Math.floor(a / b); k++) if (!winning(a - k * b, b)) return { k }; return null;
    },
    subtraction(piles, allowGlobal = true) {
        const memo = new Map(), solve = values => { const key = values.join(','); if (memo.has(key)) return memo.get(key); if (values.every(value => value === 0)) return false; const moves = []; values.forEach((value, index) => { for (let count = 1; count <= value; count++) { const next = [...values]; next[index] -= count; moves.push({ pileIndex: index, count, next }); } }); if (allowGlobal && Math.min(...values) > 0) for (let count = 1; count <= Math.min(...values); count++) moves.push({ pileIndex: -1, count, next: values.map(value => value - count) }); const result = moves.find(move => !solve(move.next)) || false; memo.set(key, result); return result; };
        const result = solve(piles); return result && { pileIndex: result.pileIndex, count: result.count };
    },
    stringMove(value) {
        const memo = new Map(), occurrences = (text, prefix) => { let count = 0; for (let i = 0; i + prefix.length <= text.length; i++) if (text.slice(i, i + prefix.length) === prefix) count++; return count; };
        const solve = text => { if (!text) return 0; if (memo.has(text)) return memo.get(text); let best = -Infinity; for (let length = 1; length <= text.length; length++) best = Math.max(best, occurrences(text, text.slice(0, length)) - solve(text.slice(length))); memo.set(text, best); return best; };
        let bestLength = 1, bestScore = -Infinity; for (let length = 1; length <= value.length; length++) { const score = occurrences(value, value.slice(0, length)) - solve(value.slice(length)); if (score > bestScore) { bestScore = score; bestLength = length; } } return { length: bestLength, score: bestScore };
    },
    stringScore(value) { return this.stringMove(value).score; },
    tomCanForceWin(n, edges, tom, jerry) {
        const graph = Array.from({ length: n + 1 }, () => []); edges.forEach(([a, b]) => { graph[a].push(b); graph[b].push(a); });
        const id = (turn, t, j) => `${turn}:${t}:${j}`, win = new Set(); for (let t = 1; t <= n; t++) { win.add(id(0, t, t)); win.add(id(1, t, t)); }
        const jerryMoves = (blocked, start) => { const seen = new Set([start]), queue = [start]; for (let i = 0; i < queue.length; i++) for (const next of graph[queue[i]]) if (next !== blocked && !seen.has(next)) { seen.add(next); queue.push(next); } return [...seen]; };
        let changed = true; while (changed) { changed = false; for (let t = 1; t <= n; t++) for (let j = 1; j <= n; j++) if (t !== j) { if (!win.has(id(1, t, j)) && [t, ...graph[t]].some(next => next === j || win.has(id(0, next, j)))) { win.add(id(1, t, j)); changed = true; } const moves = jerryMoves(t, j); if (!win.has(id(0, t, j)) && moves.every(next => win.has(id(1, t, next)))) { win.add(id(0, t, j)); changed = true; } } }
        return win.has(id(0, tom, jerry));
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { GameEngine, GameSolvers };
