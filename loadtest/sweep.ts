// Runs the k6 user flow at increasing numbers of simultaneous users and prints one table.
//   npm run loadtest -- --levels 50,100,200,400,800 --label v1
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    label: { type: 'string', default: 'run' },
    levels: { type: 'string', default: '50,100,200,400,800,1600' },
    duration: { type: 'string', default: '20s' },
    // Address of the app as seen from the k6 container.
    'base-url': { type: 'string', default: 'http://app:3000' },
    // Docker network to join; pass an empty value when testing a public URL.
    network: { type: 'string', default: 'release-check_default' },
  },
});

interface Summary {
  users: number;
  requests: number;
  rps: number;
  ok: number;
  dropped: number;
  failed: number;
  p50: number;
  p95: number;
  p99: number;
}

const resultsDir = path.resolve('loadtest/results');
await mkdir(resultsDir, { recursive: true });

function runK6(vus: number, duration: string): Promise<Summary> {
  const args = [
    'run', '--rm',
    '--mount', `type=bind,source=${path.resolve('loadtest')},target=/loadtest`,
    ...(values.network ? ['--network', values.network] : []),
    '-e', `BASE_URL=${values['base-url']}`,
    '-e', `VUS=${vus}`,
    '-e', `DURATION=${duration}`,
    'grafana/k6:latest', 'run', '--quiet', '/loadtest/user-flow.js',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    child.on('exit', async (code) => {
      if (code !== 0) return reject(new Error(`k6 exited with ${code}`));
      resolve(JSON.parse(await readFile(path.join(resultsDir, 'last-run.json'), 'utf8')) as Summary);
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

process.stdout.write('warming up... ');
await runK6(20, '8s');
console.log('done');

const rows: Summary[] = [];
for (const vus of values.levels!.split(',').map(Number)) {
  process.stdout.write(`running ${vus} users... `);
  const summary = await runK6(vus, values.duration!);
  console.log(`${summary.rps.toFixed(0)} req/s, p95 ${summary.p95.toFixed(0)} ms, dropped ${summary.dropped}`);
  rows.push(summary);
  await sleep(5_000);
}

const pct = (part: number, whole: number) => `${((part / Math.max(whole, 1)) * 100).toFixed(1)}%`;
const table = [
  '| Users | Requests | Req/s | Dropped (no answer in 10 s) | Errors | p50 ms | p95 ms | p99 ms |',
  '|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map(
    (r) =>
      `| ${r.users} | ${r.requests} | ${r.rps.toFixed(0)} | ${r.dropped} (${pct(r.dropped, r.requests)}) | ${r.failed} | ${r.p50.toFixed(0)} | ${r.p95.toFixed(0)} | ${r.p99.toFixed(0)} |`,
  ),
].join('\n');

await writeFile(path.join(resultsDir, `${values.label}.md`), `${table}\n`);
console.log(`\n${table}\n`);

const slow = rows.find((r) => r.p95 > 1000);
const dropping = rows.find((r) => (r.dropped + r.failed) / Math.max(r.requests, 1) > 0.01);
console.log(`p95 above 1 second first at: ${slow ? `${slow.users} users` : 'not reached'}`);
console.log(`more than 1% dropped or failed first at: ${dropping ? `${dropping.users} users` : 'not reached'}`);
