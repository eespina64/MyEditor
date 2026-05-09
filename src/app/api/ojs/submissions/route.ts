import { NextResponse } from 'next/server';
import { createOJSClient } from '@/lib/ojs';

export async function GET(request: Request) {
  const client = createOJSClient();

  if (!client) {
    return NextResponse.json(
      { error: 'OJS no está configurado' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const params: { count: number; offset: number; status?: number } = { count, offset };
    if (status) {
      params.status = parseInt(status);
    }

    const submissions = await client.getSubmissions(params);
    return NextResponse.json(submissions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener envíos' },
      { status: 500 }
    );
  }
}
