'use strict';

// Yeelight LAN protocol: discovery (SSDP-like UDP multicast) and control
// (newline-delimited JSON over TCP port 55443). No external dependencies.

const dgram = require('dgram');
const net = require('net');
const os = require('os');
const { EventEmitter } = require('events');

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1982;
const SEARCH_MSG = Buffer.from(
    'M-SEARCH * HTTP/1.1\r\n' + `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` + 'MAN: "ssdp:discover"\r\n' + 'ST: wifi_bulb\r\n'
);

function parseSsdpResponse(text) {
    const headers = {};
    for (const line of text.split('\r\n').slice(1)) {
        const i = line.indexOf(':');
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    const loc = headers.location || '';
    const m = loc.match(/yeelight:\/\/([\d.]+):(\d+)/);
    if (!m) return null;
    return {
        id: headers.id || m[1],
        ip: m[1],
        port: Number(m[2]),
        model: headers.model || 'unknown',
        fw: headers.fw_ver || '',
        name: headers.name || '',
        support: (headers.support || '').split(/\s+/).filter(Boolean),
        power: headers.power || 'off',
        bright: Number(headers.bright || 0),
        rgb: Number(headers.rgb || 0),
        ct: Number(headers.ct || 0),
        colorMode: Number(headers.color_mode || 1)
    };
}

// Send M-SEARCH packets to the given targets (multicast or individual IP addresses)
// and collect responses. Yeelight also responds to unicast M-SEARCH on UDP port 1982,
// allowing discovery on networks where multicast is blocked without
// using up the lamp's TCP connection quota.
function ssdpSearch(targets, timeoutMs) {
    return new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const found = new Map();
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            try {
                socket.close();
            } catch (_) {}
            resolve([...found.values()]);
        };
        socket.on('error', finish);
        socket.on('message', (msg) => {
            const dev = parseSsdpResponse(msg.toString());
            if (dev) found.set(dev.id, dev);
        });
        socket.bind(() => {
            const sendAll = () => {
                for (const ip of targets) socket.send(SEARCH_MSG, SSDP_PORT, ip);
            };
            sendAll();
            // UDP packets may be lost; retry once before the timeout.
            setTimeout(
                () => {
                    if (!done) sendAll();
                },
                Math.min(1000, timeoutMs / 2)
            );
            setTimeout(finish, timeoutMs);
        });
    });
}

// Discover Yeelight devices on the network using multicast.
function discover(timeoutMs = 3000) {
    return ssdpSearch([SSDP_ADDR], timeoutMs);
}

// If multicast discovery finds nothing, send unicast M-SEARCH to every address
// in the local /24 subnets. Some routers block multicast between
// Wi-Fi clients.
function sweepDiscover(timeoutMs = 3000) {
    const targets = [];
    for (const addrs of Object.values(os.networkInterfaces())) {
        for (const a of addrs || []) {
            if (a.family !== 'IPv4' || a.internal) continue;
            const base = a.address.replace(/\.\d+$/, '.');
            for (let i = 1; i <= 254; i++) targets.push(base + i);
        }
    }
    return ssdpSearch(targets, timeoutMs);
}

// Query a single IP address for model and capability information when adding it manually.
async function queryOne(ip, timeoutMs = 1500) {
    const found = await ssdpSearch([ip], timeoutMs);
    return found.find((d) => d.ip === ip) || null;
}

// Maintain a persistent TCP connection to a lamp. Reconnect with increasing delays
// after disconnection and emit events for incoming "props" notifications.
class LightDevice extends EventEmitter {
    constructor({ ip, port = 55443, id = null, name = '', model = '', fw = '', support = [] }) {
        super();
        this.ip = ip;
        this.port = port;
        this.id = id || ip;
        this.name = name;
        this.model = model;
        this.fw = fw;
        this.support = support;
        this.stats = { tx: 0, rx: 0, notifications: 0, reconnects: 0, lastLatency: null, connectedAt: null };
        this.connected = false;
        this.props = {};
        this._socket = null;
        this._buffer = '';
        this._nextId = 1;
        this._pending = new Map();
        this._retryDelay = 1000;
        this._reconnectTimer = null;
        this._throttles = new Map();
        this._pollTimer = null;
        this._closed = false;
    }

    connect() {
        if (this._closed || this._socket) return;
        const sock = net.createConnection({ host: this.ip, port: this.port });
        this._socket = sock;
        sock.setNoDelay(true);
        sock.on('connect', () => {
            this.connected = true;
            this._retryDelay = 1000;
            this.stats.connectedAt = Date.now();
            this.emit('connection', true);
            this.refresh().catch(() => {});
            // Changes made through the phone app or cloud do not always trigger
            // LAN property notifications; periodic polling provides a fallback.
            this._pollTimer = setInterval(() => this.refresh().catch(() => {}), 30000);
        });
        sock.on('data', (data) => this._onData(data));
        sock.on('error', () => {});
        sock.on('close', () => {
            clearInterval(this._pollTimer);
            this._socket = null;
            const wasConnected = this.connected;
            this.connected = false;
            for (const [, p] of this._pending) p.reject(new Error('connection closed'));
            this._pending.clear();
            if (wasConnected) this.emit('connection', false);
            this._scheduleReconnect();
        });
    }

