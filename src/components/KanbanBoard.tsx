'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ArticleCard } from './ArticleCard';
import { ArticleDialog } from './ArticleDialog';
import type { Article, Stage, Priority } from '@/types';
import { STAGES, PRIORITIES } from '@/types';
import { useArticleStore } from '@/store/articleStore';

const stageOrder: Stage[] = ['recepcion', 'evaluacion_inicial', 'revision_pares', 'revision_autor', 'edicion', 'publicacion'];

export function KanbanBoard() {
  const {
    searchQuery,
    setSearchQuery,
    filterPriority,
    setFilterPriority,
    filterStage,
    setFilterStage,
    getArticlesByStage,
    getFilteredArticles
  } = useArticleStore();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const totalArticles = getFilteredArticles().length;
  const hasFilters = searchQuery !== '' || filterPriority !== 'all' || filterStage !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterPriority('all');
    setFilterStage('all');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por título, autor o palabra clave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-blue-50' : ''}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtros
            {hasFilters && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                Activos
              </Badge>
            )}
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Prioridad</label>
            <Select
              value={filterPriority}
              onValueChange={(value) => setFilterPriority(value as Priority | 'all')}
            >
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITIES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Etapa</label>
            <Select
              value={filterStage}
              onValueChange={(value) => setFilterStage(value as Stage | 'all')}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(STAGES).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {stageOrder.map((stage) => {
            const stageConfig = STAGES[stage];
            const articles = getArticlesByStage(stage);

            return (
              <div
                key={stage}
                className={`flex-shrink-0 w-80 rounded-xl border ${stageConfig.color} p-4`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{stageConfig.name}</h3>
                      <Badge variant="secondary" className="bg-white text-gray-700">
                        {articles.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{stageConfig.description}</p>
                  </div>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onView={setSelectedArticle}
                    />
                  ))}
                  {articles.length === 0 && (
                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-400">Sin artículos</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Article Detail Dialog */}
      <ArticleDialog
        article={selectedArticle}
        open={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
