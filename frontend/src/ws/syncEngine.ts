type MessageHandler = (data: unknown) => void;

export class SyncEngine {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private seq = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url = '';

  connect(url: string) {
    this.url = url;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws) this.ws.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = this.url.startsWith('ws') ? this.url : `${protocol}//${window.location.host}/ws?workspace=${this.url}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.emit('connection', { connected: true });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit(msg.type, msg.data);
        this.emit('*', msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.emit('connection', { connected: false });
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, 2000);
  }

  send(type: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data, seq: ++this.seq }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, data: unknown) {
    this.handlers.get(type)?.forEach((h) => h(data));
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const syncEngine = new SyncEngine();
