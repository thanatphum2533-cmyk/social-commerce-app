import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    if (!fs.existsSync(configPath)) {
      return NextResponse.json({ error: 'Config not found' }, { status: 400 });
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const token = config.accessToken;
    const pageId = config.pageId;

    if (!token) {
      return NextResponse.json({ error: 'Page access token is missing' }, { status: 400 });
    }

    // 1. Fetch conversations from Facebook Graph API
    // Limit to recent 25 conversations, each with up to 50 messages
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
      } catch (e) {
        existingMsgs = [];
      }
    }

    const customersPath = path.join(process.cwd(), 'data', 'customers_info.json');
    let customersInfo: any = {};
    if (fs.existsSync(customersPath)) {
      try {
        customersInfo = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
      } catch (e) {
        customersInfo = {};
      }
    }

    let importedCount = 0;
    const existingMsgIds = new Set(existingMsgs.map((m: any) => m.mid || m.id));

    // Iterate over conversations
    for (const conv of conversations) {
      // Find the customer participant (not the page itself)
      const participants = conv.participants?.data || [];
      const customer = participants.find((p: any) => p.id !== pageId) || participants[0];
      const customerId = customer?.id;
      const customerName = customer?.name || 'ลูกค้า Facebook';

      if (customerId && customerName && !customersInfo[customerId]?.name) {
        if (!customersInfo[customerId]) customersInfo[customerId] = {};
        customersInfo[customerId].name = customerName;
      }

      const msgList = conv.messages?.data || [];
      // Graph API returns newest first, so we reverse to chronological order
      msgList.reverse();

      for (const m of msgList) {
        if (existingMsgIds.has(m.id)) {
          continue; // Skip already imported message
        }

        const isMe = m.from?.id === pageId;
        const msgTime = new Date(m.created_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        
        let imageUrl = undefined;
        if (m.attachments?.data && m.attachments.data.length > 0) {
          const att = m.attachments.data[0];
          if (att.image_data?.url) {
            imageUrl = att.image_data.url;
          }
        }

        const newMsgObj: any = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          mid: m.id,
          text: m.message || (imageUrl ? 'ส่งรูปภาพ' : ''),
          time: msgTime,
          isCustomer: !isMe,
          timestamp: new Date(m.created_time).getTime(),
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
      }
    }

    // Sort all messages by timestamp
    existingMsgs.sort((a: any, b: any) => {
      const timeA = a.timestamp || (typeof a.id === 'number' ? a.id : 0);
      const timeB = b.timestamp || (typeof b.id === 'number' ? b.id : 0);
      return timeA - timeB;
    });

    // Save back to JSON files
    fs.writeFileSync(messagesPath, JSON.stringify(existingMsgs, null, 2), 'utf8');
    fs.writeFileSync(customersPath, JSON.stringify(customersInfo, null, 2), 'utf8');

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
