const assert = require('node:assert/strict');
const { server, rooms } = require('../server.js');

function nextMessage(socket, expectedType) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`等待 ${expectedType} 超时`)), 3000);
        const listener = event => {
            const message = JSON.parse(event.data);
            if (message.type !== expectedType) return;
            clearTimeout(timeout); socket.removeEventListener('message', listener); resolve(message);
        };
        socket.addEventListener('message', listener);
    });
}
function open(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); socket.addEventListener('open', () => resolve(socket), { once: true }); socket.addEventListener('error', reject, { once: true }); }); }

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port, url = `ws://127.0.0.1:${port}/ws`;
    const host = await open(url), guest = await open(url);
    const createdPromise = nextMessage(host, 'room_created');
    host.send(JSON.stringify({ type: 'create_room', requestId: 'create', problemId: 'bash', setup: { id: 'bash', rule: 'bash' }, state: { currentPlayer: 1, piles: [3] } }));
    const created = await createdPromise; assert.match(created.room.roomCode, /^[A-Z2-9]{6}$/); assert.equal(created.playerNumber, 1);

    const hostJoined = nextMessage(host, 'player_joined'), guestJoined = nextMessage(guest, 'room_joined');
    guest.send(JSON.stringify({ type: 'join_room', requestId: 'join', roomCode: created.room.roomCode }));
    const joined = await guestJoined; await hostJoined; assert.equal(joined.playerNumber, 2); assert.equal(joined.room.status, 'playing');

    const hostUpdate = nextMessage(host, 'state_updated'), guestUpdate = nextMessage(guest, 'state_updated');
    host.send(JSON.stringify({ type: 'sync_state', baseVersion: 1, state: { currentPlayer: 2, piles: [2] }, description: '玩家1取1个' }));
    const update = await guestUpdate; await hostUpdate; assert.equal(update.room.state.currentPlayer, 2); assert.equal(update.room.version, 2);

    const resumedSocket = await open(url), resumedPromise = nextMessage(resumedSocket, 'room_resumed');
    resumedSocket.send(JSON.stringify({ type: 'resume_room', requestId: 'resume', roomCode: created.room.roomCode, playerToken: created.playerToken }));
    const resumed = await resumedPromise; assert.equal(resumed.playerNumber, 1); assert.equal(resumed.room.state.piles[0], 2);

    host.close(); guest.close(); resumedSocket.close(); rooms.clear(); await new Promise(resolve => server.close(resolve));
    console.log('✓ WebSocket 房间创建、加入、同步与重连');
})().catch(async error => { console.error(error); try { await new Promise(resolve => server.close(resolve)); } catch {} process.exitCode = 1; });
