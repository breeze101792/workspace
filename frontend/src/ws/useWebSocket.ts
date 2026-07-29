import { useEffect, useCallback, useState } from 'react';
import { syncEngine } from './syncEngine';

export function useWebSocket(workspaceId: string | null) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    syncEngine.connect(workspaceId);

    const unsub = syncEngine.on('connection', (data: unknown) => {
      setConnected((data as { connected: boolean }).connected);
    });

    return () => {
      unsub();
      syncEngine.disconnect();
    };
  }, [workspaceId]);

  const send = useCallback((type: string, data: unknown) => {
    syncEngine.send(type, data);
  }, []);

  const on = useCallback((type: string, handler: (data: unknown) => void) => {
    return syncEngine.on(type, handler);
  }, []);

  return { connected, send, on };
}
