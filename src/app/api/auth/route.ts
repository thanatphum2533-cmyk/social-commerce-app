import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'auth.json');

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
    const user = users[username];

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้ หรือ รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ success: true, user: userWithoutPassword });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
  }
}
