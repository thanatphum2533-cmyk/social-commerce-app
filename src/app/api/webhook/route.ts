import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/supabase';

export async function GET(request: Request) {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  let VERIFY_TOKEN = 'my_custom_secret_token_12345';
  if (fs.existsSync(configPath)) {
    try {
      VERIFY_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).verifyToken || VERIFY_TOKEN;
    } catch(e){}
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
  let PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || "";
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      PAGE_ACCESS_TOKEN = JSON.parse(fs.readFileSync(configPath, 'utf-8')).accessToken || PAGE_ACCESS_TOKEN;
    } catch(e){}
  }

  try {
    const textBody = await request.text();
    if (!textBody) {
      return new NextResponse('OK', { status: 200 });
    }
    
    const body = JSON.parse(textBody);

    if (body.object === 'page' || body.field || body.sample) {
      const entries = body.entry || (body.sample ? [body.sample] : [body]);
      
      for (const entry of entries) {
        let webhookEvent = entry.messaging?.[0] || entry.standby?.[0];
        if (entry.value && entry.value.message) {
          webhookEvent = entry.value;
        }

        if (webhookEvent) {
          const senderPsid = webhookEvent.sender?.id;
          const messageText = webhookEvent.message?.text;
          const attachments = webhookEvent.message?.attachments;

          if ((messageText || attachments) && senderPsid) {
            let savedText = messageText || "";
            let savedImage = "";
            if (attachments && attachments[0]?.type === 'image') {
              savedImage = attachments[0].payload?.url || "";
              if (!savedText) savedText = "ส่งรูปภาพ (สลิปโอนเงิน)";
            }

            let senderName = "ลูกค้าจาก Facebook";
            let senderAvatar = "";
            try {
              if (PAGE_ACCESS_TOKEN) {
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

            const newMsgId = Date.now();
            const newMsgObj = {
              id: newMsgId,
              mid: webhookEvent.message?.mid || `mid_${newMsgId}`,
              text: savedText,
              image_url: savedImage,
              time: new Date().toLocaleTimeString('th-TH'),
              is_customer: true,
              timestamp: webhookEvent.timestamp || newMsgId,
              sender_id: senderPsid,
              sender_name: senderName,
              sender_avatar: senderAvatar
            };

            // 1. ถ้ามี Supabase ให้บันทึกลง Database ทันที (Vercel)
            if (supabase) {
              try {
                await supabase.from('messages').insert([newMsgObj]);
              } catch (sErr) {
                console.error('Supabase insert error:', sErr);
              }
            }

            // 2. ถ้ามี local filesystem ให้เขียนไฟล์ด้วย
            try {
              const filePath = path.join(process.cwd(), 'data', 'messages.json');
              let msgs: any[] = [];
              if (fs.existsSync(filePath)) {
                msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              }
              msgs.push({
                id: newMsgId,
                senderId: senderPsid,
                senderName: senderName,
                senderAvatar: senderAvatar,
                text: savedText,
                imageUrl: savedImage,
                time: newMsgObj.time,
                isCustomer: true,
                timestamp: newMsgObj.timestamp
              });
              fs.writeFileSync(filePath, JSON.stringify(msgs));
            } catch (fErr) {
              // On Vercel, read-only is normal, so we catch silently
            }

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
