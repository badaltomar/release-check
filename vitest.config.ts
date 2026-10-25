import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Vitest resolves graphql to its development build while graphql-yoga gets the normal one.
    // Two copies break instanceof checks and turn user errors into server errors, so pin one.
    alias: { graphql: fileURLToPath(new URL('./node_modules/graphql/index.mjs', import.meta.url)) },
  },
  test: {
    include: ['server/test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
