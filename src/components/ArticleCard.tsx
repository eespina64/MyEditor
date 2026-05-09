'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, User, Tag, MoreVertical, ArrowRight, Trash2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Article, Stage } from '@/types';
import { PRIORITIES, STAGES } from '@/types';
import { useArticleStore } from '@/store/articleStore';

interface ArticleCardProps {
  article: Article;
  onView?: (article: Article) => void;
}

const stageOrder: Stage[] = ['recepcion', 'evaluacion_inicial', 'revision_pares', 'revision_autor', 'edicion', 'publicacion'];

export function ArticleCard({ article, onView }: ArticleCardProps) {
  const { moveArticle, deleteArticle } = useArticleStore();

  const priorityConfig = PRIORITIES[article.priority];
  const currentStageIndex = stageOrder.indexOf(article.stage);
  const nextStage = currentStageIndex < stageOrder.length - 1 ? stageOrder[currentStageIndex + 1] : null;

  const handleMoveNext = () => {
    if (nextStage) {
      moveArticle(article.id, nextStage);
    }
  };

  const handleDelete = () => {
    if (confirm('¿Está seguro de eliminar este artículo?')) {
      deleteArticle(article.id);
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-transparent hover:border-l-blue-500 bg-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className={`${priorityConfig.color} text-xs font-medium px-2 py-0.5`}
          >
            {priorityConfig.name}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(article)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalles
              </DropdownMenuItem>
              {nextStage && (
                <DropdownMenuItem onClick={handleMoveNext}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Mover a {STAGES[nextStage].name}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 text-gray-900 mt-2">
          {article.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <User className="h-3.5 w-3.5 text-gray-400" />
          <span className="line-clamp-1">
            {article.authors.map(a => a.name).join(', ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span>{format(new Date(article.submittedAt), "d 'de' MMMM, yyyy", { locale: es })}</span>
        </div>
        {article.keywords.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-gray-400" />
            {article.keywords.slice(0, 3).map((keyword) => (
              <span key={keyword} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
