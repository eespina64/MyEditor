import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Article, Stage, Priority, User, Comment, HistoryEntry } from '@/types';

interface ArticleState {
  articles: Article[];
  currentUser: User | null;
  searchQuery: string;
  filterPriority: Priority | 'all';
  filterStage: Stage | 'all';

  // Actions
  setCurrentUser: (user: User | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterPriority: (priority: Priority | 'all') => void;
  setFilterStage: (stage: Stage | 'all') => void;

  addArticle: (article: Omit<Article, 'id' | 'submittedAt' | 'updatedAt' | 'history'>) => void;
  updateArticle: (id: string, updates: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  moveArticle: (id: string, toStage: Stage) => void;

  addComment: (articleId: string, content: string) => void;

  getFilteredArticles: () => Article[];
  getArticlesByStage: (stage: Stage) => Article[];
  getArticleById: (id: string) => Article | undefined;
}

// Demo data
const demoArticles: Article[] = [
  {
    id: '1',
    title: 'Impacto de la Inteligencia Artificial en la Educación Superior Latinoamericana',
    abstract: 'Este estudio analiza cómo las herramientas de IA están transformando los métodos de enseñanza...',
    authors: [
      { id: 'a1', name: 'Dr. María García', email: 'mgarcia@universidad.edu' },
      { id: 'a2', name: 'Prof. Juan López', email: 'jlopez@universidad.edu' }
    ],
    keywords: ['inteligencia artificial', 'educación', 'tecnología'],
    stage: 'recepcion',
    priority: 'alta',
    submittedAt: new Date('2026-03-18'),
    updatedAt: new Date('2026-03-18'),
    history: []
  },
  {
    id: '2',
    title: 'Cambio Climático y Biodiversidad Marina en el Caribe',
    abstract: 'Investigación sobre los efectos del cambio climático en los ecosistemas marinos...',
    authors: [
      { id: 'a3', name: 'Dra. Ana Martínez', email: 'amartinez@oceano.org' }
    ],
    keywords: ['cambio climático', 'biodiversidad', 'caribe'],
    stage: 'evaluacion_inicial',
    priority: 'media',
    submittedAt: new Date('2026-03-15'),
    updatedAt: new Date('2026-03-16'),
    history: []
  },
  {
    id: '3',
    title: 'Nuevas Terapias para el Tratamiento del Alzheimer',
    abstract: 'Revisión sistemática de los avances recientes en el tratamiento del Alzheimer...',
    authors: [
      { id: 'a4', name: 'Dr. Roberto Sánchez', email: 'rsanchez@hospital.edu' },
      { id: 'a5', name: 'Dra. Elena Ruiz', email: 'eruiz@hospital.edu' }
    ],
    keywords: ['alzheimer', 'neurología', 'terapias'],
    stage: 'revision_pares',
    priority: 'urgente',
    submittedAt: new Date('2026-03-11'),
    updatedAt: new Date('2026-03-14'),
    history: []
  },
  {
    id: '4',
    title: 'Derecho Tributario y Economía Digital en América Latina',
    abstract: 'Análisis comparativo de las regulaciones tributarias para empresas digitales...',
    authors: [
      { id: 'a6', name: 'Abg. Miguel Fernández', email: 'mfernandez@derecho.edu' }
    ],
    keywords: ['derecho', 'tributario', 'economía digital'],
    stage: 'recepcion',
    priority: 'media',
    submittedAt: new Date('2026-03-20'),
    updatedAt: new Date('2026-03-20'),
    history: []
  },
  {
    id: '5',
    title: 'Reformas al Código de Trabajo: Perspectivas Comparadas',
    abstract: 'Estudio sobre las reformas laborales en diferentes países de la región...',
    authors: [
      { id: 'a7', name: 'Dr. José Hernández', email: 'jhernandez@laboral.org' }
    ],
    keywords: ['derecho laboral', 'reformas', 'legislación'],
    stage: 'evaluacion_inicial',
    priority: 'urgente',
    submittedAt: new Date('2026-03-19'),
    updatedAt: new Date('2026-03-19'),
    history: []
  },
  {
    id: '6',
    title: 'Marketing Digital y Comportamiento del Consumidor',
    abstract: 'Investigación sobre patrones de comportamiento del consumidor en plataformas digitales...',
    authors: [
      { id: 'a8', name: 'Lcda. Carmen Rojas', email: 'crojas@marketing.edu' }
    ],
    keywords: ['marketing', 'digital', 'consumidor'],
    stage: 'revision_pares',
    priority: 'alta',
    submittedAt: new Date('2026-03-05'),
    updatedAt: new Date('2026-03-10'),
    history: []
  },
  {
    id: '7',
    title: 'Arquitectura Sostenible en Zonas Urbanas Tropicales',
    abstract: 'Propuestas de diseño arquitectónico adaptado al clima tropical...',
    authors: [
      { id: 'a9', name: 'Arq. Luis Torres', email: 'ltorres@arquitectura.edu' }
    ],
    keywords: ['arquitectura', 'sostenibilidad', 'urbanismo'],
    stage: 'revision_autor',
    priority: 'media',
    submittedAt: new Date('2026-02-28'),
    updatedAt: new Date('2026-03-15'),
    history: []
  },
  {
    id: '8',
    title: 'Finanzas Descentralizadas y Regulación Bancaria',
    abstract: 'Análisis del impacto de las DeFi en el sistema financiero tradicional...',
    authors: [
      { id: 'a10', name: 'Ec. Patricia Vega', email: 'pvega@finanzas.org' }
    ],
    keywords: ['finanzas', 'blockchain', 'regulación'],
    stage: 'edicion',
    priority: 'alta',
    submittedAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-03-18'),
    history: []
  },
  {
    id: '9',
    title: 'Psicología Organizacional en la Era Post-Pandemia',
    abstract: 'Estudio sobre los cambios en la dinámica laboral después de la pandemia...',
    authors: [
      { id: 'a11', name: 'Psic. Laura Méndez', email: 'lmendez@psicologia.edu' }
    ],
    keywords: ['psicología', 'organizacional', 'trabajo'],
    stage: 'publicacion',
    priority: 'baja',
    submittedAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-03-20'),
    history: []
  },
  {
    id: '10',
    title: 'Innovación en Energías Renovables para Comunidades Rurales',
    abstract: 'Soluciones de energía solar y eólica adaptadas a comunidades rurales...',
    authors: [
      { id: 'a12', name: 'Ing. Carlos Delgado', email: 'cdelgado@energia.org' }
    ],
    keywords: ['energía', 'renovables', 'rural'],
    stage: 'revision_pares',
    priority: 'media',
    submittedAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-12'),
    history: []
  }
];

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      articles: demoArticles,
      currentUser: null,
      searchQuery: '',
      filterPriority: 'all',
      filterStage: 'all',

      setCurrentUser: (user) => set({ currentUser: user }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilterPriority: (priority) => set({ filterPriority: priority }),
      setFilterStage: (stage) => set({ filterStage: stage }),

      addArticle: (articleData) => {
        const newArticle: Article = {
          ...articleData,
          id: Math.random().toString(36).substring(2, 9),
          submittedAt: new Date(),
          updatedAt: new Date(),
          history: [{
            id: Math.random().toString(36).substring(2, 9),
            articleId: '',
            action: 'Artículo creado',
            toStage: articleData.stage,
            userId: get().currentUser?.id || 'system',
            userName: get().currentUser?.name || 'Sistema',
            timestamp: new Date()
          }]
        };
        set((state) => ({
          articles: [...state.articles, newArticle]
        }));
      },

      updateArticle: (id, updates) => {
        set((state) => ({
          articles: state.articles.map((article) =>
            article.id === id
              ? { ...article, ...updates, updatedAt: new Date() }
              : article
          )
        }));
      },

      deleteArticle: (id) => {
        set((state) => ({
          articles: state.articles.filter((article) => article.id !== id)
        }));
      },

      moveArticle: (id, toStage) => {
        const article = get().articles.find((a) => a.id === id);
        if (!article) return;

        const historyEntry: HistoryEntry = {
          id: Math.random().toString(36).substring(2, 9),
          articleId: id,
          action: 'Cambio de etapa',
          fromStage: article.stage,
          toStage,
          userId: get().currentUser?.id || 'system',
          userName: get().currentUser?.name || 'Sistema',
          timestamp: new Date()
        };

        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id
              ? {
                  ...a,
                  stage: toStage,
                  updatedAt: new Date(),
                  history: [...(a.history || []), historyEntry]
                }
              : a
          )
        }));
      },

      addComment: (articleId, content) => {
        const user = get().currentUser;
        if (!user) return;

        const comment: Comment = {
          id: Math.random().toString(36).substring(2, 9),
          articleId,
          authorId: user.id,
          authorName: user.name,
          content,
          createdAt: new Date()
        };

        set((state) => ({
          articles: state.articles.map((article) =>
            article.id === articleId
              ? {
                  ...article,
                  comments: [...(article.comments || []), comment],
                  updatedAt: new Date()
                }
              : article
          )
        }));
      },

      getFilteredArticles: () => {
        const { articles, searchQuery, filterPriority, filterStage } = get();

        return articles.filter((article) => {
          const matchesSearch =
            searchQuery === '' ||
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.authors.some((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            article.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

          const matchesPriority = filterPriority === 'all' || article.priority === filterPriority;
          const matchesStage = filterStage === 'all' || article.stage === filterStage;

          return matchesSearch && matchesPriority && matchesStage;
        });
      },

      getArticlesByStage: (stage) => {
        return get().getFilteredArticles().filter((article) => article.stage === stage);
      },

      getArticleById: (id) => {
        return get().articles.find((article) => article.id === id);
      }
    }),
    {
      name: 'editorial-workflow-storage',
      partialize: (state) => ({
        articles: state.articles,
        currentUser: state.currentUser
      })
    }
  )
);
