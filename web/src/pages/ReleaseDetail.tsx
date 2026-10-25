import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fromLocalInput, toLocalInput, type Release } from '../api';
import { PanelHeader, StatusBadge } from '../components';

export function ReleaseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [release, setRelease] = useState<Release | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load(next: Release) {
    setRelease(next);
    setName(next.name);
    setDate(toLocalInput(next.date));
    setAdditionalInfo(next.additionalInfo ?? '');
  }

  useEffect(() => {
    api.getRelease(id).then(
      (found) => (found ? load(found) : setRelease(null)),
      (err: Error) => setError(err.message),
    );
  }, [id]);

  async function toggleStep(stepId: string, completed: boolean) {
    if (!release) return;
    setError(null);
    // Show the tick straight away; the server answer then sets the real status.
    setRelease({ ...release, steps: release.steps.map((s) => (s.id === stepId ? { ...s, completed } : s)) });
    try {
      const updated = await api.setStepCompleted(release.id, stepId, completed);
      setRelease((current) => (current ? { ...current, ...updated, additionalInfo: current.additionalInfo } : updated));
    } catch (err) {
      setRelease(release);
      setError((err as Error).message);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!release) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      load(await api.updateRelease(release.id, { name, date: fromLocalInput(date), additionalInfo: additionalInfo || null }));
      setNotice('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!release || !window.confirm(`Delete "${release.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteRelease(release.id);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (release === undefined) {
    return error ? <p className="message error">{error}</p> : <p className="message">Loading release...</p>;
  }
  if (release === null) {
    return (
      <>
        <PanelHeader crumb="Not found" />
        <p className="message">This release does not exist. It may have been deleted.</p>
      </>
    );
  }

  return (
    <>
      <PanelHeader crumb={release.name}>
        <button type="button" className="button danger" onClick={remove}>
          Delete
        </button>
      </PanelHeader>

      <form className="release-form" onSubmit={save}>
        <div className="field-row">
          <label className="field">
            <span>Release</span>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </label>
          <label className="field">
            <span>Date</span>
            <input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div className="field">
            <span>Status</span>
            <div className="status-line">
              <StatusBadge status={release.status} />
              <span className="progress">
                {release.completedStepCount} of {release.totalStepCount} steps done
              </span>
            </div>
          </div>
        </div>

        <fieldset className="steps">
          <legend>Checklist</legend>
          <p className="hint">Steps save as soon as you tick them.</p>
          {release.steps.map((step) => (
            <label key={step.id} className="step">
              <input
                id={`step-${step.id}`}
                type="checkbox"
                checked={step.completed}
                onChange={(e) => toggleStep(step.id, e.target.checked)}
              />
              <span>{step.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span>Additional remarks / tasks</span>
          <textarea
            id="additional-info"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Any other important notes for the release"
            rows={5}
          />
        </label>

        {error && <p className="message error">{error}</p>}
        <div className="form-actions">
          {notice && <span className="notice">{notice}</span>}
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save details'}
          </button>
        </div>
      </form>
    </>
  );
}
