/**
 * OJS Webhook Handler
 * Receives events from OJS and updates local system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCache, CACHE_KEYS } from '@/lib/redis';

// OJS Event Types
type OJSEventType =
  | 'submission.created'
  | 'submission.updated'
  | 'submission.statusChanged'
  | 'submission.published'
  | 'submission.declined'
  | 'review.assigned'
  | 'review.completed'
  | 'revision.requested'
  | 'revision.submitted';

interface OJSWebhookPayload {
  event: OJSEventType;
  timestamp: string;
  data: {
    submissionId: number;
    journalPath: string;
    title?: string;
    status?: number;
    statusLabel?: string;
    previousStatus?: number;
    authors?: { givenName: string; familyName: string; email: string }[];
    reviewerId?: string;
    recommendation?: string;
    [key: string]: unknown;
  };
  signature?: string;
}

// Verify webhook signature
function verifySignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.OJS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('OJS_WEBHOOK_SECRET not configured, skipping signature verification');
    return true; // Allow in development
  }

  if (!signature) {
    return false;
  }

  // In production, implement HMAC verification
  // const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  return true; // Placeholder
}

// Process different event types
async function processEvent(event: OJSEventType, data: OJSWebhookPayload['data']) {
  const cache = getCache();

  switch (event) {
    case 'submission.created':
      console.log(`[OJS Webhook] New submission: ${data.submissionId} - ${data.title}`);
      // Invalidate submissions cache
      await cache.del(CACHE_KEYS.OJS_SUBMISSIONS);
      await cache.del(CACHE_KEYS.OJS_STATS);
      break;

    case 'submission.updated':
      console.log(`[OJS Webhook] Submission updated: ${data.submissionId}`);
      await cache.del(CACHE_KEYS.OJS_SUBMISSION(data.submissionId));
      await cache.del(CACHE_KEYS.OJS_SUBMISSIONS);
      break;

    case 'submission.statusChanged':
      console.log(`[OJS Webhook] Status changed: ${data.submissionId} - ${data.previousStatus} -> ${data.status}`);
      await cache.del(CACHE_KEYS.OJS_SUBMISSION(data.submissionId));
      await cache.del(CACHE_KEYS.OJS_SUBMISSIONS);
      await cache.del(CACHE_KEYS.OJS_STATS);
      break;

    case 'submission.published':
      console.log(`[OJS Webhook] Published: ${data.submissionId}`);
      await cache.invalidatePattern('ojs:*');
      break;

    case 'submission.declined':
      console.log(`[OJS Webhook] Declined: ${data.submissionId}`);
      await cache.invalidatePattern('ojs:*');
      break;

    case 'review.assigned':
      console.log(`[OJS Webhook] Review assigned: ${data.submissionId} -> ${data.reviewerId}`);
      await cache.del(CACHE_KEYS.OJS_SUBMISSION(data.submissionId));
      break;

    case 'review.completed':
      console.log(`[OJS Webhook] Review completed: ${data.submissionId} - ${data.recommendation}`);
      await cache.del(CACHE_KEYS.OJS_SUBMISSION(data.submissionId));
      await cache.del(CACHE_KEYS.OJS_SUBMISSIONS);
      break;

    case 'revision.requested':
    case 'revision.submitted':
      console.log(`[OJS Webhook] Revision ${event.split('.')[1]}: ${data.submissionId}`);
      await cache.del(CACHE_KEYS.OJS_SUBMISSION(data.submissionId));
      await cache.del(CACHE_KEYS.OJS_SUBMISSIONS);
      break;

    default:
      console.log(`[OJS Webhook] Unknown event: ${event}`);
  }
}

// Store webhook events for debugging
const recentEvents: { timestamp: string; event: OJSEventType; submissionId: number }[] = [];
const MAX_RECENT_EVENTS = 100;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-ojs-signature');

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: OJSWebhookPayload = JSON.parse(rawBody);

    // Validate payload
    if (!payload.event || !payload.data || !payload.data.submissionId) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // Store event for debugging
    recentEvents.unshift({
      timestamp: payload.timestamp || new Date().toISOString(),
      event: payload.event,
      submissionId: payload.data.submissionId,
    });

    // Keep only recent events
    while (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.pop();
    }

    // Process the event
    await processEvent(payload.event, payload.data);

    return NextResponse.json({
      success: true,
      message: `Event ${payload.event} processed`,
      submissionId: payload.data.submissionId,
    });

  } catch (error) {
    console.error('[OJS Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check webhook status and recent events
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showEvents = searchParams.get('events') === 'true';

  return NextResponse.json({
    status: 'active',
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/ojs`,
    configured: !!process.env.OJS_WEBHOOK_SECRET,
    recentEventsCount: recentEvents.length,
    ...(showEvents && { recentEvents: recentEvents.slice(0, 20) }),
  });
}
