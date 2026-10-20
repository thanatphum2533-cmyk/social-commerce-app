import { NextResponse } from 'next/server';
import { getUsers } from '@/app/lib/usersStore';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const users = await getUsers();

    // Find user by username
    const user = Object.values(users).find(
      (u: any) => u.username === username && u.password === password
    ) as any;

    if (user) {
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ success: true, user: userWithoutPassword });
    } else {
      return NextResponse.json(
        { success: false, error: 'Username หรือ Password ไม่ถูกต้อง' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
