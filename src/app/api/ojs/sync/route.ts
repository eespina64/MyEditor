import { NextResponse } from 'next/server';
import { createOJSClient, ojsSubmissionToArticle } from '@/lib/ojs';

export async function POST() {
  const client = createOJSClient();

  if (!client) {
    return NextResponse.json(
      { error: 'OJS no está configurado' },
      { status: 503 }
    );
  }

  try {
    // Fetch all submissions from OJS
    const { items, itemsMax } = await client.getSubmissions({ count: 100 });

    // Convert to local article format
    const articles = items.map(ojsSubmissionToArticle);

    return NextResponse.json({
      success: true,
      synced: articles.length,
      total: itemsMax,
      articles
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al sincronizar' },
      { status: 500 }
    );
  }
}
