'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, User, Tag, ArrowRight, History, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Article, Stage } from '@/types';
import { PRIORITIES, STAGES } from '@/types';
import { useArticleStore } from '@/store/articleStore';

interface ArticleDialogProps {
  article: Article | null;
  open: boolean;
  onClose: () => void;
}

const stageOrder: Stage[] = ['recepcion', 'evaluacion_inicial', 'revision_pares', 'revision_autor', 'edicion', 'publicacion'];

export function ArticleDialog({ article, open, onClose }: ArticleDialogProps) {
  const { moveArticle } = useArticleStore();

  if (!article) return null;

  const priorityConfig = PRIORITIES[article.priority];
  const stageConfig = STAGES[article.stage];
  const currentStageIndex = stageOrder.indexOf(article.stage);

  const handleMoveToStage = (stage: Stage) => {
    moveArticle(article.id, stage);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start gap-2 mb-2">
            <Badge className={priorityConfig.color}>{priorityConfig.name}</Badge>
            <Badge variant="outline" className="bg-white">
              {stageConfig.name}
            </Badge>
          </div>
          <DialogTitle className="text-xl leading-tight">{article.title}</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {article.ojsId && <span className="mr-2">OJS ID: {article.ojsId}</span>}
            Enviado el {format(new Date(article.submittedAt), "d 'de' MMMM, yyyy", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              Historial ({article.history?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1" />
              Comentarios ({article.comments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4">
            <TabsContent value="details" className="space-y-4 m-0">
              {/* Authors */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <User className="h-4 w-4" /> Autores
                </h4>
                <div className="space-y-2">
                  {article.authors.map((author) => (
                    <div key={author.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div>
                        <p className="font-medium text-sm">{author.name}</p>
                        <p className="text-xs text-gray-500">{author.email}</p>
                      </div>
                      {author.institution && (
                        <span className="text-xs text-gray-400">{author.institution}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Abstract */}
              {article.abstract && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Resumen</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{article.abstract}</p>
                </div>
              )}

              {/* Keywords */}
              {article.keywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Tag className="h-4 w-4" /> Palabras clave
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {article.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Move to Stage */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-3">Mover a otra etapa</h4>
                <div className="flex flex-wrap gap-2">
                  {stageOrder.map((stage, index) => (
                    <Button
                      key={stage}
                      variant={stage === article.stage ? 'default' : 'outline'}
                      size="sm"
                      disabled={stage === article.stage}
                      onClick={() => handleMoveToStage(stage)}
                      className="text-xs"
                    >
                      {index > currentStageIndex && <ArrowRight className="h-3 w-3 mr-1" />}
                      {STAGES[stage].name}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-2 m-0">
              {article.history && article.history.length > 0 ? (
                article.history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.fromStage && entry.toStage && (
                        <p className="text-xs text-gray-500">
                          {STAGES[entry.fromStage].name} → {STAGES[entry.toStage].name}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {entry.userName} • {format(new Date(entry.timestamp), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin historial de cambios</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="space-y-2 m-0">
              {article.comments && article.comments.length > 0 ? (
                article.comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{comment.authorName}</span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(comment.createdAt), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin comentarios</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
