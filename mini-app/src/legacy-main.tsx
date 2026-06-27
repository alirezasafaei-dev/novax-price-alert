import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';

function mountLegacyApp() {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

setTimeout(mountLegacyApp, 1200);
