import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, type ReleaseSummary } from '../api';
import { PanelHeader, StatusBadge } from '../components';

export function ReleaseList() {
  const [releases, setReleases] = useState<ReleaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listReleases().then(setReleases, (err: Error) => setError(err.message));
  }, []);

  async function remove(release: ReleaseSummary) {
    if (!window.confirm(`Delete "${release.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteRelease(release.id);
      setReleases((current) => current?.filter((r) => r.id !== release.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PanelHeader>
        <Link className="button" to="/releases/new">
          New release <span aria-hidden="true">+</span>
        </Link>
      </PanelHeader>

      {error && <p className="message error">{error}</p>}
      {!releases && !error && <p className="message">Loading releases...</p>}
      {releases?.length === 0 && (
        <p className="message">No releases yet. Create the first one with "New release".</p>
      )}

      {releases && releases.length > 0 && (
        <table className="releases">
          <thead>
            <tr>
              <th>Release</th>
              <th>Date</th>
              <th>Status</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.id}>
                <td data-label="Release">
                  <Link to={`/releases/${release.id}`}>{release.name}</Link>
                </td>
                <td data-label="Date">{formatDate(release.date)}</td>
                <td data-label="Status">
                  <StatusBadge status={release.status} />
                  <span className="progress">
                    {release.completedStepCount}/{release.totalStepCount}
                  </span>
                </td>
                <td className="row-actions">
                  <Link to={`/releases/${release.id}`}>View</Link>
                  <button type="button" className="link danger" onClick={() => remove(release)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
