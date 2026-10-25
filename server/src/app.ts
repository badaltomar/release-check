import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { createYoga } from 'graphql-yoga';
import type { Db } from './db.js';
import { schema } from './schema.js';

const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export async function buildApp({ db, logger = true }: { db: Db; logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  const yoga = createYoga({
    schema,
    context: () => ({ db }),
    logging: false,
  });

  app.route({
    url: yoga.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });

  app.get('/health', async () => {
    await db.query('SELECT 1');
    return { status: 'ok' };
  });

  // In production the same server hands out the built single-page app.
  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
    app.setNotFoundHandler((req, reply) =>
      req.method === 'GET' ? reply.sendFile('index.html') : reply.status(404).send({ error: 'Not found' }),
    );
  }

  return app;
}
