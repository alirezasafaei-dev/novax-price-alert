import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './index.css';

function showFatalError(message: string) {
  const body = document.body || document.documentElement;
  body.innerHTML = `
    <div style="font-family: system-ui, sans-serif; background:#060814; color:#fff; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; direction:rtl; text-align:center;">
      <div style="max-width:420px; background:#181d33; border:1px solid #334155; border-radius:16px; padding:24px;">
        <div style="font-size:15px; font-weight:600; margin-bottom:8px;">NovaX Mini App</div>
        <div style="color:#fda4af; font-size:13px; line-height:1.5;">${message}</div>
        <div style="margin-top:12px; font-size:11px; color:#64748b;">برای رفع مشکل، اسکریپت دیپلوی KV مینی‌اپ را دوباره اجرا کنید.</div>
      </div>
    </div>
  `;
  // Also log for debugging
  console.error('[NovaX mini-app bootstrap]', message);
}

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    const loading = document.getElementById('app-loading');
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
    showFatalError('نقطه اتصال (root) در صفحه پیدا نشد. HTML نامعتبر است.');
  } else {
    // Remove the static loading indicator immediately before React takes over
    const loading = document.getElementById('app-loading');
    if (loading && loading.parentNode) loading.parentNode.removeChild(loading);

    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
} catch (err: any) {
  const loading = document.getElementById('app-loading');
  if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
  showFatalError('خطا در راه‌اندازی رابط کاربری مینی‌اپ: ' + (err?.message || String(err)));
}
