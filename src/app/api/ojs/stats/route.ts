import { NextResponse } from 'next/server';
import { createOJSClient } from '@/lib/ojs';

export async function GET() {
  const client = createOJSClient();

  if (!client) {
    return NextResponse.json(
      { error: 'OJS no está configurado' },
      { status: 503 }
    );
  }

  try {
    const stats = await client.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
