import { buildApp } from './app.js';
import { createPool, migrate } from './db.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const db = createPool(databaseUrl, Number(process.env.DB_POOL_MAX ?? 10));
await migrate(db);

const app = await buildApp({ db });
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });

async function shutdown() {
  await app.close();
  await db.end();
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
