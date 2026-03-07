import { useEffect, useRef, useState, useCallback } from "react";
import { ws } from "@shared/routes";
import { z } from "zod";

type ReceiveEvents = typeof ws.receive;
type SendEvents = typeof ws.send;

type ParsedMessage = {
  [K in keyof ReceiveEvents]: {
    type: K;
    payload: z.infer<ReceiveEvents[K]>;
  };
}[keyof ReceiveEvents];

export function useAppWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let reconnectTimer: NodeJS.Timeout;
    
    const connect = () => {
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        setIsConnected(true);
        console.log("[WS] Connected");
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log("[WS] Disconnected, reconnecting...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.type && ws.receive[raw.type as keyof ReceiveEvents]) {
            const schema = ws.receive[raw.type as keyof ReceiveEvents];
            const result = schema.safeParse(raw.payload || raw.data || raw);
            
            if (result.success) {
              const cbs = handlersRef.current.get(raw.type);
              if (cbs) {
                cbs.forEach(cb => cb(result.data));
              }
            } else {
              console.warn(`[WS] Payload validation failed for ${raw.type}:`, result.error);
            }
          }
        } catch (e) {
          console.error("[WS] Parse error", e);
        }
      };

      wsRef.current = socket;
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const subscribe = useCallback(<K extends keyof ReceiveEvents>(
    event: K,
    callback: (data: z.infer<ReceiveEvents[K]>) => void
  ) => {
    if (!handlersRef.current.has(event as string)) {
      handlersRef.current.set(event as string, new Set());
    }
    handlersRef.current.get(event as string)!.add(callback);

    return () => {
      const cbs = handlersRef.current.get(event as string);
      if (cbs) {
        cbs.delete(callback);
      }
    };
  }, []);

  const emit = useCallback(<K extends keyof SendEvents>(
    event: K,
    payload: z.infer<SendEvents[K]>
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: event, ...payload }));
    } else {
      console.warn("[WS] Cannot emit, socket not open");
    }
  }, []);

  return { isConnected, subscribe, emit };
}
