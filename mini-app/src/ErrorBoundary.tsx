import {Component, ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error) {
    console.error('Mini-app render failed', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6" dir="rtl">
        <section className="max-w-md rounded-3xl border border-rose-500/40 bg-rose-950/30 p-6 shadow-2xl">
          <h1 className="text-lg font-bold mb-3">داشبورد نوواکس موقتاً بارگذاری نشد</h1>
          <p className="text-sm leading-7 text-rose-100">
            یک خطای داخلی در رابط کاربری رخ داد. لطفاً صفحه را دوباره باز کنید؛ اگر مشکل ادامه داشت، تیم پشتیبانی
            می‌تواند خطای زیر را در لاگ مرورگر بررسی کند.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-black/40 p-3 text-xs text-rose-100" dir="ltr">
            {this.state.error.message}
          </pre>
        </section>
      </main>
    );
  }
}
