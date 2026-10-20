import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/supabase';

export async function GET(request: Request) {
  // 1. ถ้ามี Supabase ให้ดึงจาก Supabase ก่อน (สำหรับ Vercel)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data) {
        // แปลง format ให้ตรงกับที่หน้าบ้านใช้
        const formatted = data.map((m: any) => ({
          id: Number(m.id),
          mid: m.mid,
          text: m.text,
          imageUrl: m.image_url,
          time: m.time,
          isCustomer: m.is_customer,
          timestamp: m.timestamp ? Number(m.timestamp) : undefined,
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderAvatar: m.sender_avatar,
          recipientId: m.recipient_id,
          repliedBy: m.replied_by
        }));

        return NextResponse.json(formatted, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        });
      }
    } catch (err) {
      console.error('Supabase get error:', err);
    }
  }

  // 2. Fallback: ถ้าไม่มี Supabase ให้อ่านจาก messages.json เหมือนเดิม
  const filePath = path.join(process.cwd(), 'data', 'messages.json');
  let msgs = [];
  try {
    if (fs.existsSync(filePath)) {
      msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {}
  
  return NextResponse.json(msgs, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
}
