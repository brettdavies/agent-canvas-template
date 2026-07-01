import type { LogEntry } from '@shared/log';

type Level = LogEntry['level'];

function log(level: Level, message: string, context?: Record<string, unknown>) {
  if (level === 'error') {
    console.error(message, context ?? '');
  } else if (level === 'warn') {
    console.warn(message, context ?? '');
  } else {
    console.log(message, context ?? '');
  }

  const entry: LogEntry = {
    level,
    message,
    context,
    at: new Date().toISOString(),
    url: window.location.href,
  };

  try {
    void fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Logging must never throw or block.
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
