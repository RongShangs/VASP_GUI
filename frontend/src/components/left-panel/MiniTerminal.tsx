import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { Input } from 'antd';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useConnectionStore, useUIStore, useTerminalStore } from '../../store';
import { useT } from '../../i18n';
import '@xterm/xterm/css/xterm.css';

export interface MiniTerminalHandle {
  sendCommand: (cmd: string) => void;
}

const MiniTerminal = forwardRef<MiniTerminalHandle>((_props, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { connectedAlias, setCurrentCwd } = useConnectionStore();
  const registerTerminal = useTerminalStore(s => s.registerTerminal);
  const unregisterTerminal = useTerminalStore(s => s.unregisterTerminal);
  const lang = useUIStore(s => s.lang);
  const T = useT(lang);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [wsReady, setWsReady] = useState(false);

  // ── Stable sendCommand via ref ────────────────────────────
  const sendToPty = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      console.log('[TERM] Sent to PTY:', JSON.stringify(data));
      return true;
    }
    console.warn('[TERM] WS not open, readyState:', ws?.readyState);
    return false;
  }, []);

  const sendCommandFn = useCallback((cmd: string) => {
    console.log('[TERM] sendCommand:', cmd);
    const ok = sendToPty(cmd + '\r');
    if (ok) {
      setCmdHistory(prev => [...prev, cmd]);
      setHistoryIdx(-1);
    }
  }, [sendToPty]);

  // Keep a ref copy for the terminalStore
  const sendCommandRef = useRef(sendCommandFn);
  sendCommandRef.current = sendCommandFn;

  // Register stable wrapper
  useEffect(() => {
    console.log('[TERM] Registering terminal command handler');
    const wrapper = (cmd: string) => sendCommandRef.current(cmd);
    registerTerminal(wrapper);
    return () => unregisterTerminal();
  }, [registerTerminal, unregisterTerminal]);

  useImperativeHandle(ref, () => ({
    sendCommand: (cmd: string) => sendCommandRef.current(cmd),
  }), []);

  // ── Terminal + WebSocket lifecycle ────────────────────────
  useEffect(() => {
    if (!terminalRef.current || !connectedAlias) return;

    console.log('[TERM] Setting up terminal for:', connectedAlias);
    setWsReady(false);

    const term = new Terminal({
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      cursorBlink: true,
      cursorStyle: 'bar',
      rows: 20,
      cols: 300,
      theme: { background: '#0d0d1a', foreground: '#c8ccd4', cursor: '#528bff', black: '#1a1a2e', brightBlack: '#555' },
      allowProposedApi: true,
      smoothScrollDuration: 80,
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);
    termRef.current = term;

    // Fit for vertical, then set wide cols (no-wrap)
    const doResize = () => {
      try {
        fitAddon.fit();                    // proper height + width from container
        term.resize(300, term.rows);       // override cols=300, keep fitted rows
      } catch {}
    };
    setTimeout(doResize, 100);
    setTimeout(doResize, 500);
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal/${connectedAlias}`;
    console.log('[TERM] Connecting WebSocket:', wsUrl);

    term.writeln(`\x1b[36mConnecting... ${wsUrl}\x1b[0m`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[TERM] WebSocket OPEN');
      setWsReady(true);
      term.writeln('\x1b[32m\x1b[1m✓ Connected to shell\x1b[0m');
    };

    ws.onmessage = (e) => {
      // Log everything received for debugging
      const raw = typeof e.data === 'string' ? e.data : '[binary data]';
      const preview = typeof e.data === 'string' ? e.data.substring(0, 150).replace(/\r\n/g, '\\n').replace(/\x1b/g, '\\e') : '[binary]';
      console.log('[TERM] RX (' + (typeof e.data === 'string' ? e.data.length : '?') + ' bytes):', preview);

      if (typeof e.data === 'string') {
        if (e.data.includes('__CWD__:')) {
          const m = e.data.match(/__CWD__:([^\r\n]+)/);
          if (m) {
            console.log('[TERM] CWD detected:', m[1].trim());
            setCurrentCwd(m[1].trim());
            return;
          }
        }
      }
      const text = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
      term.write(text);
    };

    ws.onclose = (ev) => {
      console.log('[TERM] WebSocket CLOSED, code:', ev.code, 'reason:', ev.reason);
      setWsReady(false);
      term.write(`\r\n\x1b[33m[Disconnected — code ${ev.code}]\x1b[0m\r\n`);
    };

    ws.onerror = (ev) => {
      console.error('[TERM] WebSocket ERROR:', ev);
      term.write('\r\n\x1b[31m[Connection error — check backend logs]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        term.resize(300, term.rows);
      } catch {}
    });
    observer.observe(terminalRef.current);

    return () => {
      console.log('[TERM] Cleanup');
      observer.disconnect();
      try { ws.close(); } catch {}
      term.dispose();
      wsRef.current = null;
      termRef.current = null;
      setWsReady(false);
    };
  }, [connectedAlias]);

  // ── Input handling ────────────────────────────────────────
  const handleCmdSubmit = () => {
    const cmd = cmdInput.trim();
    if (!cmd) return;
    console.log('[TERM] Input submit:', cmd);
    sendCommandRef.current(cmd);
    setCmdInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCmdSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(newIdx);
        setCmdInput(cmdHistory[cmdHistory.length - 1 - newIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setCmdInput(cmdHistory[cmdHistory.length - 1 - newIdx] || '');
      } else {
        setHistoryIdx(-1);
        setCmdInput('');
      }
    }
  };

  if (!connectedAlias) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#555', fontSize: 11,
      }}>
        {T('center.select_server')}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* xterm terminal display area — bg matches xterm theme */}
      <div ref={terminalRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#0d0d1a' }} />
      {/* Command input + status */}
      <div style={{
        borderTop: '1px solid #2a2a4a', padding: '3px 4px',
        background: '#0d0d1a', flexShrink: 0,
      }}>
        <Input
          size="small"
          value={cmdInput}
          onChange={e => setCmdInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={wsReady ? T('terminal.input_placeholder') : 'Waiting for shell...'}
          disabled={!wsReady}
          style={{
            background: '#12122a', border: '1px solid #333', color: '#c8ccd4',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          }}
          prefix={<span style={{
            color: wsReady ? '#528bff' : '#f44336',
            fontSize: 10, fontWeight: 600,
          }}>{wsReady ? '$' : '⏳'}</span>}
        />
      </div>
    </div>
  );
});

MiniTerminal.displayName = 'MiniTerminal';
export default MiniTerminal;
