import { Route, Routes } from 'react-router-dom';
import { NewRelease } from './pages/NewRelease';
import { ReleaseDetail } from './pages/ReleaseDetail';
import { ReleaseList } from './pages/ReleaseList';

export function App() {
  return (
    <div className="page">
      <header className="masthead">
        <h1>ReleaseCheck</h1>
        <p>Your all-in-one release checklist tool</p>
      </header>
      <main className="panel">
        <Routes>
          <Route path="/" element={<ReleaseList />} />
          <Route path="/releases/new" element={<NewRelease />} />
          <Route path="/releases/:id" element={<ReleaseDetail />} />
          <Route path="*" element={<p className="message">This page does not exist.</p>} />
        </Routes>
      </main>
    </div>
  );
}
