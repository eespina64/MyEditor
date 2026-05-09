'use client';

import { useMemo } from 'react';
import { format, subDays, startOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Clock, CheckCircle, TrendingUp, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useArticleStore } from '@/store/articleStore';
import { STAGES, PRIORITIES } from '@/types';

const STAGE_COLORS = {
  recepcion: '#64748b',
  evaluacion_inicial: '#3b82f6',
  revision_pares: '#f59e0b',
  revision_autor: '#a855f7',
  edicion: '#06b6d4',
  publicacion: '#10b981'
};

const PRIORITY_COLORS = {
  urgente: '#ef4444',
  alta: '#f97316',
  media: '#3b82f6',
  baja: '#6b7280'
};

export function Dashboard() {
  const { articles } = useArticleStore();

  // Calculate statistics
  const stats = useMemo(() => {
    const totalArticles = articles.length;
    const publishedArticles = articles.filter(a => a.stage === 'publicacion').length;
    const inReview = articles.filter(a => ['revision_pares', 'evaluacion_inicial'].includes(a.stage)).length;

    // Calculate average days in process
    const now = new Date();
    const avgDays = articles.reduce((sum, article) => {
      const days = Math.floor((now.getTime() - new Date(article.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / (totalArticles || 1);

    // This month submissions
    const thisMonth = startOfMonth(new Date());
    const thisMonthSubmissions = articles.filter(a => new Date(a.submittedAt) >= thisMonth).length;

    return {
      totalArticles,
      publishedArticles,
      inReview,
      avgDays: Math.round(avgDays),
      thisMonthSubmissions,
      acceptanceRate: totalArticles > 0 ? Math.round((publishedArticles / totalArticles) * 100) : 0
    };
  }, [articles]);

  // Stage distribution for pie chart
  const stageDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    Object.keys(STAGES).forEach(stage => {
      distribution[stage] = 0;
    });

    articles.forEach(article => {
      distribution[article.stage]++;
    });

    return Object.entries(distribution).map(([stage, count]) => ({
      name: STAGES[stage as keyof typeof STAGES].name,
      value: count,
      color: STAGE_COLORS[stage as keyof typeof STAGE_COLORS]
    }));
  }, [articles]);

  // Priority distribution
  const priorityDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    Object.keys(PRIORITIES).forEach(priority => {
      distribution[priority] = 0;
    });

    articles.forEach(article => {
      distribution[article.priority]++;
    });

    return Object.entries(distribution).map(([priority, count]) => ({
      name: PRIORITIES[priority as keyof typeof PRIORITIES].name,
      value: count,
      color: PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS]
    }));
  }, [articles]);

  // Monthly submissions trend
  const monthlyTrend = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfYear(new Date()),
      end: new Date()
    });

    return months.map(month => {
      const count = articles.filter(article => {
        const submittedDate = new Date(article.submittedAt);
        return submittedDate.getMonth() === month.getMonth() &&
               submittedDate.getFullYear() === month.getFullYear();
      }).length;

      return {
        month: format(month, 'MMM', { locale: es }),
        envíos: count
      };
    });
  }, [articles]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return articles
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [articles]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Artículos</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{stats.totalArticles}</div>
            <p className="text-xs text-blue-600 mt-1">
              +{stats.thisMonthSubmissions} este mes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">En Revisión</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">{stats.inReview}</div>
            <p className="text-xs text-amber-600 mt-1">
              Promedio {stats.avgDays} días
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Publicados</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900">{stats.publishedArticles}</div>
            <p className="text-xs text-emerald-600 mt-1">
              {stats.acceptanceRate}% tasa de aceptación
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Este Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{stats.thisMonthSubmissions}</div>
            <p className="text-xs text-purple-600 mt-1">
              Nuevos envíos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tendencia de Envíos</CardTitle>
            <CardDescription>Artículos recibidos por mes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorEnvios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="envíos"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorEnvios)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por Etapa</CardTitle>
            <CardDescription>Artículos en cada fase del proceso</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stageDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  labelLine={false}
                >
                  {stageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Priority Distribution & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribución por Prioridad</CardTitle>
            <CardDescription>Clasificación de artículos por urgencia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={12} width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actividad Reciente</CardTitle>
            <CardDescription>Últimos artículos actualizados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((article) => (
                <div key={article.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{article.title}</p>
                    <p className="text-xs text-gray-500">
                      {article.authors[0]?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant="outline" className="text-xs">
                      {STAGES[article.stage].name}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {format(new Date(article.updatedAt), 'd MMM', { locale: es })}
                    </span>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin actividad reciente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
