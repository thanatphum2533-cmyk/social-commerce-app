import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'users.json');

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!fs.existsSync(filePath)) {
      // Create default
      const defaultUsers = {
        "admin": {
          id: "admin",
          username: "admin",
          password: "password", 
          name: "ผู้ดูแลระบบ",
          role: "admin",
          avatar: "https://i.pravatar.cc/150?img=11",
          createdAt: new Date().toISOString()
        }
      };
      fs.writeFileSync(filePath, JSON.stringify(defaultUsers, null, 2));
    }

    const users = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Find user by username
    const user = Object.values(users).find((u: any) => u.username === username && u.password === password) as any;
    
    if (user) {
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ success: true, user: userWithoutPassword });
    } else {
      return NextResponse.json({ success: false, error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
