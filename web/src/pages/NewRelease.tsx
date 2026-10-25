import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fromLocalInput, toLocalInput } from '../api';
import { PanelHeader } from '../components';

const oneWeekFromNow = () => {
  const date = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  date.setHours(10, 0, 0, 0);
  return toLocalInput(date.toISOString());
};

export function NewRelease() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState(oneWeekFromNow);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const release = await api.createRelease({ name, date: fromLocalInput(date), additionalInfo: additionalInfo || null });
      navigate(`/releases/${release.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <PanelHeader crumb="New release" />
      <form className="release-form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span>Release</span>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Version 1.2.0"
              maxLength={120}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
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
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create release'}
          </button>
        </div>
      </form>
    </>
  );
}
