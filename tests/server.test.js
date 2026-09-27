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
    host.send(JSON.stringify({ type: 'create_room', requestId: 'create', problemId: 'bash', nickname: '星河', setup: { id: 'bash', rule: 'bash' }, state: { currentPlayer: 1, piles: [3] } }));
    const created = await createdPromise; assert.match(created.room.roomCode, /^\d{4}$/); assert.equal(created.playerNumber, 1); assert.equal(created.room.names[0], '星河');

    const hostJoined = nextMessage(host, 'player_joined'), guestJoined = nextMessage(guest, 'room_joined');
    guest.send(JSON.stringify({ type: 'join_room', requestId: 'join', roomCode: created.room.roomCode, nickname: '清风' }));
    const joined = await guestJoined; await hostJoined; assert.equal(joined.playerNumber, 2); assert.equal(joined.room.status, 'playing'); assert.deepEqual(joined.room.names, ['星河', '清风']);

    const hostUpdate = nextMessage(host, 'state_updated'), guestUpdate = nextMessage(guest, 'state_updated');
    host.send(JSON.stringify({ type: 'sync_state', baseVersion: 1, state: { currentPlayer: 2, piles: [2] }, description: '玩家1取1个' }));
    const update = await guestUpdate; await hostUpdate; assert.equal(update.room.state.currentPlayer, 2); assert.equal(update.room.version, 2);

    const resumedSocket = await open(url), resumedPromise = nextMessage(resumedSocket, 'room_resumed');
    resumedSocket.send(JSON.stringify({ type: 'resume_room', requestId: 'resume', roomCode: created.room.roomCode, playerToken: created.playerToken }));
    const resumed = await resumedPromise; assert.equal(resumed.playerNumber, 1); assert.equal(resumed.room.state.piles[0], 2);

    const hostChat = nextMessage(resumedSocket, 'chat_message'), guestChat = nextMessage(guest, 'chat_message');
    guest.send(JSON.stringify({ type: 'chat_message', text: '你这个傻逼 fuck' }));
    const filteredChat = await hostChat; await guestChat; assert.equal(filteredChat.chat.text.includes('傻逼'), false); assert.equal(filteredChat.chat.text.toLowerCase().includes('fuck'), false);

    const hostFinished = nextMessage(resumedSocket, 'game_finished'), guestFinished = nextMessage(guest, 'game_finished');
    resumedSocket.send(JSON.stringify({ type: 'finish_game', winner: 1, state: { currentPlayer: 2, piles: [0], finished: true }, reason: '测试结束' }));
    await hostFinished; await guestFinished;

    const rematchRequested = nextMessage(resumedSocket, 'rematch_requested');
    guest.send(JSON.stringify({ type: 'rematch_request' }));
    const request = await rematchRequested; assert.equal(request.playerName, '清风');

    const hostRestarted = nextMessage(resumedSocket, 'game_restarted'), guestRestarted = nextMessage(guest, 'game_restarted');
    resumedSocket.send(JSON.stringify({ type: 'restart_game', problemId: 'nim', setup: { id: 'nim', rule: 'nim' }, state: { currentPlayer: 2, piles: [3, 4, 5] } }));
    const restarted = await guestRestarted; await hostRestarted; assert.equal(restarted.room.roomCode, created.room.roomCode); assert.equal(restarted.room.problemId, 'nim'); assert.deepEqual(restarted.room.names, ['星河', '清风']); assert.equal(restarted.room.status, 'playing');

    host.close(); guest.close(); resumedSocket.close(); rooms.clear();

    const partyHost = await open(url), partyGuests = [await open(url), await open(url), await open(url)];
    const partyCreatedPromise = nextMessage(partyHost, 'room_created');
    partyHost.send(JSON.stringify({ type:'create_room', requestId:'party-create', nickname:'房主', problemId:'party-nim', setup:{ id:'party-nim', rule:'party-nim', playerCount:4, humanSlots:4, aiPlayers:[] }, state:{ currentPlayer:1, playerCount:4, piles:[3,4,5] } }));
    const partyCreated = await partyCreatedPromise; assert.equal(partyCreated.room.names.length, 4);
    for (let index=0; index<3; index++) { const hostNotice=nextMessage(partyHost,'player_joined'), joinedPromise=nextMessage(partyGuests[index],'room_joined'); partyGuests[index].send(JSON.stringify({type:'join_room',requestId:`p${index}`,roomCode:partyCreated.room.roomCode,nickname:`玩家${index+2}`})); const joinedParty=await joinedPromise; await hostNotice; assert.equal(joinedParty.playerNumber,index+2); if(index<2)assert.equal(joinedParty.room.status,'waiting'); else assert.equal(joinedParty.room.status,'playing'); }
    partyHost.close(); partyGuests.forEach(socket=>socket.close()); rooms.clear(); await new Promise(resolve => server.close(resolve));
    console.log('✓ WebSocket 房间、敏感词聊天、同房续局与四人组局');
})().catch(async error => { console.error(error); try { await new Promise(resolve => server.close(resolve)); } catch {} process.exitCode = 1; });
