import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const filePath = path.join(process.cwd(), 'data', 'config.json');

// ค่าเริ่มต้น
const DEFAULT_CONFIG: Record<string, any> = {
  pageId: "101501528874058",
  pageName: "อริสา จิวเวลรี่ สร้อยเงินแท้ 92.5%",
  accessToken: "EAAPADIvJrcYBShnuqW4G1qFEoHbNiwb6MC0jrvSVr8DxvOZCLuKZBgKihKF7RSmzGJHCwKD6zZCE6jk9cId7v8CVq3C9Syl8CCJ3QZCjdK56WbNfgjGje5Nrd3rvIC9yS6ZBzc9XG7lDiHPefBrAjp1UN8hk3CSsvmegMFCA4e6auxeVUhgO7qZAWZB95K4RCQzypQwLfZBZC",
  verifyToken: "my_custom_secret_token_12345",
  shopName: "อริสา จิวเวลรี่ (Arisa Jewelry)",
  shopAddress: "123/45 ถนนเจริญนคร แขวงคลองต้นไทร\nเขตคลองสาน กรุงเทพมหานคร 10600",
  shopPhone: "081-234-5678",
  welcomeMessage: "สวัสดีครับ ร้านอริสา จิวเวลรี่ ยินดีให้บริการครับ 🙏 สนใจสินค้าชิ้นไหนส่งรูปมาสอบถามได้เลยนะครับ"
};

declare global {
  // eslint-disable-next-line no-var
  var __appConfigCache: Record<string, any> | undefined;
}

function loadConfig(): Record<string, any> {
  if (globalThis.__appConfigCache) {
    return globalThis.__appConfigCache;
  }
  try {
    if (fs.existsSync(filePath)) {
      const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      globalThis.__appConfigCache = { ...DEFAULT_CONFIG, ...fileData };
      return globalThis.__appConfigCache;
    }
  } catch {
    // Ignore read error
  }
  globalThis.__appConfigCache = { ...DEFAULT_CONFIG };
  try {
    fs.writeFileSync(filePath, JSON.stringify(globalThis.__appConfigCache, null, 2));
  } catch {
    // Ignore EROFS on Vercel
  }
  return globalThis.__appConfigCache;
}

export async function GET() {
  const config = loadConfig();
  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

export async function POST(request: Request) {
  try {
    const newConfig = await request.json();
    const current = loadConfig();
    const updated = { ...current, ...newConfig };
    globalThis.__appConfigCache = updated;

    try {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    } catch {
      // On Vercel, filesystem is read-only; in-memory cache keeps it updated
    }

    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
