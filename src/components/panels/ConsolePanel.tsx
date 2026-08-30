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
    { id: 2, type: 'log', message: 'All CDN scripts loaded', timestamp: new Date() }
  ]);
  const logIdCounter = useRef(3);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Override console methods để capture tất cả log
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    const addLog = (type: ConsoleLog['type'], message: string) => {
      setLogs(prev => [...prev, {
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

    // Cleanup khi unmount
    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  // Auto scroll xuống cuối khi có log mới
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogStyle = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
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
    <div className="w-full h-full bg-gray-900 text-white overflow-hidden flex flex-col">
      {/* Console Header */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Console</span>
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearLogs}
            className="px-2 py-1 text-xs hover:bg-gray-700 rounded transition-colors"
            title="Clear Console (Ctrl+L)"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">Console is empty</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`flex items-start gap-2 ${getLogStyle(log.type)}`}>
              <span className="text-gray-500 whitespace-nowrap">[{formatTime(log.timestamp)}]</span>
              <span>{getLogPrefix(log.type)}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input để gửi lệnh console */}
      <div className="border-t border-gray-700 p-2">
        <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1.5">
          <span className="text-green-400">❯</span>
          <input
            type="text"
            placeholder="Enter a command..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = e.currentTarget.value;
                if (value.trim()) {
                  try {
                    console.log(`> ${value}`);
                    // Thử evaluate lệnh (chỉ cho các lệnh an toàn)
                    if (value === 'clear') {
                      clearLogs();
                    }
                  } catch (err) {
                    console.error(err);
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