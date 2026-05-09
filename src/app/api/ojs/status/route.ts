import { NextResponse } from 'next/server';
import { createOJSClient } from '@/lib/ojs';

export async function GET() {
  const client = createOJSClient();

  if (!client) {
    return NextResponse.json({
      connected: false,
      message: 'OJS no está configurado. Configure las variables de entorno OJS_BASE_URL, OJS_API_KEY y OJS_JOURNAL_PATH.'
    });
  }

  try {
    const isConnected = await client.testConnection();

    return NextResponse.json({
      connected: isConnected,
      message: isConnected ? 'Conexión exitosa' : 'No se pudo conectar con OJS'
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      message: error instanceof Error ? error.message : 'Error de conexión'
    });
  }
}
