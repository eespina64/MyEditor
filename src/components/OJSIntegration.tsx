'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  Clock,
  Download,
  Settings,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useArticleStore } from '@/store/articleStore';

interface OJSStats {
  totalSubmissions: number;
  underReview: number;
  accepted: number;
  rejected: number;
  published: number;
}

interface OJSSubmission {
  id: number;
  title: string;
  status: string;
  dateSubmitted: string;
  authors: { givenName: string; familyName: string; email: string }[];
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function OJSIntegration() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [stats, setStats] = useState<OJSStats | null>(null);
  const [submissions, setSubmissions] = useState<OJSSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { addArticle } = useArticleStore();

  const checkConnection = async () => {
    setConnectionStatus('connecting');
    setError(null);

    try {
      const response = await fetch('/api/ojs/status');
      const data = await response.json();

      if (data.connected) {
        setConnectionStatus('connected');
        // Fetch stats and submissions
        await Promise.all([fetchStats(), fetchSubmissions()]);
      } else {
        setConnectionStatus('disconnected');
        setError(data.message || 'No se pudo conectar con OJS');
      }
    } catch (err) {
      setConnectionStatus('error');
      setError('Error de conexión con el servidor');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ojs/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ojs/submissions');
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncArticles = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/ojs/sync', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        setLastSync(new Date());
        // Refresh submissions after sync
        await fetchSubmissions();
      } else {
        setError(data.error || 'Error al sincronizar');
      }
    } catch (err) {
      setError('Error de conexión durante la sincronización');
    } finally {
      setSyncing(false);
    }
  };

  const importSubmission = (submission: OJSSubmission) => {
    addArticle({
      title: submission.title,
      authors: submission.authors.map((author, index) => ({
        id: `ojs-${submission.id}-${index}`,
        name: `${author.givenName} ${author.familyName}`,
        email: author.email
      })),
      keywords: [],
      stage: 'recepcion',
      priority: 'media',
      ojsId: submission.id.toString()
    });
  };

  useEffect(() => {
    checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    }
  };

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'error':
        return 'Error';
      default:
        return 'Desconectado';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Open Journal Systems (OJS)</CardTitle>
                <CardDescription>Integración con sistema de gestión editorial</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`text-sm font-medium ${
                  connectionStatus === 'connected' ? 'text-green-600' :
                  connectionStatus === 'error' ? 'text-red-600' :
                  connectionStatus === 'connecting' ? 'text-blue-600' :
                  'text-amber-600'
                }`}>
                  {getStatusLabel()}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkConnection}
                disabled={connectionStatus === 'connecting'}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                Reconectar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/ojs">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        {error && (
          <CardContent>
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stats */}
      {connectionStatus === 'connected' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                  <p className="text-xs text-gray-500">Total Envíos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.underReview}</p>
                  <p className="text-xs text-gray-500">En Revisión</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.accepted}</p>
                  <p className="text-xs text-gray-500">Aceptados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-gray-500">Rechazados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.published}</p>
                  <p className="text-xs text-gray-500">Publicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submissions List */}
      {connectionStatus === 'connected' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Artículos en OJS</CardTitle>
                <CardDescription>
                  {lastSync
                    ? `Última sincronización: ${format(lastSync, "d MMM yyyy, HH:mm", { locale: es })}`
                    : 'No sincronizado'
                  }
                </CardDescription>
              </div>
              <Button onClick={syncArticles} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Sincronizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">{submission.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            ID: {submission.id}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            {submission.authors.map(a => `${a.givenName} ${a.familyName}`).join(', ')}
                          </span>
                          <span>
                            {format(new Date(submission.dateSubmitted), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge>{submission.status}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => importSubmission(submission)}
                        >
                          Importar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <FileText className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay envíos disponibles</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Demo Mode Notice */}
      {connectionStatus !== 'connected' && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900">Modo Demo</h4>
                <p className="text-sm text-amber-700 mt-1">
                  La integración con OJS no está configurada. Para conectar con su instalación de OJS:
                </p>
                <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
                  <li>Configure las variables de entorno OJS_BASE_URL, OJS_API_KEY y OJS_JOURNAL_PATH</li>
                  <li>Asegúrese de que la API REST de OJS esté habilitada</li>
                  <li>Genere un token de API desde la configuración de OJS</li>
                </ol>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <a href="/settings/ojs">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Integración
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
