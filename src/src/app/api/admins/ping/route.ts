import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'ping.json');

export async function GET() {
  let db: Record<string, number> = {};
  if (fs.existsSync(filePath)) {
    try {
      db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch(e){}
  }
  
  // กรองเฉพาะคนที่ ping ล่าสุดไม่เกิน 15 วินาที
  const now = Date.now();
  const onlineAdmins = Object.keys(db).filter(name => now - db[name] < 15000);
  
  return NextResponse.json({ online: onlineAdmins });
}

export async function POST(request: Request) {
  try {
    const { adminName } = await request.json();
    let db: Record<string, number> = {};
    if (fs.existsSync(filePath)) {
      try {
        db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch(e){}
    }
    
    db[adminName] = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(db));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
