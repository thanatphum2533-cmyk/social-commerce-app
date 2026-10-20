import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    let PAGE_ACCESS_TOKEN = "";
    if (fs.existsSync(configPath)) {
      PAGE_ACCESS_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).accessToken;
    }
    const body = await request.json();
    const { recipientId, text, adminName } = body;

    if (!recipientId || !text) {
      return new NextResponse('Missing recipientId or text', { status: 400 });
    }
    // ข้ามการทำ Take Thread Control ไปเลย เพราะเพจที่ไม่ได้เปิดโหมด 2 แอปจะใช้คำสั่งนี้ไม่ได้
    // (มันจะฟ้อง Error 27)

    // 2. ส่งข้อความกลับไปหาลูกค้าผ่าน Facebook Graph API
    const fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text },
      }),
    });

    const fbData = await fbResponse.json();

    if (fbData.error) {
      console.error('FB API Error:', fbData.error);
      return new NextResponse(JSON.stringify({ error: fbData.error.message }), { status: 500 });
    }

    // 2. บันทึกข้อความลงในไฟล์ messages.json เพื่อให้หน้าเว็บแสดงผลด้วย
    const filePath = path.join(process.cwd(), 'data', 'messages.json');
    let msgs: any[] = [];
    if (fs.existsSync(filePath)) {
      msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    msgs.push({
      id: Date.now(),
      senderId: 'ME', // บ่งบอกว่าเป็นแอดมินตอบ
      repliedBy: adminName || 'ไม่ระบุตัวตน', // <--- เพิ่มตรงนี้! บันทึกชื่อแอดมิน
      recipientId: recipientId,
      text: text,
      time: new Date().toLocaleTimeString('th-TH'),
      isCustomer: false // false = เป็นฝั่งร้านค้า
    });

    fs.writeFileSync(filePath, JSON.stringify(msgs));

    return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Reply API Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
