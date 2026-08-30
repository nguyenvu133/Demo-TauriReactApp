import { useState, useEffect, useRef } from 'react';

interface ConsoleLog {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

export function ConsolePanel() {
  const [logs, setLogs] = useState<ConsoleLog[]>([
    { id: 1, type: 'info', message: 'PixiJS Editor initialized', timestamp: new Date() },
    { id: 2, type: 'log', message: 'All modules and panels loaded successfully', timestamp: new Date() }
  ]);
  const logIdCounter = useRef(3);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    const addLog = (type: ConsoleLog['type'], message: string) => {
      setLogs(prev => [...prev.slice(-100), {
        id: logIdCounter.current++,
        type,
        message: typeof message === 'object' ? JSON.stringify(message) : String(message),
        timestamp: new Date()
      }]);
    };

    console.log = (...args) => { originalLog.apply(console, args); addLog('log', args.join(' ')); };
    console.warn = (...args) => { originalWarn.apply(console, args); addLog('warn', args.join(' ')); };
    console.error = (...args) => { originalError.apply(console, args); addLog('error', args.join(' ')); };
    console.info = (...args) => { originalInfo.apply(console, args); addLog('info', args.join(' ')); };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogStyle = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error': return 'text-red-400 bg-red-950/20';
      case 'warn': return 'text-yellow-400 bg-yellow-950/20';
      case 'info': return 'text-blue-400 bg-blue-950/20';
      default: return 'text-gray-300';
    }
  };

  const getLogPrefix = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { hour12: false });
  };

  return (
    <div className="w-full h-full bg-gray-950 text-white overflow-hidden flex flex-col font-mono">
      {/* Console Header */}
      <div className="px-3 py-1.5 border-b border-gray-800 bg-gray-900 flex items-center justify-between shrink-0 font-sans">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Console</span>
          <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.2 rounded font-mono">{logs.length}</span>
        </div>
        <button 
          onClick={clearLogs}
          className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Clear Console (Ctrl+L)"
        >
          🗑️ Clear
        </button>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto text-xs p-2 space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic py-4 text-center">Console is empty</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`flex items-start gap-2 p-1 rounded leading-relaxed ${getLogStyle(log.type)}`}>
              <span className="text-gray-500 text-[10px] select-none">[{formatTime(log.timestamp)}]</span>
              <span>{getLogPrefix(log.type)}</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Command Input */}
      <div className="border-t border-gray-800 p-2 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 bg-gray-850 rounded px-2.5 py-1 border border-gray-800">
          <span className="text-green-400 font-bold text-xs">❯</span>
          <input
            type="text"
            placeholder="Enter a JavaScript command or 'clear'..."
            className="flex-1 bg-transparent outline-none text-xs text-gray-200 placeholder-gray-500 font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = e.currentTarget.value;
                if (value.trim()) {
                  if (value.trim() === 'clear') {
                    clearLogs();
                  } else {
                    console.log(`> ${value}`);
                    try {
                      const result = window.eval(value);
                      console.info(`← ${result}`);
                    } catch (err: any) {
                      console.error(`Error: ${err.message}`);
                    }
                  }
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ConsolePanel;
