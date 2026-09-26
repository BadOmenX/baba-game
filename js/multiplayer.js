class RoomClient extends EventTarget {
    constructor() {
        super(); this.socket = null; this.pending = new Map(); this.room = null;
        this.playerNumber = null; this.playerToken = null; this.requestSequence = 0;
    }
    connect() {
        if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.socket = new WebSocket(`${protocol}//${location.host}/ws`);
            const timeout = setTimeout(() => reject(new Error('连接房间服务超时')), 7000);
            this.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
            this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('无法连接房间服务，请使用 npm start 启动项目')); }, { once: true });
            this.socket.addEventListener('message', event => this._receive(JSON.parse(event.data)));
            this.socket.addEventListener('close', () => this.dispatchEvent(new CustomEvent('connection', { detail: { connected: false } })));
        });
    }
    _receive(message) {
        if (message.room) this.room = message.room;
        if (message.requestId && this.pending.has(message.requestId)) {
            const { resolve, reject } = this.pending.get(message.requestId); this.pending.delete(message.requestId);
            message.type === 'error' ? reject(new Error(message.message)) : resolve(message); return;
        }
        this.dispatchEvent(new CustomEvent(message.type, { detail: message }));
    }
    async request(type, payload = {}) {
        await this.connect(); const requestId = `${Date.now()}-${++this.requestSequence}`;
        const response = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { this.pending.delete(requestId); reject(new Error('房间服务响应超时')); }, 8000);
            this.pending.set(requestId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
        });
        this.socket.send(JSON.stringify({ type, requestId, ...payload })); return response;
    }
    async create(problemId, setup, state) {
        const result = await this.request('create_room', { problemId, setup, state }); this._adopt(result); return result;
    }
    async join(roomCode) { const result = await this.request('join_room', { roomCode }); this._adopt(result); return result; }
    async resume() {
        const saved = JSON.parse(sessionStorage.getItem('baba-room') || 'null'); if (!saved) return null;
        const result = await this.request('resume_room', saved); this._adopt(result); return result;
    }
    _adopt(result) {
        this.room = result.room; this.playerNumber = result.playerNumber; this.playerToken = result.playerToken;
        sessionStorage.setItem('baba-room', JSON.stringify({ roomCode: result.room.roomCode, playerToken: result.playerToken }));
    }
    send(type, payload = {}) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...payload })); }
    close(forget = false) { if (forget) sessionStorage.removeItem('baba-room'); this.socket?.close(); this.socket = null; this.room = null; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { RoomClient };
