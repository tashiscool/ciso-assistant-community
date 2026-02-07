/**
 * WebSocket client for real-time notifications.
 */
export interface Notification {
	type: string;
	title: string;
	message: string;
	data?: Record<string, any>;
	timestamp: string;
	read: boolean;
}

export class NotificationClient {
	private ws: WebSocket | null = null;
	private listeners: Map<string, Set<(notification: Notification) => void>> = new Map();
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private maxReconnectDelay = 30000;
	private reconnectDelay = 1000;

	connect(url?: string): void {
		const wsUrl =
			url ||
			`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications/`;

		try {
			this.ws = new WebSocket(wsUrl);

			this.ws.onopen = () => {
				this.reconnectDelay = 1000;
			};

			this.ws.onmessage = (event) => {
				const notification: Notification = JSON.parse(event.data);
				this.emit(notification.type, notification);
				this.emit('*', notification); // wildcard listeners
			};

			this.ws.onclose = () => {
				this.scheduleReconnect();
			};

			this.ws.onerror = () => {
				this.ws?.close();
			};
		} catch {
			this.scheduleReconnect();
		}
	}

	on(type: string, listener: (notification: Notification) => void): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(listener);
		return () => this.listeners.get(type)?.delete(listener);
	}

	private emit(type: string, notification: Notification): void {
		this.listeners.get(type)?.forEach((fn) => fn(notification));
	}

	markAsRead(notificationId: string): void {
		this.ws?.send(JSON.stringify({ type: 'mark_read', id: notificationId }));
	}

	disconnect(): void {
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.ws?.close();
		this.ws = null;
	}

	private scheduleReconnect(): void {
		this.reconnectTimer = setTimeout(() => {
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
			this.connect();
		}, this.reconnectDelay);
	}
}

export const notificationClient = new NotificationClient();
