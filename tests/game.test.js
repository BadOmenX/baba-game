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
