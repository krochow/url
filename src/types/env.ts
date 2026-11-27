export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
}

export interface Link {
  id: number;
  user_id: string | null;
  slug: string;
  target_url: string;
  title: string | null;
  clicks: number;
  created_at: string;
}

export interface CreateLinkInput {
  target_url: string;
  slug?: string;
  title?: string;
}

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_URL?: string;
}

export interface AppVariables {
  user: User | null;
}
