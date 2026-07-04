import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  onMessage: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  /** Max reconnection attempts before giving up (default: 10) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Max delay cap in ms (default: 30000) */
  maxDelayMs?: number;
}

/**
 * WebSocket hook with exponential-backoff reconnection.
 *
 * Reconnection strategy:
 * - Starts at baseDelayMs (default 1s)
 * - Doubles each attempt up to maxDelayMs (default 30s)
 * - Gives up after maxRetries (default 10)
 */
export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions,
) {
  const {
    onMessage,
    onOpen,
    onClose,
    maxRetries = 10,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number>();
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (!url) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url.startsWith('ws')
      ? url
      : `${protocol}//${window.location.host}${url}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      retryCount.current = 0; // Reset backoff on successful connect
      onOpen?.();
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessage(data);
      } catch {
        onMessage(e.data);
      }
    };

    ws.onclose = () => {
      onClose?.();
      // Exponential backoff reconnection
      if (retryCount.current < maxRetries) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, retryCount.current),
          maxDelayMs,
        );
        retryCount.current += 1;
        reconnectTimeout.current = window.setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose → reconnect
    };

    wsRef.current = ws;
  }, [url, onMessage, onOpen, onClose, maxRetries, baseDelayMs, maxDelayMs]);

  useEffect(() => {
    connect();
    return () => {
      window.clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { send };
}
