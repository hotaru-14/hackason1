
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { deepPaperAgent } from './agents/deep-paper-agent';

export const mastra = new Mastra({
  workflows: {},
  agents: { deepPaperAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage for Vercel compatibility
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
