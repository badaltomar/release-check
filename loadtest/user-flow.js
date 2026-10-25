// One virtual user repeats what a person does in the app:
// open the list, open one release, tick or untick a step.
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const VUS = Number(__ENV.VUS);
const DURATION = __ENV.DURATION || '20s';

const releaseIds = new SharedArray('releases', () => JSON.parse(open('./releases.json')));
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

const ok = new Counter('ok_requests');
const dropped = new Counter('dropped_requests');
const failed = new Counter('failed_requests');

export const options = {
  scenarios: { users: { executor: 'constant-vus', vus: VUS, duration: DURATION } },
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
};

const LIST = '{ releases { id name date status completedStepCount totalStepCount } }';
const DETAIL = 'query ($id: ID!) { release(id: $id) { id name date status additionalInfo steps { id label completed } } }';
const TOGGLE =
  'mutation ($releaseId: ID!, $stepId: ID!, $completed: Boolean!) { setStepCompleted(releaseId: $releaseId, stepId: $stepId, completed: $completed) { id status } }';

function graphql(name, query, variables) {
  const res = http.post(`${BASE_URL}/graphql`, JSON.stringify({ query, variables }), {
    headers: { 'content-type': 'application/json' },
    timeout: '10s',
    tags: { name },
  });
  if (res.status === 0) dropped.add(1);
  else if (res.status !== 200 || (res.body && res.body.includes('"errors"'))) failed.add(1);
  else ok.add(1);
}

export default function () {
  const id = releaseIds[Math.floor(Math.random() * releaseIds.length)];
  const step = STEP_IDS[Math.floor(Math.random() * STEP_IDS.length)];
  graphql('list', LIST, {});
  graphql('detail', DETAIL, { id });
  graphql('toggle', TOGGLE, { releaseId: id, stepId: step, completed: Math.random() < 0.5 });
}

export function handleSummary(data) {
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const duration = data.metrics.http_req_duration.values;
  const summary = {
    users: VUS,
    requests: count('http_reqs'),
    rps: data.metrics.http_reqs.values.rate,
    ok: count('ok_requests'),
    dropped: count('dropped_requests'),
    failed: count('failed_requests'),
    p50: duration.med,
    p95: duration['p(95)'],
    p99: duration['p(99)'],
  };
  return { '/loadtest/results/last-run.json': JSON.stringify(summary) };
}
