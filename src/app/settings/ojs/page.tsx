'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, TestTube, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function OJSSettingsPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [journalPath, setJournalPath] = useState('index');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // In production, this would test with the provided credentials
      // For demo, we simulate the test
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (baseUrl && apiKey) {
        setTestResult('success');
        setTestMessage('Conexión exitosa con OJS');
      } else {
        setTestResult('error');
        setTestMessage('Complete todos los campos requeridos');
      }
    } catch {
      setTestResult('error');
      setTestMessage('Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // In production, this would save to environment or database
    alert('En producción, estos valores se guardarían en las variables de entorno o base de datos.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al tablero
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de OJS</CardTitle>
            <CardDescription>
              Configure la conexión con su instalación de Open Journal Systems
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Requisitos de OJS</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>OJS versión 3.2 o superior</li>
                  <li>API REST habilitada en la configuración</li>
                  <li>Token de API generado desde el panel de administración</li>
                </ul>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">URL Base de OJS *</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://turevista.edu/ojs"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  URL completa de su instalación de OJS (sin barra final)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Tu API Key de OJS"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Genere una API Key desde: Configuración → Sitio Web → Plugins → API REST
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="journalPath">Path de la Revista</Label>
                <Input
                  id="journalPath"
                  placeholder="index"
                  value={journalPath}
                  onChange={(e) => setJournalPath(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Identificador de la revista (ej: "index" para la principal)
                </p>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                testResult === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {testResult === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="text-sm">{testMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Probar Conexión
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuración
              </Button>
            </div>

            {/* Environment Variables Info */}
            <div className="bg-slate-50 border rounded-lg p-4 mt-6">
              <h4 className="font-medium text-sm mb-2">Variables de Entorno</h4>
              <p className="text-xs text-slate-600 mb-3">
                También puede configurar OJS mediante variables de entorno:
              </p>
              <pre className="text-xs bg-slate-800 text-green-400 p-3 rounded overflow-x-auto">
{`OJS_BASE_URL=https://turevista.edu/ojs
OJS_API_KEY=tu-api-key-secreto
OJS_JOURNAL_PATH=index`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
