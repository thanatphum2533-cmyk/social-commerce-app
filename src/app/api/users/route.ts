import { NextResponse } from 'next/server';
import { getUsers, saveUsers } from '@/app/lib/usersStore';
import { supabase } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const users = await getUsers();
  return NextResponse.json(users, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(request: Request) {
  try {
    const { action, username, password, name, role, id } = await request.json();
    const users = { ...(await getUsers()) };

    if (action === 'CREATE') {
      if (users[username]) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' }, { status: 400 });
      }
      const newUserObj = {
        id: username,
        username,
        password,
        name: name || username,
        role: role || 'staff',
        avatar: `https://i.pravatar.cc/150?u=${username}`,
        createdAt: new Date().toISOString(),
      };
      users[username] = newUserObj;

      if (supabase) {
        try {
          await supabase.from('users').upsert([
            {
              id: newUserObj.id,
              username: newUserObj.username,
              password: newUserObj.password,
              name: newUserObj.name,
              role: newUserObj.role,
              avatar: newUserObj.avatar,
              created_at: newUserObj.createdAt,
            },
          ]);
        } catch {
          // Ignore if table doesn't exist
        }
      }
    } else if (action === 'DELETE') {
      if (id === 'admin') {
        return NextResponse.json({ error: 'ไม่สามารถลบแอดมินหลักได้' }, { status: 400 });
      }
      delete users[id];
      for (const key of Object.keys(users)) {
        if (users[key]?.id === id || users[key]?.username === id) {
          delete users[key];
        }
      }

      if (supabase && id) {
        try {
          await supabase.from('users').delete().or(`id.eq.${id},username.eq.${id}`);
        } catch {
          // Ignore if table doesn't exist
        }
      }
    } else if (action === 'UPDATE') {
      const targetKey = Object.keys(users).find(
        (k) => k === id || users[k]?.id === id || users[k]?.username === id
      );
      if (targetKey && users[targetKey]) {
        if (password) users[targetKey].password = password;
        if (name) users[targetKey].name = name;

        if (supabase) {
          try {
            await supabase
              .from('users')
              .update({
                ...(password ? { password } : {}),
                ...(name ? { name } : {}),
              })
              .eq('id', users[targetKey].id);
          } catch {
            // Ignore if table doesn't exist
          }
        }
      }
    }

    await saveUsers(users);
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process user action' },
      { status: 500 }
    );
  }
}
