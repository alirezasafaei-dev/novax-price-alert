import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';

function mountLegacyApp() {
  const root = document.getElementById('root');
  if (!root) return;

  // Remove any static loading indicator (so we don't stay stuck on placeholder)
  const loading = document.getElementById('app-loading');
  if (loading && loading.parentNode) loading.parentNode.removeChild(loading);

  // Clear any previous static content inside root (e.g. old placeholder)
  if (root.childElementCount > 0) {
    root.innerHTML = '';
  }

  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

setTimeout(mountLegacyApp, 1200);
