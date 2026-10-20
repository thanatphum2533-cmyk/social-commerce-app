import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'config.json');

// ค่าเริ่มต้น
const DEFAULT_CONFIG = {
  pageId: "101501528874058",
  pageName: "อริสา จิวเวลรี่ สร้อยเงินแท้ 92.5%",
  accessToken: "EAAPADIvJrcYBShnuqW4G1qFEoHbNiwb6MC0jrvSVr8DxvOZCLuKZBgKihKF7RSmzGJHCwKD6zZCE6jk9cId7v8CVq3C9Syl8CCJ3QZCjdK56WbNfgjGje5Nrd3rvIC9yS6ZBzc9XG7lDiHPefBrAjp1UN8hk3CSsvmegMFCA4e6auxeVUhgO7qZAWZB95K4RCQzypQwLfZBZC",
  verifyToken: "my_custom_secret_token_12345",
  shopName: "อริสา จิวเวลรี่ (Arisa Jewelry)",
  shopAddress: "123/45 ถนนเจริญนคร แขวงคลองต้นไทร\nเขตคลองสาน กรุงเทพมหานคร 10600",
  shopPhone: "081-234-5678"
};

export async function GET() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return NextResponse.json(DEFAULT_CONFIG);
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const newConfig = await request.json();
    
    let db: any = DEFAULT_CONFIG;
    if (fs.existsSync(filePath)) {
      db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    
    db = { ...db, ...newConfig };
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
    
    return NextResponse.json({ success: true, config: db });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
