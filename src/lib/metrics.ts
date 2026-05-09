/**
 * Application Metrics for Prometheus
 * Collects and exposes metrics for monitoring
 */

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: MetricValue[];
}

class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private histogramBuckets = [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10];

  // Counter: values only go up
  counter(name: string, help: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, help, type: 'counter', values: [] });
    }
    return {
      inc: (labels?: Record<string, string>, value = 1) => {
        const metric = this.metrics.get(name)!;
        const existingIndex = metric.values.findIndex(
          (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
        );
        if (existingIndex >= 0) {
          metric.values[existingIndex].value += value;
          metric.values[existingIndex].timestamp = Date.now();
        } else {
          metric.values.push({ value, labels, timestamp: Date.now() });
        }
      },
    };
  }

  // Gauge: values can go up or down
  gauge(name: string, help: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, help, type: 'gauge', values: [] });
    }
    return {
      set: (value: number, labels?: Record<string, string>) => {
        const metric = this.metrics.get(name)!;
        const existingIndex = metric.values.findIndex(
          (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
        );
        if (existingIndex >= 0) {
          metric.values[existingIndex].value = value;
          metric.values[existingIndex].timestamp = Date.now();
        } else {
          metric.values.push({ value, labels, timestamp: Date.now() });
        }
      },
      inc: (labels?: Record<string, string>, value = 1) => {
        const metric = this.metrics.get(name)!;
        const existingIndex = metric.values.findIndex(
          (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
        );
        if (existingIndex >= 0) {
          metric.values[existingIndex].value += value;
        } else {
          metric.values.push({ value, labels, timestamp: Date.now() });
        }
      },
      dec: (labels?: Record<string, string>, value = 1) => {
        const metric = this.metrics.get(name)!;
        const existingIndex = metric.values.findIndex(
          (v) => JSON.stringify(v.labels) === JSON.stringify(labels)
        );
        if (existingIndex >= 0) {
          metric.values[existingIndex].value -= value;
        } else {
          metric.values.push({ value: -value, labels, timestamp: Date.now() });
        }
      },
    };
  }

  // Histogram: track distributions
  histogram(name: string, help: string) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { name, help, type: 'histogram', values: [] });
    }
    return {
      observe: (value: number, labels?: Record<string, string>) => {
        const metric = this.metrics.get(name)!;
        metric.values.push({ value, labels, timestamp: Date.now() });
        // Keep only last 1000 observations
        if (metric.values.length > 1000) {
          metric.values = metric.values.slice(-1000);
        }
      },
    };
  }

  // Format metrics for Prometheus
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [, metric] of this.metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        // Calculate histogram buckets
        const observations = metric.values.map((v) => v.value);
        const sum = observations.reduce((a, b) => a + b, 0);
        const count = observations.length;

        for (const bucket of this.histogramBuckets) {
          const bucketCount = observations.filter((v) => v <= bucket).length;
          lines.push(`${metric.name}_bucket{le="${bucket}"} ${bucketCount}`);
        }
        lines.push(`${metric.name}_bucket{le="+Inf"} ${count}`);
        lines.push(`${metric.name}_sum ${sum}`);
        lines.push(`${metric.name}_count ${count}`);
      } else {
        for (const value of metric.values) {
          const labelStr = value.labels
            ? `{${Object.entries(value.labels)
                .map(([k, v]) => `${k}="${v}"`)
                .join(',')}}`
            : '';
          lines.push(`${metric.name}${labelStr} ${value.value}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // Get all metrics as JSON
  toJSON() {
    const result: Record<string, unknown> = {};
    for (const [name, metric] of this.metrics) {
      result[name] = {
        help: metric.help,
        type: metric.type,
        values: metric.values,
      };
    }
    return result;
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Pre-defined metrics
export const appMetrics = {
  // HTTP metrics
  httpRequestsTotal: metrics.counter(
    'editorial_http_requests_total',
    'Total number of HTTP requests'
  ),
  httpRequestDuration: metrics.histogram(
    'editorial_http_request_duration_seconds',
    'HTTP request duration in seconds'
  ),
  httpRequestErrors: metrics.counter(
    'editorial_http_request_errors_total',
    'Total number of HTTP request errors'
  ),

  // Article metrics
  articlesTotal: metrics.gauge(
    'editorial_articles_total',
    'Total number of articles'
  ),
  articlesByStage: metrics.gauge(
    'editorial_articles_by_stage',
    'Number of articles by stage'
  ),
  articlesByPriority: metrics.gauge(
    'editorial_articles_by_priority',
    'Number of articles by priority'
  ),
  articleStageChanges: metrics.counter(
    'editorial_article_stage_changes_total',
    'Total number of article stage changes'
  ),

  // OJS metrics
  ojsApiCalls: metrics.counter(
    'editorial_ojs_api_calls_total',
    'Total number of OJS API calls'
  ),
  ojsApiErrors: metrics.counter(
    'editorial_ojs_api_errors_total',
    'Total number of OJS API errors'
  ),
  ojsApiLatency: metrics.histogram(
    'editorial_ojs_api_latency_seconds',
    'OJS API call latency in seconds'
  ),
  ojsSyncOperations: metrics.counter(
    'editorial_ojs_sync_operations_total',
    'Total number of OJS sync operations'
  ),

  // Cache metrics
  cacheHits: metrics.counter(
    'editorial_cache_hits_total',
    'Total number of cache hits'
  ),
  cacheMisses: metrics.counter(
    'editorial_cache_misses_total',
    'Total number of cache misses'
  ),

  // Webhook metrics
  webhooksReceived: metrics.counter(
    'editorial_webhooks_received_total',
    'Total number of webhooks received'
  ),
  webhooksSent: metrics.counter(
    'editorial_webhooks_sent_total',
    'Total number of webhooks sent'
  ),
  webhookErrors: metrics.counter(
    'editorial_webhook_errors_total',
    'Total number of webhook errors'
  ),

  // Auth metrics
  authLogins: metrics.counter(
    'editorial_auth_logins_total',
    'Total number of login attempts'
  ),
  authFailures: metrics.counter(
    'editorial_auth_failures_total',
    'Total number of failed login attempts'
  ),
  activeUsers: metrics.gauge(
    'editorial_active_users',
    'Number of active users'
  ),
};

// Helper function to track request duration
export function trackRequestDuration(
  startTime: number,
  method: string,
  path: string,
  status: number
) {
  const duration = (Date.now() - startTime) / 1000;
  appMetrics.httpRequestDuration.observe(duration, { method, path });
  appMetrics.httpRequestsTotal.inc({ method, path, status: status.toString() });

  if (status >= 400) {
    appMetrics.httpRequestErrors.inc({ method, path, status: status.toString() });
  }
}
