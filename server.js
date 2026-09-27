'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const ROOM_TTL = 2 * 60 * 60 * 1000;
const rooms = new Map();
const mime = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function safePath(url) {
    const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const target = path.resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
    return target === ROOT || target.startsWith(`${ROOT}${path.sep}`) ? target : null;
}

const server = http.createServer((req, res) => {
    const target = safePath(req.url);
    if (!target) { res.writeHead(403).end('Forbidden'); return; }
    fs.stat(target, (statError, stat) => {
        const file = !statError && stat.isDirectory() ? path.join(target, 'index.html') : target;
        fs.readFile(file, (error, data) => {
            if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(data);
        });
    });
});

const clients = new Set();
function frame(opcode, payload = Buffer.alloc(0)) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    let header;
    if (data.length < 126) { header = Buffer.alloc(2); header[1] = data.length; }
    else if (data.length <= 65535) { header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(data.length, 2); }
    else { header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
    header[0] = 0x80 | opcode; return Buffer.concat([header, data]);
}
function createPeer(socket) {
    const peer = { socket, isAlive: true, roomCode: null, playerNumber: null, playerToken: null,
        send(value) { if (!socket.destroyed) socket.write(frame(1, value)); },
        close(code = 1000, reason = '') { if (socket.destroyed) return; const body = Buffer.alloc(2 + Buffer.byteLength(reason)); body.writeUInt16BE(code); body.write(reason, 2); socket.write(frame(8, body)); socket.end(); },
        terminate() { socket.destroy(); } };
    let buffered = Buffer.alloc(0);
    socket.on('data', chunk => {
        buffered = Buffer.concat([buffered, chunk]);
        while (buffered.length >= 2) {
            const first = buffered[0], second = buffered[1], opcode = first & 0x0f, masked = Boolean(second & 0x80); let length = second & 0x7f, offset = 2;
            if (length === 126) { if (buffered.length < 4) return; length = buffered.readUInt16BE(2); offset = 4; }
            else if (length === 127) { if (buffered.length < 10) return; const large = buffered.readBigUInt64BE(2); if (large > 131072n) { peer.close(1009, '消息过大'); return; } length = Number(large); offset = 10; }
            const maskLength = masked ? 4 : 0; if (buffered.length < offset + maskLength + length) return;
            const mask = masked ? buffered.subarray(offset, offset + 4) : null; offset += maskLength;
            const payload = Buffer.from(buffered.subarray(offset, offset + length)); buffered = buffered.subarray(offset + length);
            if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            if (opcode === 1) handleMessage(peer, payload);
            else if (opcode === 8) { peer.close(); return; }
            else if (opcode === 9) socket.write(frame(10, payload));
            else if (opcode === 10) peer.isAlive = true;
        }
    });
    socket.on('close', () => handleClose(peer)); socket.on('error', () => socket.destroy()); clients.add(peer); return peer;
}
const code = () => {
    if (rooms.size >= 9000) throw new Error('房间数量已满');
    let value = '';
    do { value = String(crypto.randomInt(1000, 10000)); } while (rooms.has(value));
    return value;
};
const token = () => crypto.randomBytes(18).toString('base64url');
const nickname = (value, fallback) => String(value || fallback).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 12) || fallback;
const send = (ws, message) => ws && !ws.socket.destroyed && ws.send(JSON.stringify(message));
const publicRoom = room => ({
    roomCode: room.code, problemId: room.problemId, setup: room.setup,
    state: room.state, status: room.status, version: room.version,
    winner: room.winner ?? null, reason: room.reason || '',
    connected: room.players.map(player => Boolean(player?.socket && !player.socket.socket.destroyed)),
    names: [...room.names], humanSlots: room.humanSlots || 2, chat: [...(room.chat || [])]
});
const broadcast = (room, message, except = null) => room.players.forEach(player => {
    if (player?.socket !== except) send(player?.socket, message);
});

