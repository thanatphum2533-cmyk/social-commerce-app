import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'customers_info.json');

export async function GET() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    return NextResponse.json({});
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const { customerId, phone, address, status, isStarred, tags } = await request.json();
    
    let db: any = {};
    if (fs.existsSync(filePath)) {
      db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    
    db[customerId] = {
      ...(db[customerId] || {}),
      phone: phone !== undefined ? phone : db[customerId]?.phone,
      address: address !== undefined ? address : db[customerId]?.address,
      status: status !== undefined ? status : db[customerId]?.status,
      isStarred: isStarred !== undefined ? isStarred : db[customerId]?.isStarred,
      tags: tags !== undefined ? tags : (db[customerId]?.tags || []),
      updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
    
    return NextResponse.json({ success: true, customer: db[customerId] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save customer info' }, { status: 500 });
  }
}
