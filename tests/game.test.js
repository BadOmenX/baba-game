const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { GameEngine, GameSolvers } = require('../js/game.js');

function test(name, fn) {
    try { fn(); console.log(`✓ ${name}`); }
    catch (error) { console.error(`✗ ${name}`); throw error; }
}

test('拒绝 NaN、零、负数与越界取子', () => {
    const game = new GameEngine({ rule: 'nim', piles: [3, 4] });
    for (const value of [NaN, 0, -1, 1.5]) assert.equal(game.isValidMove(0, value), false);
    assert.equal(game.isValidMove(2, 1), false);
    assert.equal(game.isValidMove(1, 4), true);
});

test('最后一步的玩家获胜', () => {
    const game = new GameEngine({ rule: 'bash', piles: [1], maxTake: 3 });
    assert.equal(game.makeMove(0, 1), true);
    assert.equal(game.checkGameOver(), 1);
});

test('状态序列化不会共享棋盘引用', () => {
    const game = new GameEngine({ rule: 'bunny-egg', board: [['.', 'O'], ['X', 'O']] });
    const state = game.getState();
    state.grid[0][1] = 'X';
    assert.equal(game.grid[0][1], 'O');
});

test('碎片化 Nim 只能从指定堆取，并正确指定下一堆', () => {
    const game = new GameEngine({ rule: 'fragmented-nim', piles: [2, 3], id: 'fragmented-nim' });
    assert.equal(game.forcedPile, 0);
    assert.equal(game.makeMove(1, 1, { nextPile: 0 }), false);
    assert.equal(game.makeMove(0, 1, { nextPile: 1 }), true);
    assert.equal(game.forcedPile, 1);
    assert.deepEqual(game.piles, [1, 3]);
});

test('兔兔与蛋蛋按下一位玩家无路可走判负', () => {
    const game = new GameEngine({ rule: 'bunny-egg', board: [['O', '.'], ['O', 'O']], id: 'bunny-egg' });
    assert.equal(game.makeBunnyMove(0, 0), true);
    game.switchPlayer();
    assert.equal(game.checkGameOver(), 1);
});

test('木棋按双方各自权值累计并允许平局', () => {
    const game = new GameEngine({ rule: 'wood-chess', n: 1, m: 2, a: [[3, 1]], b: [[2, 3]], id: 'wood-chess' });
    game.grid = [[null, null]];
    assert.equal(game.makeWoodMove(0, 0), true);
    game.switchPlayer();
    assert.equal(game.makeWoodMove(0, 1), true);
    assert.deepEqual(game.scores, { p1: 3, p2: 3 });
    assert.equal(game.checkGameOver(), 0);
});

test('树上棋子只能向当前根的后代移动', () => {
    const game = new GameEngine({ rule: 'tree-game', edges: [[1,2],[2,3]], root: 1, pieces: [1,0,0], id: 'tree-game' });
    assert.deepEqual(game.legalTreeMoves(), [{ from: 1, to: 2 }, { from: 1, to: 3 }]);
    assert.equal(game.makeTreeMove(1, 3), true);
    game.switchPlayer();
    assert.equal(game.checkGameOver(), 1);
});

test('字符串游戏实际删除前缀并按出现次数计分', () => {
    const game = new GameEngine({ rule: 'string-game', s: 'ababa', id: 'string-game' });
    assert.equal(game.prefixOccurrences(1), 3);
    assert.equal(game.makeStringMove(1), true);
    assert.equal(game.text, 'baba');
    assert.equal(game.scores.p1, 3);
});

test('Tom 抓到 Jerry 与 Jerry 生存轮数的胜负判定', () => {
    const caught = new GameEngine({ rule: 'tom-jerry', n: 2, edges: [[1,2]], tom: 1, jerry: 2, id: 'tom-jerry' });
    caught.currentPlayer = 2; assert.equal(caught.makeTomMove(2), true); assert.equal(caught.checkGameOver(), 2);
    const escaped = new GameEngine({ rule: 'tom-jerry', n: 3, edges: [[1,2],[2,3],[3,1]], tom: 1, jerry: 2, maxRounds: 2, id: 'tom-jerry' });
    escaped.round = 2; assert.equal(escaped.checkGameOver(), 1);
});

test('Nim AI 将局面移动到异或和为零', () => {
    const piles = [3, 4, 6], move = GameSolvers.nim(piles);
    assert.ok(move);
    const next = [...piles]; next[move.pileIndex] -= move.count;
    assert.equal(next.reduce((sum, value) => sum ^ value, 0), 0);
});

test('Wythoff AI 识别冷局面和合法最优步', () => {
    assert.equal(GameSolvers.wythoff([6, 10]), null);
    const move = GameSolvers.wythoff([7, 10]);
    assert.deepEqual(move, { pileIndex: 0, count: 1 });
});

test('欧几里得 AI 返回合法必胜步', () => {
    const move = GameSolvers.euclid([25, 7]);
    assert.ok(move.k >= 1 && move.k <= 3);
});

test('字符串挑战使用极小化搜索而不是随机答案', () => {
    assert.equal(GameSolvers.stringScore('ababa'), 2);
    assert.equal(GameSolvers.stringScore('aaaaa'), 3);
    assert.equal(GameSolvers.stringScore('abcabc'), 1);
});

test('Tom & Jerry 示例结论正确', () => {
    assert.equal(GameSolvers.tomCanForceWin(4, [[1,2],[2,3],[3,4],[4,1]], 1, 3), false);
    assert.equal(GameSolvers.tomCanForceWin(5, [[1,2],[1,3],[1,4],[1,5]], 2, 4), true);
});

test('随机挑战答案由求解器生成', () => {
    const context = { GameSolvers };
    vm.createContext(context);
    vm.runInContext(`${fs.readFileSync(require.resolve('../js/problems.js'), 'utf8')}\nthis.list=PROBLEMS;`, context);
    const graph = context.list.find(problem => problem.id === 'tom-jerry').randomChallenge();
    assert.equal(graph.answer, GameSolvers.tomCanForceWin(graph.n, graph.edges, graph.tom, graph.jerry) ? 'Yes' : 'No');
    const string = context.list.find(problem => problem.id === 'string-game').randomChallenge();
    assert.equal(string.answer, GameSolvers.stringScore(string.s));
});

console.log('All game tests passed.');