    close() {
        this._closed = true;
        clearTimeout(this._reconnectTimer);
        clearInterval(this._pollTimer);
        for (const t of this._throttles.values()) clearTimeout(t.timer);
        if (this._socket) this._socket.destroy();
    }

    _scheduleReconnect() {
        if (this._closed) return;
        this.stats.reconnects++;
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this.connect(), this._retryDelay);
        this._retryDelay = Math.min(this._retryDelay * 2, 30000);
    }

    _onData(data) {
        this._buffer += data.toString();
        let idx;
        while ((idx = this._buffer.indexOf('\r\n')) >= 0) {
            const line = this._buffer.slice(0, idx);
            this._buffer = this._buffer.slice(idx + 2);
            if (!line.trim()) continue;
            let msg;
            try {
                msg = JSON.parse(line);
            } catch (_) {
                continue;
            }
            if (msg.method === 'props' && msg.params) {
                this.stats.notifications++;
                Object.assign(this.props, msg.params);
                this.emit('props', msg.params);
            } else if (msg.id != null && this._pending.has(msg.id)) {
                const p = this._pending.get(msg.id);
                this._pending.delete(msg.id);
                if (msg.error) p.reject(new Error(msg.error.message || 'device error'));
                else p.resolve(msg.result);
            }
        }
    }

    send(method, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this._socket) return reject(new Error('not connected'));
            const id = this._nextId++;
            this.stats.tx++;
            const t0 = Date.now();
            this._pending.set(id, {
                resolve: (result) => {
                    this.stats.rx++;
                    this.stats.lastLatency = Date.now() - t0;
                    resolve(result);
                },
                reject
            });
            this._socket.write(JSON.stringify({ id, method, params }) + '\r\n');
            setTimeout(() => {
                if (this._pending.has(id)) {
                    this._pending.delete(id);
                    reject(new Error('timeout'));
                }
            }, 5000);
        });
    }

    // For rapidly repeated commands, such as slider input, send at most once
    // per intervalMs for each key; always send the latest value.
    // (Lamps are limited to approximately 60 commands per minute.)
    sendThrottled(key, method, params, intervalMs = 300) {
        const now = Date.now();
        const t = this._throttles.get(key) || { last: 0, timer: null, next: null };
        t.next = { method, params };
        if (now - t.last >= intervalMs && !t.timer) {
            t.last = now;
            const { method: m, params: p } = t.next;
            t.next = null;
            this.send(m, p).catch(() => {});
        } else if (!t.timer) {
            t.timer = setTimeout(
                () => {
                    t.timer = null;
                    t.last = Date.now();
                    if (t.next) {
                        const { method: m, params: p } = t.next;
                        t.next = null;
                        this.send(m, p).catch(() => {});
                    }
                },
                intervalMs - (now - t.last)
            );
        }
        this._throttles.set(key, t);
    }

    async refresh() {
        const keys = ['power', 'bright', 'rgb', 'ct', 'color_mode', 'name'];
        const result = await this.send('get_prop', keys);
        const params = {};
        keys.forEach((k, i) => {
            if (result[i] !== '') params[k] = result[i];
        });
        Object.assign(this.props, params);
        this.emit('props', params);
        return this.props;
    }

    setPower(on, duration = 300) {
        return this.send('set_power', [on ? 'on' : 'off', 'smooth', duration]);
    }

    setBright(value) {
        const v = Math.max(1, Math.min(100, Math.round(value)));
        this.sendThrottled('bright', 'set_bright', [v, 'smooth', 200]);
    }

    setRgb(rgb) {
        const v = Math.max(1, Math.min(0xffffff, Math.round(rgb)));
        this.sendThrottled('color', 'set_rgb', [v, 'smooth', 200]);
    }

    setCt(kelvin) {
        const v = Math.max(1700, Math.min(6500, Math.round(kelvin)));
        this.sendThrottled('color', 'set_ct_abx', [v, 'smooth', 200]);
    }

    toJSON() {
        return {
            id: this.id,
            ip: this.ip,
            port: this.port,
            name: this.name,
            model: this.model,
            fw: this.fw,
            support: this.support,
            connected: this.connected,
            props: this.props,
            stats: { ...this.stats }
        };
    }
}

module.exports = { discover, sweepDiscover, queryOne, LightDevice: LightDevice };
