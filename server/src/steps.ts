/**
 * The checklist is the same for every release, so it lives in code rather than in a table.
 * Releases store the ids of the steps they have completed. Ids are stable; labels can change.
 */
export const STEPS = [
  { id: 'prs-merged', label: 'All relevant GitHub pull requests have been merged' },
  { id: 'changelog-updated', label: 'CHANGELOG.md files have been updated' },
  { id: 'tests-passing', label: 'All tests are passing' },
  { id: 'github-release', label: 'Release created in GitHub' },
  { id: 'deployed-demo', label: 'Deployed in demo' },
  { id: 'tested-demo', label: 'Tested thoroughly in demo' },
  { id: 'deployed-production', label: 'Deployed in production' },
  { id: 'team-notified', label: 'Team and stakeholders notified' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

const STEP_IDS = new Set<string>(STEPS.map((step) => step.id));

export const isStepId = (value: string): value is StepId => STEP_IDS.has(value);

export type ReleaseStatus = 'PLANNED' | 'ONGOING' | 'DONE';

/** No step done: planned. Some steps done: ongoing. Every step done: done. */
export function computeStatus(completedSteps: readonly string[]): ReleaseStatus {
  const done = STEPS.filter((step) => completedSteps.includes(step.id)).length;
  if (done === 0) return 'PLANNED';
  if (done === STEPS.length) return 'DONE';
  return 'ONGOING';
}
