// Monitoring configuration for the mini app
export const monitoringConfig = {
  // Performance monitoring thresholds (in ms)
  performance: {
    pageLoad: 3000,           // Maximum acceptable page load time
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    firstInputDelay: 100,
    cumulativeLayoutShift: 0.1,
  },

  // Error tracking
  errors: {
    maxErrorsPerSession: 10,
    criticalErrorThreshold: 5,
  },

  // User engagement metrics
  engagement: {
    sessionDuration: {
      short: 30000,        // 30 seconds
      medium: 180000,      // 3 minutes
      long: 600000,        // 10 minutes
    },
    pageViewsPerSession: {
      low: 1,
      medium: 3,
      high: 7,
    },
  },

  // Feature usage tracking
  features: {
    alertCreation: 'alert_creation',
    priceTracking: 'price_tracking',
    aiAssistant: 'ai_assistant',
    languageToggle: 'language_toggle',
    simulationMode: 'simulation_mode',
  },

  // Custom events to track
  events: {
    // Price board events
    PRICE_VIEW: 'price_view',
    PRICE_REFRESH: 'price_refresh',
    ASSET_SELECT: 'asset_select',
    
    // Alert events
    ALERT_CREATE: 'alert_create',
    ALERT_DELETE: 'alert_delete',
    ALERT_TOGGLE: 'alert_toggle',
    ALERT_TRIGGER: 'alert_trigger',
    
    // Navigation events
    TAB_SWITCH: 'tab_switch',
    PAGE_NAVIGATE: 'page_navigate',
    
    // AI events
    AI_QUERY: 'ai_query',
    AI_RESPONSE: 'ai_response',
    
    // Error events
    ERROR_BOUNDARY: 'error_boundary',
    NETWORK_ERROR: 'network_error',
    API_ERROR: 'api_error',
  },

  // Sampling rates (to reduce analytics volume)
  sampling: {
    performance: 0.1,       // 10% of users
    errors: 1.0,             // 100% of errors
    events: 0.5,            // 50% of custom events
  },
};

// Simple performance monitor
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  getMetrics() {
    const result: Record<string, number> = {};
    this.metrics.forEach((values, name) => {
      result[name] = this.getAverage(name);
    });
    return result;
  }

  reset() {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();