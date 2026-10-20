import { NextResponse } from 'next/server';
import { saveConfigData } from '../config/route';

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

    // บันทึก Token ลง config
    const db = saveConfigData({
      pageId,
      pageName,
      accessToken: pageAccessToken
    });

    return NextResponse.json({ success: true, config: db });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
