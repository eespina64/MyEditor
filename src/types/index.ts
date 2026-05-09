// Article types
export type Priority = 'urgente' | 'alta' | 'media' | 'baja';
export type Stage = 'recepcion' | 'evaluacion_inicial' | 'revision_pares' | 'revision_autor' | 'edicion' | 'publicacion';

export interface Author {
  id: string;
  name: string;
  email: string;
  institution?: string;
}

export interface Article {
  id: string;
  title: string;
  abstract?: string;
  authors: Author[];
  keywords: string[];
  stage: Stage;
  priority: Priority;
  submittedAt: Date;
  updatedAt: Date;
  assignedEditor?: string;
  reviewers?: string[];
  ojsId?: string; // ID in OJS system
  comments?: Comment[];
  history?: HistoryEntry[];
}

export interface Comment {
  id: string;
  articleId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

export interface HistoryEntry {
  id: string;
  articleId: string;
  action: string;
  fromStage?: Stage;
  toStage?: Stage;
  userId: string;
  userName: string;
  timestamp: Date;
  details?: string;
}

// User types
export type UserRole = 'admin' | 'editor' | 'reviewer' | 'author';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

// OJS types
export interface OJSSubmission {
  id: number;
  title: string;
  abstract?: string;
  status: string;
  dateSubmitted: string;
  authors: OJSAuthor[];
}

export interface OJSAuthor {
  givenName: string;
  familyName: string;
  email: string;
  affiliation?: string;
}

export interface OJSStats {
  totalSubmissions: number;
  underReview: number;
  accepted: number;
  rejected: number;
  published: number;
}

// Stage configuration
export const STAGES: Record<Stage, { name: string; description: string; color: string }> = {
  recepcion: {
    name: 'Recepción',
    description: 'Artículos recién recibidos pendientes de revisión inicial',
    color: 'bg-slate-100 border-slate-200'
  },
  evaluacion_inicial: {
    name: 'Evaluación Inicial',
    description: 'Artículos en evaluación por el equipo editorial',
    color: 'bg-blue-50 border-blue-200'
  },
  revision_pares: {
    name: 'Revisión por Pares',
    description: 'Artículos asignados a revisores expertos',
    color: 'bg-amber-50 border-amber-200'
  },
  revision_autor: {
    name: 'Revisión del Autor',
    description: 'Artículos devueltos al autor para correcciones',
    color: 'bg-purple-50 border-purple-200'
  },
  edicion: {
    name: 'Edición',
    description: 'Artículos en proceso de edición final',
    color: 'bg-cyan-50 border-cyan-200'
  },
  publicacion: {
    name: 'Publicación',
    description: 'Artículos listos para publicar',
    color: 'bg-emerald-50 border-emerald-200'
  }
};

export const PRIORITIES: Record<Priority, { name: string; color: string }> = {
  urgente: { name: 'Urgente', color: 'bg-red-100 text-red-700 border-red-200' },
  alta: { name: 'Alta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  media: { name: 'Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  baja: { name: 'Baja', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};
