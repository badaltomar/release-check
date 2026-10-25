import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, type ReleaseSummary } from '../api';
import { PanelHeader, StatusBadge } from '../components';

const PAGE_SIZE = 20;

export function ReleaseList() {
  const [releases, setReleases] = useState<ReleaseSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listReleases(PAGE_SIZE, page * PAGE_SIZE).then(
      (result) => {
        setReleases(result.releases);
        setTotal(result.releaseCount);
      },
      (err: Error) => setError(err.message),
    );
  }, [page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function remove(release: ReleaseSummary) {
    if (!window.confirm(`Delete "${release.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteRelease(release.id);
      setReleases((current) => current?.filter((r) => r.id !== release.id) ?? null);
      setTotal((count) => count - 1);
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

      {pageCount > 1 && (
        <nav className="pager" aria-label="Pages">
          <button type="button" className="link" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" className="link" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </nav>
      )}
    </>
  );
}
