export type ReleaseStatus = 'PLANNED' | 'ONGOING' | 'DONE';

export interface Step {
  id: string;
  label: string;
  completed: boolean;
}

export interface ReleaseSummary {
  id: string;
  name: string;
  date: string;
  status: ReleaseStatus;
  completedStepCount: number;
  totalStepCount: number;
}

export interface Release extends ReleaseSummary {
  additionalInfo: string | null;
  steps: Step[];
}

export interface ReleaseInput {
  name: string;
  date: string;
  additionalInfo: string | null;
}

const SUMMARY_FIELDS = 'id name date status completedStepCount totalStepCount';
const RELEASE_FIELDS = `${SUMMARY_FIELDS} additionalInfo steps { id label completed }`;

async function request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (body?.errors?.length) throw new Error(body.errors[0]!.message);
  if (!res.ok || !body?.data) throw new Error('The server could not be reached. Please try again.');
  return body.data;
}

export const api = {
  async listReleases(limit: number, offset: number) {
    return request<{ releases: ReleaseSummary[]; releaseCount: number }>(
      `query ($limit: Int!, $offset: Int!) { releaseCount releases(limit: $limit, offset: $offset) { ${SUMMARY_FIELDS} } }`,
      { limit, offset },
    );
  },

  async getRelease(id: string) {
    const data = await request<{ release: Release | null }>(
      `query ($id: ID!) { release(id: $id) { ${RELEASE_FIELDS} } }`,
      { id },
    );
    return data.release;
  },

  async createRelease(input: ReleaseInput) {
    const data = await request<{ createRelease: Release }>(
      `mutation ($input: CreateReleaseInput!) { createRelease(input: $input) { ${RELEASE_FIELDS} } }`,
      { input },
    );
    return data.createRelease;
  },

  async updateRelease(id: string, input: ReleaseInput) {
    const data = await request<{ updateRelease: Release }>(
      `mutation ($id: ID!, $input: UpdateReleaseInput!) { updateRelease(id: $id, input: $input) { ${RELEASE_FIELDS} } }`,
      { id, input },
    );
    return data.updateRelease;
  },

  async setStepCompleted(releaseId: string, stepId: string, completed: boolean) {
    const data = await request<{ setStepCompleted: Release }>(
      `mutation ($releaseId: ID!, $stepId: ID!, $completed: Boolean!) {
         setStepCompleted(releaseId: $releaseId, stepId: $stepId, completed: $completed) { ${RELEASE_FIELDS} }
       }`,
      { releaseId, stepId, completed },
    );
    return data.setStepCompleted;
  },

  async deleteRelease(id: string) {
    await request(`mutation ($id: ID!) { deleteRelease(id: $id) }`, { id });
  },
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

/** `<input type="datetime-local">` works in local time without a zone, so convert both ways. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export const fromLocalInput = (value: string) => new Date(value).toISOString();
