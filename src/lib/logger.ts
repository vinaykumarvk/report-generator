import pino from 'pino';
import { getConfig } from './config';

const config = getConfig();

export const logger = pino({
  level: config.logLevel,
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard'
          }
        }
      : undefined,
  base: {
    service: config.appName
  }
});
