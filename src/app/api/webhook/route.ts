import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ตัวแปรเก็บแชทชั่วคราว (เก็บใน Memory ของเซิร์ฟเวอร์)
export const globalMessages: any[] = [];

export async function GET(request: Request) {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  let VERIFY_TOKEN = 'my_custom_secret_token_12345';
  if (fs.existsSync(configPath)) {
    VERIFY_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).verifyToken || VERIFY_TOKEN;
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(request: Request) {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  let PAGE_ACCESS_TOKEN = "";
  if (fs.existsSync(configPath)) {
    PAGE_ACCESS_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).accessToken;
  }
  try {
    const textBody = await request.text();
    console.log("Raw Webhook Body:", textBody);
    
    if (!textBody) {
      return new NextResponse('OK', { status: 200 }); // Ignore empty
    }
    
    const body = JSON.parse(textBody);

    // รองรับโครงสร้างตอนกดยิง Test จากหน้าเว็บ Meta (มันไม่มี object === 'page')
    if (body.object === 'page' || body.field || body.sample) {
      // พยายามหา array ของ entry ก่อน ถ้าไม่มี ให้ลองดึงจาก sample
      const entries = body.entry || (body.sample ? [body.sample] : [body]);
      
      for (const entry of entries) {
        // บางเพจมีระบบอื่นต่ออยู่ ข้อความจะไปเข้า standby แทน
        let webhookEvent = entry.messaging?.[0] || entry.standby?.[0];
        
        // ถ้ายิงมาจากหน้า Test ของ Meta โดยตรง
        if (entry.value && entry.value.message) {
          webhookEvent = entry.value;
        }

        if (webhookEvent) {
          const senderPsid = webhookEvent.sender?.id;
          const messageText = webhookEvent.message?.text;
          const attachments = webhookEvent.message?.attachments;

          if ((messageText || attachments) && senderPsid) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), 'data', 'messages.json');
            let msgs = [];
            try {
              if (fs.existsSync(filePath)) msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (e) {}

            // จัดการรูปภาพ (สลิป)
            let savedText = messageText || "";
            let savedImage = "";
            if (attachments && attachments[0]?.type === 'image') {
              savedImage = attachments[0].payload.url;
              if (!savedText) savedText = "ส่งรูปภาพ (สลิปโอนเงิน)";
              
              // อัปเดตสถานะลูกค้าอัตโนมัติให้เป็นรอตรวจสอบสลิป
              try {
                const infoPath = path.join(process.cwd(), 'data', 'webhook.json');
                let db: any = {};
                if (fs.existsSync(infoPath)) {
                  db = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
                }
                if (!db[senderPsid]) db[senderPsid] = {};
                db[senderPsid].status = 'รอตรวจสอบสลิป';
                fs.writeFileSync(infoPath, JSON.stringify(db, null, 2));
              } catch (err) { console.error('Failed to update status on slip', err); }
            }

            // ดึงชื่อลูกค้าจาก Facebook API
            let senderName = "ลูกค้าจาก Facebook";
            let senderAvatar = "https://i.pravatar.cc/150?img=5";
            try {
              const existingMsg = msgs.find((m: any) => m.senderId === senderPsid && m.senderName && m.senderName !== "ลูกค้าจาก Facebook");
              if (existingMsg) {
                senderName = existingMsg.senderName;
                senderAvatar = existingMsg.senderAvatar;
              } else {
                const profileRes = await fetch(`https://graph.facebook.com/${senderPsid}?fields=first_name,last_name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`);
                if (profileRes.ok) {
                  const profileData = await profileRes.json();
                  if (profileData.first_name) {
                    senderName = `${profileData.first_name} ${profileData.last_name || ''}`.trim();
                  }
                  if (profileData.profile_pic) {
                    senderAvatar = profileData.profile_pic;
                  }
                }
              }
            } catch (e) {
              console.error("Error fetching user profile", e);
            }

            msgs.push({
              id: Date.now(),
              senderId: senderPsid,
              senderName: senderName,
              senderAvatar: senderAvatar,
              text: savedText,
              imageUrl: savedImage,
              time: new Date().toLocaleTimeString('th-TH'),
              isCustomer: true
            });
            fs.writeFileSync(filePath, JSON.stringify(msgs));
            console.log(`💬 ได้รับข้อความจาก ${senderName}: ${savedText}`);
          }
        }
      }

      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } else {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error("Webhook POST Error:", error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
