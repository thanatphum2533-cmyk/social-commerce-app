import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { pageId, pageAccessToken, pageName } = await request.json();

    // ยิง API ไปบอก Facebook ว่าให้ผูก Webhook เข้ากับเพจนี้อัตโนมัติ
    const subscribeRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageAccessToken}`, {
      method: 'POST'
    });
    
    const subscribeData = await subscribeRes.json();
    
    if (subscribeData.error) {
      return NextResponse.json({ error: subscribeData.error.message }, { status: 400 });
    }

    // บันทึก Token ลง config.json ของเรา
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    let db: any = {};
    if (fs.existsSync(configPath)) {
      db = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    db.pageId = pageId;
    db.pageName = pageName;
    db.accessToken = pageAccessToken;
    
    fs.writeFileSync(configPath, JSON.stringify(db, null, 2));

    return NextResponse.json({ success: true, config: db });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
