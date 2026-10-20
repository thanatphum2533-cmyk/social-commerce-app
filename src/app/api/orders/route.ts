import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'orders.json');

export async function GET() {
  if (!fs.existsSync(filePath)) {
    // ข้อมูลจำลองเพื่อให้เห็นกราฟในตอนแรก
    const dummyOrders = [
      { id: 'ORD-1001', customerName: 'คุณเอ', total: 590, status: 'โอนแล้ว', date: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'ORD-1002', customerName: 'คุณบี', total: 250, status: 'โอนแล้ว', date: new Date(Date.now() - 86400000 * 1).toISOString() },
      { id: 'ORD-1003', customerName: 'คุณซี', total: 1180, status: 'จัดส่งแล้ว', date: new Date().toISOString() },
    ];
    fs.writeFileSync(filePath, JSON.stringify(dummyOrders, null, 2));
    return NextResponse.json(dummyOrders);
  }
  
  const data = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const orderData = await request.json();
    
    let orders = [];
    if (fs.existsSync(filePath)) {
      orders = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    
    const newOrder = {
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      ...orderData,
      date: new Date().toISOString()
    };
    
    orders.push(newOrder);
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
    
    return NextResponse.json({ success: true, order: newOrder });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}
