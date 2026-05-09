'use client';

import { useState } from 'react';
import { Plus, X, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Priority, Stage } from '@/types';
import { PRIORITIES, STAGES } from '@/types';
import { useArticleStore } from '@/store/articleStore';

interface Author {
  id: string;
  name: string;
  email: string;
  institution?: string;
}

export function AddArticleDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [authors, setAuthors] = useState<Author[]>([{ id: '1', name: '', email: '' }]);
  const [keywords, setKeywords] = useState('');
  const [priority, setPriority] = useState<Priority>('media');
  const [stage, setStage] = useState<Stage>('recepcion');

  const { addArticle } = useArticleStore();

  const handleAddAuthor = () => {
    setAuthors([...authors, { id: Date.now().toString(), name: '', email: '' }]);
  };

  const handleRemoveAuthor = (id: string) => {
    if (authors.length > 1) {
      setAuthors(authors.filter(a => a.id !== id));
    }
  };

  const handleAuthorChange = (id: string, field: keyof Author, value: string) => {
    setAuthors(authors.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || authors.some(a => !a.name.trim())) {
      return;
    }

    addArticle({
      title: title.trim(),
      abstract: abstract.trim(),
      authors: authors.filter(a => a.name.trim()),
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      priority,
      stage
    });

    // Reset form
    setTitle('');
    setAbstract('');
    setAuthors([{ id: '1', name: '', email: '' }]);
    setKeywords('');
    setPriority('media');
    setStage('recepcion');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          Añadir Artículo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Artículo</DialogTitle>
          <DialogDescription>
            Complete la información del artículo para agregarlo al sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del artículo"
              required
            />
          </div>

          {/* Abstract */}
          <div className="space-y-2">
            <Label htmlFor="abstract">Resumen</Label>
            <Textarea
              id="abstract"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Resumen del artículo"
              rows={4}
            />
          </div>

          {/* Authors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Autores *</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddAuthor}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir autor
              </Button>
            </div>
            {authors.map((author, index) => (
              <div key={author.id} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre completo"
                      value={author.name}
                      onChange={(e) => handleAuthorChange(author.id, 'name', e.target.value)}
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={author.email}
                      onChange={(e) => handleAuthorChange(author.id, 'email', e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Institución (opcional)"
                    value={author.institution || ''}
                    onChange={(e) => handleAuthorChange(author.id, 'institution', e.target.value)}
                  />
                </div>
                {authors.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAuthor(author.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Palabras clave</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Separadas por comas"
            />
            {keywords && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.split(',').map((k, i) => k.trim() && (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {k.trim()}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Priority and Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${config.color.split(' ')[0]}`} />
                        {config.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Etapa inicial</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              Añadir Artículo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
