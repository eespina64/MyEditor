/**
 * Supabase Client Configuration
 * Provides authentication and database access
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Profile type
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'reviewer' | 'author';
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if credentials are available
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Using local storage mode.');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

// Auth helper functions
export async function signUp(email: string, password: string, name: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) throw error;

  // Create profile
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      email: data.user.email!,
      name,
      role: 'author',
    });
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// Password reset
export async function resetPassword(email: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
  });

  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}
