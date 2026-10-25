import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPool, migrate, type Db } from '../src/db.js';
import { STEPS } from '../src/steps.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/releasecheck_test';

let db: Db;
let app: FastifyInstance;

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/graphql', payload: { query, variables } });
  return res.json<{ data: T; errors?: { message: string; extensions?: { code?: string } }[] }>();
}

const RELEASE_FIELDS = 'id name date status additionalInfo completedStepCount steps { id completed }';

async function createRelease(name = 'Version 1.0.0') {
  const { data } = await gql(
    `mutation ($input: CreateReleaseInput!) { createRelease(input: $input) { ${RELEASE_FIELDS} } }`,
    { input: { name, date: '2026-11-01T10:00:00.000Z', additionalInfo: 'First cut' } },
  );
  return data.createRelease;
}

const setStep = (releaseId: string, stepId: string, completed: boolean) =>
  gql(
    `mutation ($releaseId: ID!, $stepId: ID!, $completed: Boolean!) {
       setStepCompleted(releaseId: $releaseId, stepId: $stepId, completed: $completed) { ${RELEASE_FIELDS} }
     }`,
    { releaseId, stepId, completed },
  );

beforeAll(async () => {
  db = createPool(TEST_DATABASE_URL, 10);
  await migrate(db);
  app = await buildApp({ db, logger: false });
});

afterAll(async () => {
  await app.close();
  await db.end();
});

beforeEach(async () => {
  await db.query('TRUNCATE releases');
});

describe('releases API', () => {
  it('creates a release that starts as PLANNED with every step unchecked', async () => {
    const release = await createRelease();
    expect(release).toMatchObject({ name: 'Version 1.0.0', status: 'PLANNED', additionalInfo: 'First cut' });
    expect(release.steps).toHaveLength(STEPS.length);
    expect(release.steps.every((s: { completed: boolean }) => !s.completed)).toBe(true);

    const { data } = await gql('{ releases { id name } }');
    expect(data.releases).toEqual([{ id: release.id, name: 'Version 1.0.0' }]);
  });

  it('moves from PLANNED to ONGOING to DONE as steps are checked, and back when unchecked', async () => {
    const release = await createRelease();

    const first = await setStep(release.id, STEPS[0].id, true);
    expect(first.data.setStepCompleted.status).toBe('ONGOING');

    for (const step of STEPS) await setStep(release.id, step.id, true);
    const { data } = await gql(`{ release(id: "${release.id}") { status completedStepCount } }`);
    expect(data.release).toEqual({ status: 'DONE', completedStepCount: STEPS.length });

    const unchecked = await setStep(release.id, STEPS[3].id, false);
    expect(unchecked.data.setStepCompleted.status).toBe('ONGOING');
  });

  it('updates the additional info', async () => {
    const release = await createRelease();
    const { data } = await gql(
      `mutation ($id: ID!) { updateRelease(id: $id, input: { additionalInfo: "Ship after the demo" }) { additionalInfo name } }`,
      { id: release.id },
    );
    expect(data.updateRelease).toEqual({ additionalInfo: 'Ship after the demo', name: 'Version 1.0.0' });
  });

  it('deletes a release', async () => {
    const release = await createRelease();
    const { data } = await gql(`mutation ($id: ID!) { deleteRelease(id: $id) }`, { id: release.id });
    expect(data.deleteRelease).toBe(release.id);

    const after = await gql(`{ release(id: "${release.id}") { id } }`);
    expect(after.data.release).toBeNull();
  });

  it('rejects a release without a name and an unknown step', async () => {
    const empty = await gql(
      `mutation { createRelease(input: { name: "  ", date: "2026-11-01T10:00:00Z" }) { id } }`,
    );
    expect(empty.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');

    const release = await createRelease();
    const unknown = await setStep(release.id, 'not-a-step', true);
    expect(unknown.errors?.[0]?.message).toBe('Unknown step: not-a-step');
  });
});
