import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import AuthGate from './components/AuthGate.jsx';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>
      {({ user, onSignOut }) => (
        <App key={user.uid} user={user} onSignOut={onSignOut} />
      )}
    </AuthGate>
  </StrictMode>
);