import { WebSocket, WebSocketServer } from "ws";

interface ClientSubscription {
  clientId: string;
  channels: Set<string>;
  lastPing: number;
}

export abstract class BaseWebSocketServer {
  protected clients: Map<WebSocket, ClientSubscription> = new Map();
  protected wss?: WebSocketServer;
  protected heartbeatInterval?: NodeJS.Timeout;
  protected port: number;

  constructor(port: number) {
    this.port = port;
  }

  /**
   * 启动WebSocket服务器
   */
  public start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws) => {
      const clientId = this.generateClientId();
      this.clients.set(ws, {
        clientId,
        channels: new Set(),
        lastPing: Date.now(),
      });

      this.onClientConnect(ws, clientId);

      ws.on("message", (data) => {
        this.handleMessage(ws, data as Buffer);
      });

      ws.on("close", () => {
        this.handleClientDisconnect(ws);
      });

      ws.on("error", (error) => {
        this.handleClientError(ws, error);
      });
    });

    // 启动心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);

    this.onServerStart();
  }

  /**
   * 停止WebSocket服务器
   */
  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  /**
   * 生成客户端ID（子类可覆盖）
   */
  protected generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 处理客户端连接
   */
  protected onClientConnect(ws: WebSocket, clientId: string): void {
    // 发送欢迎消息
    this.send(ws, {
      type: "connected",
      timestamp: Date.now(),
      message: "Connected to Foresight Market WebSocket",
      clientId,
    });
  }

  /**
   * 处理客户端断开连接
   */
  protected handleClientDisconnect(ws: WebSocket): void {
    this.clients.delete(ws);
    this.updateMetrics();
    this.onClientDisconnectCallback(ws);
  }

  /**
   * 处理客户端错误
   */
  protected handleClientError(ws: WebSocket, error: Error): void {
    console.error("WebSocket client error:", error);
    this.clients.delete(ws);
    this.updateMetrics();
  }

  /**
   * 处理客户端消息
   */
  protected handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const subscription = this.clients.get(ws);
      if (!subscription) return;

      this.onMessageReceived(message.type);

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(ws, subscription, message.channels);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(ws, subscription, message.channels);
          break;

        case "ping":
          subscription.lastPing = Date.now();
          this.send(ws, { type: "pong", timestamp: Date.now() });
          break;

        default:
          this.send(ws, { type: "error", message: "Unknown message type" });
      }
    } catch (error) {
      this.send(ws, { type: "error", message: "Invalid message format" });
    }
  }

  /**
   * 处理订阅请求
   */
  protected handleSubscribe(
    ws: WebSocket,
    subscription: ClientSubscription,
    channels: string[]
  ): void {
    if (!Array.isArray(channels)) {
      this.send(ws, { type: "error", message: "channels must be an array" });
      return;
    }

    for (const channel of channels) {
      if (this.isValidChannel(channel)) {
        subscription.channels.add(channel);
      }
    }

    this.updateMetrics();

    this.send(ws, {
      type: "subscribed",
      channels: Array.from(subscription.channels),
    });

    this.onClientSubscribe(subscription.clientId, subscription.channels);
  }

  /**
   * 处理取消订阅请求
   */
  protected handleUnsubscribe(
    ws: WebSocket,
    subscription: ClientSubscription,
    channels: string[]
  ): void {
    if (!Array.isArray(channels)) {
      this.send(ws, { type: "error", message: "channels must be an array" });
      return;
    }

    for (const channel of channels) {
      subscription.channels.delete(channel);
    }

    this.updateMetrics();

    this.send(ws, {
      type: "unsubscribed",
      channels: Array.from(subscription.channels),
    });
  }

  /**
   * 检查心跳，移除不活跃的客户端
   */
  protected checkHeartbeats(): void {
    const now = Date.now();
    for (const [ws, subscription] of this.clients.entries()) {
      // 超过60秒没有响应就断开连接
      if (now - subscription.lastPing > 60000) {
        ws.close();
        this.clients.delete(ws);
        this.updateMetrics();
      }
    }
  }

  /**
   * 发送消息给客户端
   */
  protected send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送消息给所有订阅了特定频道的客户端
   */
  protected broadcastToChannel(channel: string, message: any): void {
    for (const [ws, subscription] of this.clients.entries()) {
      if (subscription.channels.has(channel)) {
        this.send(ws, message);
      }
    }
  }

  /**
   * 验证频道名称
   */
  protected isValidChannel(channel: string): boolean {
    // 频道格式: type:marketKey:outcomeIndex
    // 例如: depth:80002:123:0, trades:80002:123:0, stats:80002:123:0
    const parts = channel.split(":");
    if (parts.length < 2) return false;

    const type = parts[0];
    return ["depth", "trades", "stats", "orders"].includes(type);
  }

  /**
   * 更新指标（子类可覆盖）
   */
  protected updateMetrics(): void {
    // 默认实现，子类可覆盖
  }

  /**
   * 服务器启动回调（子类可覆盖）
   */
  protected onServerStart(): void {
    console.log(`[WebSocket] Server started on port ${this.port}`);
  }

  /**
   * 客户端订阅回调（子类可覆盖）
   */
  protected onClientSubscribe(clientId: string, channels: Set<string>): void {
    // 默认实现，子类可覆盖
    console.log(`[WebSocket] Client subscribed`, {
      clientId,
      channels: Array.from(channels),
    });
  }

  /**
   * 消息接收回调（子类可覆盖）
   */
  protected onMessageReceived(messageType: string): void {
    // 默认实现，子类可覆盖
  }

  /**
   * 客户端断开连接回调（子类可覆盖）
   */
  protected onClientDisconnectCallback(ws: WebSocket): void {
    // 默认实现，子类可覆盖
  }
}