function closeWithError(ws, requestId, message) { send(ws, { type: 'error', requestId, message }); }
function attach(ws, room, playerNumber, playerToken) {
    const index = playerNumber - 1;
    if (room.players[index]?.socket && room.players[index].socket !== ws) room.players[index].socket.close(4001, '已在另一窗口连接');
    room.players[index] = { token: playerToken, socket: ws, disconnectedAt: null };
    ws.roomCode = room.code; ws.playerNumber = playerNumber; ws.playerToken = playerToken;
    room.updatedAt = Date.now();
}

function handleMessage(ws, raw) {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { return closeWithError(ws, null, '消息格式错误'); }
        const requestId = message.requestId || null;

        if (message.type === 'create_room') {
            if (!message.problemId || !message.setup || !message.state) return closeWithError(ws, requestId, '房间配置不完整');
            const roomCode = code(), playerToken = token();
            const playerCount = Math.max(2, Math.min(4, Number(message.setup.playerCount) || 2)), humanSlots = Math.max(1, Math.min(playerCount, Number(message.setup.humanSlots) || 2));
            const names = Array(playerCount).fill(null); names[0] = nickname(message.nickname, '玩家1');
            for (let index = humanSlots; index < playerCount; index++) names[index] = `策略 AI ${index - humanSlots + 1}`;
            const room = { code: roomCode, problemId: message.problemId, setup: message.setup, state: message.state, status: humanSlots === 1 ? 'playing' : 'waiting', version: 0, players: Array(playerCount).fill(null), names, humanSlots, chat: [], updatedAt: Date.now() };
            rooms.set(roomCode, room); attach(ws, room, 1, playerToken);
            send(ws, { type: 'room_created', requestId, playerNumber: 1, playerToken, room: publicRoom(room) });
            return;
        }
        if (message.type === 'join_room') {
            const room = rooms.get(String(message.roomCode || '').toUpperCase());
            if (!room) return closeWithError(ws, requestId, '房间不存在或已过期');
            const seat = room.players.slice(0, room.humanSlots).findIndex(player => !player);
            if (room.status !== 'waiting' || seat < 0) return closeWithError(ws, requestId, '房间已满或已经开始');
            const playerNumber = seat + 1, playerToken = token(); room.names[seat] = nickname(message.nickname, `玩家${playerNumber}`); attach(ws, room, playerNumber, playerToken);
            if (room.players.slice(0, room.humanSlots).every(Boolean)) room.status = 'playing'; room.version++;
            send(ws, { type: 'room_joined', requestId, playerNumber, playerToken, room: publicRoom(room) });
            broadcast(room, { type: 'player_joined', room: publicRoom(room) }, ws);
            return;
        }
        if (message.type === 'resume_room') {
            const room = rooms.get(String(message.roomCode || '').toUpperCase());
            if (!room) return closeWithError(ws, requestId, '房间已过期');
            const index = room.players.findIndex(player => player?.token === message.playerToken);
            if (index < 0) return closeWithError(ws, requestId, '重连凭证无效');
            attach(ws, room, index + 1, message.playerToken);
            send(ws, { type: 'room_resumed', requestId, playerNumber: index + 1, playerToken: message.playerToken, room: publicRoom(room) });
            broadcast(room, { type: 'presence', playerNumber: index + 1, connected: true, room: publicRoom(room) }, ws);
            return;
        }

        const room = rooms.get(ws.roomCode);
        if (!room || !ws.playerNumber) return closeWithError(ws, requestId, '尚未加入房间');
        room.updatedAt = Date.now();
        if (message.type === 'sync_state') {
            if (room.status !== 'playing') return closeWithError(ws, requestId, '对局不在进行中');
            const aiTurn = Array.isArray(room.setup.aiPlayers) && room.setup.aiPlayers.includes(room.state.currentPlayer) && ws.playerNumber === 1;
            if (room.state.currentPlayer !== ws.playerNumber && !aiTurn) return closeWithError(ws, requestId, '还没有轮到你');
            if (message.baseVersion !== room.version) return send(ws, { type: 'state_conflict', room: publicRoom(room) });
            if (!message.state || !Number.isInteger(message.state.currentPlayer) || message.state.currentPlayer < 1 || message.state.currentPlayer > room.players.length) return closeWithError(ws, requestId, '游戏状态无效');
            room.state = message.state; room.version++;
            broadcast(room, { type: 'state_updated', playerNumber: ws.playerNumber, description: String(message.description || '').slice(0, 120), room: publicRoom(room) });
        } else if (message.type === 'finish_game') {
            room.state = message.state || room.state; room.status = 'finished'; room.winner = [0, 1, 2].includes(message.winner) ? message.winner : 0; room.reason = String(message.reason || '').slice(0, 80); room.version++;
            broadcast(room, { type: 'game_finished', winner: [0, 1, 2].includes(message.winner) ? message.winner : 0, reason: String(message.reason || '').slice(0, 80), room: publicRoom(room) });
        } else if (message.type === 'restart_game') {
            if (ws.playerNumber !== 1) return closeWithError(ws, requestId, '只有房主可以开始下一局');
            if (room.status !== 'finished') return closeWithError(ws, requestId, '当前对局尚未结束');
            const nextCount = Math.max(2, Math.min(4, Number(message.setup?.playerCount) || 2));
            if (!message.problemId || !message.setup || !message.state || nextCount < room.humanSlots || !Number.isInteger(message.state.currentPlayer) || message.state.currentPlayer < 1 || message.state.currentPlayer > nextCount) return closeWithError(ws, requestId, '下一局配置不完整');
            room.players.length = nextCount; room.names.length = nextCount;
            for (let index = room.humanSlots; index < nextCount; index++) { room.players[index] = null; room.names[index] = `策略 AI ${index - room.humanSlots + 1}`; }
            message.setup.playerCount = nextCount; message.setup.humanSlots = room.humanSlots; message.setup.aiPlayers = Array.from({ length: nextCount - room.humanSlots }, (_, index) => room.humanSlots + index + 1);
            room.problemId = message.problemId; room.setup = message.setup; room.state = message.state; room.status = 'playing'; room.winner = null; room.reason = ''; room.version++;
            broadcast(room, { type: 'game_restarted', room: publicRoom(room) });
        } else if (message.type === 'rematch_request') {
            if (room.status !== 'finished') return closeWithError(ws, requestId, '当前对局尚未结束');
            broadcast(room, { type: 'rematch_requested', playerNumber: ws.playerNumber, playerName: room.names[ws.playerNumber - 1], room: publicRoom(room) }, ws);
        } else if (message.type === 'chat_message') {
            const now = Date.now(); if (ws.lastChatAt && now - ws.lastChatAt < 700) return closeWithError(ws, requestId, '消息发送太快'); ws.lastChatAt = now;
            let text = String(message.text || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 120); if (!text) return;
            const blocked = ['傻逼','操你','妈的','草泥马','垃圾','废物','fuck','shit','bitch'];
            for (const word of blocked) text = text.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '*'.repeat(Math.min(word.length, 6)));
            const chat = { playerNumber: ws.playerNumber, playerName: room.names[ws.playerNumber - 1], text, at: now };
            room.chat.push(chat); if (room.chat.length > 50) room.chat.shift(); broadcast(room, { type: 'chat_message', chat });
        } else if (message.type === 'ping') {
            send(ws, { type: 'pong', now: Date.now() });
        }
}
function handleClose(ws) {
    clients.delete(ws); const room = rooms.get(ws.roomCode), player = room?.players[ws.playerNumber - 1];
    if (player?.socket === ws) { player.socket = null; player.disconnectedAt = Date.now(); room.updatedAt = Date.now(); broadcast(room, { type: 'presence', playerNumber: ws.playerNumber, connected: false, room: publicRoom(room) }); }
}
server.on('upgrade', (request, socket) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws' || !request.headers['sec-websocket-key']) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    createPeer(socket);
});

const heartbeat = setInterval(() => {
    for (const ws of clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; if (!ws.socket.destroyed) ws.socket.write(frame(9)); }
    const now = Date.now(); for (const [roomCode, room] of rooms) if (now - room.updatedAt > ROOM_TTL) rooms.delete(roomCode);
}, 30000); heartbeat.unref();

if (require.main === module) server.listen(PORT, () => console.log(`巴巴博弈已启动：http://localhost:${PORT}`));
module.exports = { server, rooms };
