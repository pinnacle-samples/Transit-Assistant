import 'dotenv/config';
import express from 'express';
import varoomRouter from './router';
import { Server } from 'http';
import { gtfsCache } from './cache/gtfsCache';

const app = express();
const PORT = process.env.PORT || 3000;
const terminationGracePeriodMs = 30000;
let isShuttingDown = false;

app.use(express.json());
app.use('/webhook', varoomRouter);

async function startServer(): Promise<Server> {
  try {
    await gtfsCache.initialize();
    console.info('[Transit-Assistant] GTFS cache initialized');

    return app.listen(PORT, () => {
      console.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Transit-Assistant] Failed to initialize:', err);
    process.exit(1);
  }
}

const server = await startServer();

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`Received ${signal}. Beginning graceful shutdown.`);

  // Fallback timer in case existing connections hang.
  const forceExitTimer = setTimeout(() => {
    console.error(
      `Graceful shutdown timed out after ${terminationGracePeriodMs / 1000} seconds. Forcing exit.`,
    );
    process.exit(1);
  }, terminationGracePeriodMs).unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);

    if (error) {
      console.error('Error while closing HTTP server:', error);
      process.exit(1);
    }

    console.info('HTTP server closed cleanly.');
    console.info('Exiting.');
    process.exit(0);
  });
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
