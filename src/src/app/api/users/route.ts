import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'users.json');

const initDB = () => {
  if (!fs.existsSync(filePath)) {
    // Default admin
    const defaultUsers = {
      "admin": {
        id: "admin",
        username: "admin",
        password: "password", // default password
        name: "ผู้ดูแลระบบ",
        role: "admin",
        avatar: "https://i.pravatar.cc/150?img=11",
        createdAt: new Date().toISOString()
      }
    };
    fs.writeFileSync(filePath, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

export async function GET() {
  const users = initDB();
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  try {
    const { action, username, password, name, role, id } = await request.json();
    let users = initDB();

    if (action === 'CREATE') {
      if (users[username]) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' }, { status: 400 });
      }
      users[username] = {
        id: username,
        username,
        password,
        name: name || username,
        role: role || 'staff',
        avatar: `https://i.pravatar.cc/150?u=${username}`,
        createdAt: new Date().toISOString()
      };
    } else if (action === 'DELETE') {
      if (id === 'admin') {
        return NextResponse.json({ error: 'ไม่สามารถลบแอดมินหลักได้' }, { status: 400 });
      }
      delete users[id];
    } else if (action === 'UPDATE') {
        if(users[id]){
            if(password) users[id].password = password;
            if(name) users[id].name = name;
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process user action' }, { status: 500 });
  }
}
