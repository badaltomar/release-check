import { describe, expect, it } from 'vitest';
import { STEPS, computeStatus } from '../src/steps.js';

describe('computeStatus', () => {
  const allSteps = STEPS.map((step) => step.id);

  it('is PLANNED when no step is done', () => {
    expect(computeStatus([])).toBe('PLANNED');
  });

  it('is ONGOING when some steps are done', () => {
    expect(computeStatus(['tests-passing'])).toBe('ONGOING');
    expect(computeStatus(allSteps.slice(1))).toBe('ONGOING');
  });

  it('is DONE when every step is done', () => {
    expect(computeStatus(allSteps)).toBe('DONE');
  });

  it('ignores step ids that are not part of the checklist', () => {
    expect(computeStatus(['removed-step'])).toBe('PLANNED');
  });
});
