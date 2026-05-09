/**
 * Outgoing Webhook Service
 * Sends events from our system to OJS and other integrations
 */

export type WebhookEventType =
  | 'article.created'
  | 'article.updated'
  | 'article.stageChanged'
  | 'article.deleted'
  | 'comment.added'
  | 'reviewer.assigned'
  | 'decision.made';

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookConfig {
  url: string;
  secret?: string;
  events: WebhookEventType[];
  enabled: boolean;
}

// Get configured webhooks from environment or database
function getWebhookConfigs(): WebhookConfig[] {
  const configs: WebhookConfig[] = [];

  // OJS Webhook
  const ojsWebhookUrl = process.env.OJS_WEBHOOK_URL;
  if (ojsWebhookUrl) {
    configs.push({
      url: ojsWebhookUrl,
      secret: process.env.OJS_WEBHOOK_SECRET,
      events: [
        'article.created',
        'article.updated',
        'article.stageChanged',
        'decision.made',
      ],
      enabled: true,
    });
  }

  // Custom webhook
  const customWebhookUrl = process.env.CUSTOM_WEBHOOK_URL;
  if (customWebhookUrl) {
    configs.push({
      url: customWebhookUrl,
      secret: process.env.CUSTOM_WEBHOOK_SECRET,
      events: [
        'article.created',
        'article.updated',
        'article.stageChanged',
        'article.deleted',
        'comment.added',
        'reviewer.assigned',
        'decision.made',
      ],
      enabled: true,
    });
  }

  return configs;
}

// Generate HMAC signature
function generateSignature(payload: string, secret: string): string {
  // In production, use crypto.createHmac
  // const hmac = crypto.createHmac('sha256', secret);
  // hmac.update(payload);
  // return hmac.digest('hex');
  return `sha256=${Buffer.from(payload).toString('base64').slice(0, 32)}`;
}

// Send webhook to a single endpoint
async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'EditorialWorkflow/1.0',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
    };

    if (config.secret) {
      headers['X-Webhook-Signature'] = generateSignature(body, config.secret);
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Webhook delivery queue (in-memory, use Redis in production)
interface QueuedWebhook {
  id: string;
  config: WebhookConfig;
  payload: WebhookPayload;
  attempts: number;
  lastAttempt?: string;
  nextRetry?: string;
}

const webhookQueue: QueuedWebhook[] = [];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

// Process webhook queue
async function processQueue() {
  const now = Date.now();

  for (let i = webhookQueue.length - 1; i >= 0; i--) {
    const item = webhookQueue[i];

    if (item.nextRetry && new Date(item.nextRetry).getTime() > now) {
      continue;
    }

    const result = await sendWebhook(item.config, item.payload);
    item.attempts++;
    item.lastAttempt = new Date().toISOString();

    if (result.success) {
      webhookQueue.splice(i, 1);
      console.log(`[Webhook] Delivered: ${item.payload.event} to ${item.config.url}`);
    } else if (item.attempts >= MAX_RETRIES) {
      webhookQueue.splice(i, 1);
      console.error(`[Webhook] Failed after ${MAX_RETRIES} attempts: ${item.payload.event} to ${item.config.url}`);
    } else {
      const delay = RETRY_DELAYS[item.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      item.nextRetry = new Date(now + delay).toISOString();
      console.log(`[Webhook] Retry scheduled for ${item.payload.event} at ${item.nextRetry}`);
    }
  }
}

// Start queue processor
let queueProcessor: NodeJS.Timeout | null = null;

export function startWebhookProcessor() {
  if (queueProcessor) return;
  queueProcessor = setInterval(processQueue, 5000);
}

export function stopWebhookProcessor() {
  if (queueProcessor) {
    clearInterval(queueProcessor);
    queueProcessor = null;
  }
}

/**
 * Emit a webhook event
 */
export async function emitWebhook(
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const configs = getWebhookConfigs();
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const config of configs) {
    if (!config.enabled || !config.events.includes(event)) {
      continue;
    }

    // Try immediate delivery
    const result = await sendWebhook(config, payload);

    if (!result.success) {
      // Queue for retry
      webhookQueue.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        config,
        payload,
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        nextRetry: new Date(Date.now() + RETRY_DELAYS[0]).toISOString(),
      });
    }
  }
}

/**
 * Get webhook queue status
 */
export function getWebhookQueueStatus() {
  return {
    pending: webhookQueue.length,
    items: webhookQueue.map(item => ({
      id: item.id,
      event: item.payload.event,
      url: item.config.url,
      attempts: item.attempts,
      lastAttempt: item.lastAttempt,
      nextRetry: item.nextRetry,
    })),
  };
}

// Helper functions for common events
export const webhookEvents = {
  articleCreated: (articleId: string, title: string, authors: string[]) =>
    emitWebhook('article.created', { articleId, title, authors }),

  articleUpdated: (articleId: string, changes: Record<string, unknown>) =>
    emitWebhook('article.updated', { articleId, changes }),

  articleStageChanged: (
    articleId: string,
    fromStage: string,
    toStage: string,
    changedBy: string
  ) =>
    emitWebhook('article.stageChanged', {
      articleId,
      fromStage,
      toStage,
      changedBy,
    }),

  articleDeleted: (articleId: string, deletedBy: string) =>
    emitWebhook('article.deleted', { articleId, deletedBy }),

  commentAdded: (articleId: string, commentId: string, authorId: string) =>
    emitWebhook('comment.added', { articleId, commentId, authorId }),

  reviewerAssigned: (articleId: string, reviewerId: string, dueDate: string) =>
    emitWebhook('reviewer.assigned', { articleId, reviewerId, dueDate }),

  decisionMade: (
    articleId: string,
    decision: 'accept' | 'reject' | 'revise',
    decidedBy: string
  ) =>
    emitWebhook('decision.made', { articleId, decision, decidedBy }),
};
