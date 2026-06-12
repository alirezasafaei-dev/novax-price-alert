// Simple analytics hook for tracking user interactions
// Can be extended with Google Analytics, Plausible, or other analytics services

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export function useAnalytics() {
  const trackEvent = (event: AnalyticsEvent) => {
    // Console log for development - replace with actual analytics service
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event);
    }

    // Example: Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
      });
    }

    // Example: Plausible Analytics
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible(event.action, {
        props: {
          category: event.category,
          label: event.label,
          value: event.value,
        },
      });
    }
  };

  const trackPageView = (page: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Page View:', page);
    }

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: page,
        page_location: window.location.href,
      });
    }

    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('pageview', {
        u: window.location.href,
      });
    }
  };

  const trackError = (error: Error, context?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics Error:', error, context);
    }

    // Send to error tracking service (e.g., Sentry)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: { context },
      });
    }
  };

  const trackPerformance = (metricName: string, value: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance:', metricName, value);
    }

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'timing_complete', {
        name: metricName,
        value: Math.round(value),
      });
    }
  };

  return {
    trackEvent,
    trackPageView,
    trackError,
    trackPerformance,
  };
}