import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/supabase';

export async function POST(request: Request) {
  try {
    let PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || "";
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        PAGE_ACCESS_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).accessToken || PAGE_ACCESS_TOKEN;
      } catch(e){}
    }

    const body = await request.json();
    const { recipientId, text, adminName } = body;

    if (!recipientId || !text) {
      return new NextResponse('Missing recipientId or text', { status: 400 });
    }

    // 1. ส่งข้อความกลับไปหาลูกค้าผ่าน Facebook Graph API
    let fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text },
      }),
    });

    let fbData = await fbResponse.json();

    if (fbData.error) {
      console.error('FB API Error:', fbData.error);
      return new NextResponse(JSON.stringify({ error: fbData.error.message }), { status: 500 });
    }

    const newMsgId = Date.now();
    const newMsgObj = {
      id: newMsgId,
      mid: fbData.message_id || `mid_${newMsgId}`,
      text: text,
      image_url: "",
      time: new Date().toLocaleTimeString('th-TH'),
      is_customer: false,
      timestamp: newMsgId,
      sender_id: 'ME',
      sender_name: 'เจ้าหน้าที่ร้าน',
      sender_avatar: "",
      recipient_id: recipientId,
      replied_by: adminName || 'เจ้าหน้าที่ร้าน'
    };

    // 2. ถ้ามี Supabase ให้บันทึกลง Database (Vercel)
    if (supabase) {
      try {
        await supabase.from('messages').insert([newMsgObj]);
      } catch (sErr) {
        console.error('Supabase reply insert error:', sErr);
      }
    }

    // 3. ถ้ามี Local filesystem ให้เขียนไฟล์ด้วย
    try {
      const filePath = path.join(process.cwd(), 'data', 'messages.json');
      let msgs: any[] = [];
      if (fs.existsSync(filePath)) {
        msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
      msgs.push({
        id: newMsgId,
        senderId: 'ME',
        repliedBy: adminName || 'ไม่ระบุตัวตน',
        recipientId: recipientId,
        text: text,
        time: newMsgObj.time,
        isCustomer: false,
        timestamp: newMsgId
      });
      fs.writeFileSync(filePath, JSON.stringify(msgs));
    } catch (fErr) {}

    return new NextResponse(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Reply API Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
