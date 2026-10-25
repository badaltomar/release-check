import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ReleaseStatus } from './api';

const STATUS_LABELS: Record<ReleaseStatus, string> = {
  PLANNED: 'Planned',
  ONGOING: 'Ongoing',
  DONE: 'Done',
};

export function StatusBadge({ status }: { status: ReleaseStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export function PanelHeader({ crumb, children }: { crumb?: string; children?: ReactNode }) {
  return (
    <div className="panel-header">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumb ? (
          <>
            <Link to="/">All releases</Link>
            <span aria-hidden="true">›</span>
            <span className="crumb-current">{crumb}</span>
          </>
        ) : (
          <span className="crumb-current">All releases</span>
        )}
      </nav>
      <div className="panel-actions">{children}</div>
    </div>
  );
}
