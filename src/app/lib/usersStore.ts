import fs from 'fs';
import path from 'path';
import { supabase } from './supabase';

const filePath = path.join(process.cwd(), 'data', 'users.json');

const DEFAULT_USERS: Record<string, any> = {
  admin: {
    id: 'admin',
    username: 'admin',
    password: 'admin999',
    name: 'ผู้ดูแลระบบ',
    role: 'admin',
    avatar: 'https://i.pravatar.cc/150?img=11',
    createdAt: '2026-10-08T07:28:45.014Z',
  },
};

declare global {
  // eslint-disable-next-line no-var
  var __systemUsersCache: Record<string, any> | undefined;
}

export async function getUsers(): Promise<Record<string, any>> {
  // 1. Try Supabase if available and 'users' table exists
  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const map: Record<string, any> = {};
        for (const u of data) {
          const key = u.id || u.username;
          map[key] = {
            id: key,
            username: u.username || key,
            password: u.password,
            name: u.name || u.username || key,
            role: u.role || 'staff',
            avatar: u.avatar || `https://i.pravatar.cc/150?u=${key}`,
            createdAt: u.created_at || u.createdAt || new Date().toISOString(),
          };
        }
        globalThis.__systemUsersCache = map;
        return map;
      }
    } catch {
      // Fallback if table doesn't exist
    }
  }

  // 2. If in-memory cache exists (for Vercel serverless runtime), use it
  if (globalThis.__systemUsersCache) {
    return globalThis.__systemUsersCache;
  }

  // 3. Read from local file
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      globalThis.__systemUsersCache = parsed;
      return parsed;
    }
  } catch {
    // Ignore read error
  }

  globalThis.__systemUsersCache = { ...DEFAULT_USERS };
  try {
    fs.writeFileSync(filePath, JSON.stringify(globalThis.__systemUsersCache, null, 2));
  } catch {
    // Read-only filesystem on Vercel is normal
  }
  return globalThis.__systemUsersCache;
}

export async function saveUsers(users: Record<string, any>): Promise<void> {
  globalThis.__systemUsersCache = { ...users };

  try {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
  } catch {
    // Ignore EROFS on Vercel read-only filesystem
  }
}
