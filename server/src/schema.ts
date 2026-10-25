import { createSchema } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import type { Db } from './db.js';
import { STEPS, computeStatus, isStepId } from './steps.js';

export const typeDefs = /* GraphQL */ `
  enum ReleaseStatus {
    PLANNED
    ONGOING
    DONE
  }

  type Step {
    id: ID!
    label: String!
    completed: Boolean!
  }

  type Release {
    id: ID!
    name: String!
    "ISO 8601 date and time"
    date: String!
    "Computed from the steps: none done is PLANNED, some is ONGOING, all is DONE"
    status: ReleaseStatus!
    additionalInfo: String
    steps: [Step!]!
    completedStepCount: Int!
    totalStepCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  input CreateReleaseInput {
    name: String!
    date: String!
    additionalInfo: String
  }

  input UpdateReleaseInput {
    name: String
    date: String
    additionalInfo: String
  }

  type Query {
    "Newest first, one page at a time. limit is 1 to 100."
    releases(limit: Int = 20, offset: Int = 0): [Release!]!
    releaseCount: Int!
    release(id: ID!): Release
  }

  type Mutation {
    createRelease(input: CreateReleaseInput!): Release!
    updateRelease(id: ID!, input: UpdateReleaseInput!): Release!
    setStepCompleted(releaseId: ID!, stepId: ID!, completed: Boolean!): Release!
    deleteRelease(id: ID!): ID!
  }
`;

interface ReleaseRow {
  id: string;
  name: string;
  release_date: Date;
  additional_info: string | null;
  completed_steps: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Context {
  db: Db;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userError = (message: string) => new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
const notFound = () => new GraphQLError('Release not found', { extensions: { code: 'NOT_FOUND' } });

function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw userError('Name is required');
  if (trimmed.length > 120) throw userError('Name must be 120 characters or fewer');
  return trimmed;
}

function requireDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw userError('Date must be a valid ISO 8601 date');
  return date;
}

function cleanInfo(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length > 10_000) throw userError('Additional info must be 10,000 characters or fewer');
  return value.trim() || null;
}

function toRelease(row: ReleaseRow) {
  const completed = new Set(row.completed_steps);
  return {
    id: row.id,
    name: row.name,
    date: row.release_date.toISOString(),
    status: computeStatus(row.completed_steps),
    additionalInfo: row.additional_info,
    steps: STEPS.map((step) => ({ ...step, completed: completed.has(step.id) })),
    completedStepCount: STEPS.filter((step) => completed.has(step.id)).length,
    totalStepCount: STEPS.length,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function findRelease(db: Db, id: string): Promise<ReleaseRow | undefined> {
  if (!UUID.test(id)) return undefined;
  const { rows } = await db.query<ReleaseRow>('SELECT * FROM releases WHERE id = $1', [id]);
  return rows[0];
}

export const schema = createSchema<Context>({
  typeDefs,
  resolvers: {
    Query: {
      releases: async (_parent, { limit, offset }: { limit: number; offset: number }, { db }) => {
        if (limit < 1 || limit > 100) throw userError('limit must be between 1 and 100');
        if (offset < 0) throw userError('offset cannot be negative');
        const { rows } = await db.query<ReleaseRow>(
          'SELECT * FROM releases ORDER BY release_date DESC, id LIMIT $1 OFFSET $2',
          [limit, offset],
        );
        return rows.map(toRelease);
      },
      releaseCount: async (_parent, _args, { db }) => {
        const { rows } = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM releases');
        return rows[0]!.count;
      },
      release: async (_parent, { id }: { id: string }, { db }) => {
        const row = await findRelease(db, id);
        return row ? toRelease(row) : null;
      },
    },
    Mutation: {
      createRelease: async (
        _parent,
        { input }: { input: { name: string; date: string; additionalInfo?: string | null } },
        { db },
      ) => {
        const { rows } = await db.query<ReleaseRow>(
          `INSERT INTO releases (name, release_date, additional_info)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [requireName(input.name), requireDate(input.date), cleanInfo(input.additionalInfo)],
        );
        return toRelease(rows[0]!);
      },

      updateRelease: async (
        _parent,
        { id, input }: { id: string; input: { name?: string | null; date?: string | null; additionalInfo?: string | null } },
        { db },
      ) => {
        const current = await findRelease(db, id);
        if (!current) throw notFound();

        const { rows } = await db.query<ReleaseRow>(
          `UPDATE releases
              SET name = $2, release_date = $3, additional_info = $4, updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [
            id,
            input.name != null ? requireName(input.name) : current.name,
            input.date != null ? requireDate(input.date) : current.release_date,
            input.additionalInfo !== undefined ? cleanInfo(input.additionalInfo) : current.additional_info,
          ],
        );
        return toRelease(rows[0]!);
      },

      setStepCompleted: async (
        _parent,
        { releaseId, stepId, completed }: { releaseId: string; stepId: string; completed: boolean },
        { db },
      ) => {
        if (!isStepId(stepId)) throw userError(`Unknown step: ${stepId}`);
        if (!UUID.test(releaseId)) throw notFound();

        // One statement that edits the array in place. Reading the steps, changing them in code and
        // writing them back would let two quick clicks overwrite each other.
        const { rows } = await db.query<ReleaseRow>(
          `UPDATE releases
              SET completed_steps = CASE
                    WHEN $3 THEN array_append(array_remove(completed_steps, $2), $2)
                    ELSE array_remove(completed_steps, $2)
                  END,
                  updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [releaseId, stepId, completed],
        );
        if (!rows[0]) throw notFound();
        return toRelease(rows[0]);
      },

      deleteRelease: async (_parent, { id }: { id: string }, { db }) => {
        if (!UUID.test(id)) throw notFound();
        const { rowCount } = await db.query('DELETE FROM releases WHERE id = $1', [id]);
        if (!rowCount) throw notFound();
        return id;
      },
    },
  },
});
