import { z } from 'zod';

export const logEntrySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  at: z.string().optional(),
  url: z.string().optional(),
});

export type LogEntry = z.infer<typeof logEntrySchema>;
