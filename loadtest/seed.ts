// Fills the database with releases for a load test and writes their ids for k6.
//   npm run loadtest:seed -- --count 1000
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import pg from 'pg';

const { values } = parseArgs({ options: { count: { type: 'string', default: '1000' } } });
const count = Number(values.count);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });

const STEP_IDS = [
  'prs-merged',
  'changelog-updated',
  'tests-passing',
  'github-release',
  'deployed-demo',
  'tested-demo',
  'deployed-production',
  'team-notified',
];

await db.query(`DELETE FROM releases WHERE name LIKE 'Load test %'`);
const { rows } = await db.query<{ id: string }>(
  `INSERT INTO releases (name, release_date, additional_info, completed_steps)
   SELECT 'Load test ' || g,
          now() + (g || ' hours')::interval,
          'Seeded for the load test',
          (SELECT coalesce(array_agg(s), '{}') FROM unnest($2::text[]) s WHERE random() < 0.5)
     FROM generate_series(1, $1::int) g
   RETURNING id`,
  [count, STEP_IDS],
);

await mkdir('loadtest', { recursive: true });
await writeFile('loadtest/releases.json', JSON.stringify(rows.map((r) => r.id)));
console.log(`seeded ${rows.length} releases, ids written to loadtest/releases.json`);
await db.end();
