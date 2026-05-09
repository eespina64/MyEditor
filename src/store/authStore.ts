import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getSupabase,
  isSupabaseConfigured,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
  getCurrentUser,
  updateProfile
} from '@/lib/supabase';
import type { UserRole } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  mode: 'supabase' | 'demo';

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInDemo: (user: AuthUser) => void;
  clearError: () => void;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
}

// Demo users for when Supabase is not configured
export const DEMO_USERS: AuthUser[] = [
  {
    id: 'demo-1',
    name: 'Dr. María García',
    email: 'mgarcia@revista.edu',
    role: 'admin',
    avatar: undefined
  },
  {
    id: 'demo-2',
    name: 'Prof. Juan López',
    email: 'jlopez@revista.edu',
    role: 'editor',
    avatar: undefined
  },
  {
    id: 'demo-3',
    name: 'Ana Martínez',
    email: 'amartinez@universidad.edu',
    role: 'reviewer',
    avatar: undefined
  },
  {
    id: 'demo-4',
    name: 'Carlos Rodríguez',
    email: 'crodriguez@autor.com',
    role: 'author',
    avatar: undefined
  },
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      mode: isSupabaseConfigured() ? 'supabase' : 'demo',

      initialize: async () => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          // Demo mode - check for persisted user
          set({ isLoading: false, mode: 'demo' });
          return;
        }

        try {
          const user = await getCurrentUser();
          if (user) {
            set({
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar: user.avatar_url || undefined,
              },
              isAuthenticated: true,
              isLoading: false,
              mode: 'supabase',
            });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Error al inicializar autenticación'
          });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          // Demo mode - find user by email
          const demoUser = DEMO_USERS.find(u => u.email === email);
          if (demoUser) {
            set({
              user: demoUser,
              isAuthenticated: true,
              isLoading: false,
              mode: 'demo',
            });
          } else {
            set({
              error: 'Usuario no encontrado',
              isLoading: false,
            });
          }
          return;
        }

        try {
          const { user } = await supabaseSignIn(email, password);
          if (user) {
            const profile = await getCurrentUser();
            if (profile) {
              set({
                user: {
                  id: profile.id,
                  email: profile.email,
                  name: profile.name,
                  role: profile.role,
                  avatar: profile.avatar_url || undefined,
                },
                isAuthenticated: true,
                isLoading: false,
              });
            }
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Error de autenticación',
            isLoading: false,
          });
        }
      },

      signUp: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });

        if (!isSupabaseConfigured()) {
          set({
            error: 'Registro no disponible en modo demo',
            isLoading: false,
          });
          return;
        }

        try {
          await supabaseSignUp(email, password, name);
          set({
            isLoading: false,
            error: null,
          });
          // User needs to verify email
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Error de registro',
            isLoading: false,
          });
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null });

        if (get().mode === 'supabase') {
          try {
            await supabaseSignOut();
          } catch (error) {
            console.error('Sign out error:', error);
          }
        }

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      signInDemo: (user: AuthUser) => {
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          mode: 'demo',
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      updateUser: async (updates: Partial<AuthUser>) => {
        const currentUser = get().user;
        if (!currentUser) return;

        if (get().mode === 'supabase') {
          try {
            await updateProfile(currentUser.id, {
              name: updates.name,
              role: updates.role,
              avatar_url: updates.avatar,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Error al actualizar perfil',
            });
            return;
          }
        }

        set({
          user: { ...currentUser, ...updates },
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        mode: state.mode,
      }),
    }
  )
);

// Role-based access control helpers
export function hasRole(user: AuthUser | null, roles: UserRole | UserRole[]): boolean {
  if (!user) return false;
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(user.role);
}

export function canEditArticle(user: AuthUser | null, articleAuthorId?: string): boolean {
  if (!user) return false;
  if (hasRole(user, ['admin', 'editor'])) return true;
  if (user.role === 'author' && articleAuthorId === user.id) return true;
  return false;
}

export function canReviewArticle(user: AuthUser | null): boolean {
  return hasRole(user, ['admin', 'editor', 'reviewer']);
}

export function canManageUsers(user: AuthUser | null): boolean {
  return hasRole(user, 'admin');
}

export function canPublishArticle(user: AuthUser | null): boolean {
  return hasRole(user, ['admin', 'editor']);
}
