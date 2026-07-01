import { type LogEntry, logEntrySchema } from '@shared/log';

export { type LogEntry, logEntrySchema };

type Level = LogEntry['level'];

function emit(source: string, level: Level, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({ at: new Date().toISOString(), source, level, message, ...context });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const serverLog = {
  debug: (message: string, context?: Record<string, unknown>) => emit('server', 'debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('server', 'info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('server', 'warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('server', 'error', message, context),
  client: (entry: LogEntry) => {
    const { level, message, ...rest } = entry;
    emit('client', level, message, rest);
  },
};
