import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/supabase';
import { loadConfig } from '../config/route';
import { getCustomersInfoMap, saveCustomersInfoMap } from '../customers_info/route';

export async function POST() {
  try {
    const config = loadConfig();
    const token = config.accessToken;
    const pageId = config.pageId;

    if (!token) {
      return NextResponse.json({ error: 'Page access token is missing' }, { status: 400 });
    }

    // 1. Fetch conversations from Facebook Graph API
    const convUrl = `https://graph.facebook.com/v19.0/me/conversations?fields=id,updated_time,participants,messages.limit(50){id,message,created_time,from,attachments}&limit=25&access_token=${token}`;
    const convRes = await fetch(convUrl);
    const convData = await convRes.json();

    if (convData.error) {
      return NextResponse.json({ error: convData.error.message }, { status: 400 });
    }

    const conversations = convData.data || [];

    // Load existing messages & customers_info
    const messagesPath = path.join(process.cwd(), 'data', 'messages.json');
    let existingMsgs: any[] = [];
    if (fs.existsSync(messagesPath)) {
      try {
        existingMsgs = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      } catch {
        existingMsgs = [];
      }
    }

    const customersInfo: Record<string, any> = { ...getCustomersInfoMap() };

    let importedCount = 0;
    const existingMsgIds = new Set(existingMsgs.map((m: any) => m.mid || m.id));
    const newSupabaseRows: any[] = [];

    // Iterate over conversations
    for (const conv of conversations) {
      const participants = conv.participants?.data || [];
      const customer = participants.find((p: any) => p.id !== pageId) || participants[0];
      const customerId = customer?.id;
      const customerName = customer?.name || 'ลูกค้า Facebook';

      if (customerId && customerName && !customersInfo[customerId]?.name) {
        if (!customersInfo[customerId]) customersInfo[customerId] = {};
        customersInfo[customerId].name = customerName;
      }

      const msgList = conv.messages?.data || [];
      msgList.reverse();

      for (const m of msgList) {
        if (existingMsgIds.has(m.id)) {
          continue;
        }

        const isMe = m.from?.id === pageId;
        const msgTime = new Date(m.created_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        
        let imageUrl: string | undefined = undefined;
        if (m.attachments?.data && m.attachments.data.length > 0) {
          const att = m.attachments.data[0];
          if (att.image_data?.url) {
            imageUrl = att.image_data.url;
          }
        }

        const numericId = Date.now() + Math.floor(Math.random() * 100000);
        const timestamp = new Date(m.created_time).getTime();
        const textVal = m.message || (imageUrl ? 'ส่งรูปภาพ' : '');

        const newMsgObj: any = {
          id: numericId,
          mid: m.id,
          text: textVal,
          time: msgTime,
          isCustomer: !isMe,
          timestamp,
        };

        if (imageUrl) {
          newMsgObj.imageUrl = imageUrl;
        }

        if (isMe) {
          newMsgObj.senderId = 'ME';
          newMsgObj.recipientId = customerId;
          newMsgObj.repliedBy = 'เจ้าหน้าที่ร้าน';
        } else {
          newMsgObj.senderId = customerId;
          newMsgObj.senderName = customerName;
        }

        existingMsgs.push(newMsgObj);
        existingMsgIds.add(m.id);
        importedCount++;

        newSupabaseRows.push({
          id: numericId,
          mid: m.id,
          text: textVal,
          image_url: imageUrl || '',
          time: msgTime,
          is_customer: !isMe,
          timestamp,
          sender_id: isMe ? 'ME' : customerId,
          sender_name: isMe ? 'เจ้าหน้าที่ร้าน' : customerName,
          sender_avatar: '',
          recipient_id: isMe ? customerId : null,
          replied_by: isMe ? 'เจ้าหน้าที่ร้าน' : null
        });
      }
    }

    // Sort all messages by timestamp
    existingMsgs.sort((a: any, b: any) => {
      const timeA = a.timestamp || (typeof a.id === 'number' ? a.id : 0);
      const timeB = b.timestamp || (typeof b.id === 'number' ? b.id : 0);
      return timeA - timeB;
    });

    if (supabase && newSupabaseRows.length > 0) {
      try {
        await supabase.from('messages').upsert(newSupabaseRows, { onConflict: 'mid', ignoreDuplicates: true });
      } catch {
        // Fallback if mid is not unique constraint
        try {
          await supabase.from('messages').insert(newSupabaseRows);
        } catch {}
      }
    }

    // Save back to JSON files safely (ignore EROFS on Vercel)
    try {
      fs.writeFileSync(messagesPath, JSON.stringify(existingMsgs, null, 2), 'utf8');
    } catch {}
    saveCustomersInfoMap(customersInfo);

    return NextResponse.json({ 
      success: true, 
      importedCount,
      totalConversations: conversations.length,
      totalMessages: existingMsgs.length 
    });

  } catch (err: any) {
    console.error('Sync messages error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
