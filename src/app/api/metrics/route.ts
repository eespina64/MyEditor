/**
 * Prometheus Metrics Endpoint
 * Exposes application metrics in Prometheus format
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics, appMetrics } from '@/lib/metrics';

// Update article metrics (this would normally be called from the store)
async function updateArticleMetrics() {
  // In a real implementation, this would query the database
  // For now, we set some example values
  appMetrics.articlesTotal.set(10);
  appMetrics.articlesByStage.set(2, { stage: 'recepcion' });
  appMetrics.articlesByStage.set(2, { stage: 'evaluacion_inicial' });
  appMetrics.articlesByStage.set(3, { stage: 'revision_pares' });
  appMetrics.articlesByStage.set(1, { stage: 'revision_autor' });
  appMetrics.articlesByStage.set(1, { stage: 'edicion' });
  appMetrics.articlesByStage.set(1, { stage: 'publicacion' });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  // Check for authentication if needed
  const authHeader = request.headers.get('authorization');
  const metricsToken = process.env.METRICS_TOKEN;

  if (metricsToken && authHeader !== `Bearer ${metricsToken}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Update metrics before returning
  await updateArticleMetrics();

  if (format === 'json') {
    return NextResponse.json(metrics.toJSON());
  }

  // Default: Prometheus format
  const prometheusMetrics = metrics.toPrometheusFormat();

  return new NextResponse(prometheusMetrics, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
