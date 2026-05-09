-- Editorial Workflow Database Schema
-- Supabase Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('admin', 'editor', 'reviewer', 'author')),
  avatar_url TEXT,
  institution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Articles table
CREATE TABLE public.articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT,
  keywords TEXT[] DEFAULT '{}',
  stage TEXT NOT NULL DEFAULT 'recepcion' CHECK (stage IN ('recepcion', 'evaluacion_inicial', 'revision_pares', 'revision_autor', 'edicion', 'publicacion')),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('urgente', 'alta', 'media', 'baja')),
  ojs_id TEXT,
  assigned_editor UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Article authors table
CREATE TABLE public.article_authors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  institution TEXT,
  author_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Article history table
CREATE TABLE public.article_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  user_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Article comments table
CREATE TABLE public.article_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Article reviewers table
CREATE TABLE public.article_reviewers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES public.profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recommendation TEXT CHECK (recommendation IN ('accept', 'minor_revision', 'major_revision', 'reject')),
  comments TEXT
);

-- Indexes
CREATE INDEX idx_articles_stage ON public.articles(stage);
CREATE INDEX idx_articles_priority ON public.articles(priority);
CREATE INDEX idx_articles_ojs_id ON public.articles(ojs_id);
CREATE INDEX idx_articles_created_by ON public.articles(created_by);
CREATE INDEX idx_article_authors_article ON public.article_authors(article_id);
CREATE INDEX idx_article_history_article ON public.article_history(article_id);
CREATE INDEX idx_article_comments_article ON public.article_comments(article_id);
CREATE INDEX idx_article_reviewers_article ON public.article_reviewers(article_id);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reviewers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Articles policies
CREATE POLICY "Articles are viewable by authenticated users" ON public.articles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Editors and admins can insert articles" ON public.articles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor', 'author')
    )
  );

CREATE POLICY "Editors and admins can update articles" ON public.articles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
    OR created_by = auth.uid()
  );

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'author'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
