import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const filePath = path.join(process.cwd(), 'data', 'orders.json');

declare global {
  // eslint-disable-next-line no-var
  var __ordersCache: any[] | undefined;
}

function getOrdersList(): any[] {
  if (globalThis.__ordersCache) {
    return globalThis.__ordersCache;
  }
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(parsed)) {
        globalThis.__ordersCache = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore read error
  }
  const dummyOrders = [
    { id: 'ORD-1001', customerName: 'คุณเอ', total: 590, status: 'โอนแล้ว', date: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'ORD-1002', customerName: 'คุณบี', total: 250, status: 'โอนแล้ว', date: new Date(Date.now() - 86400000 * 1).toISOString() },
    { id: 'ORD-1003', customerName: 'คุณซี', total: 1180, status: 'จัดส่งแล้ว', date: new Date().toISOString() },
  ];
  globalThis.__ordersCache = dummyOrders;
  try {
    fs.writeFileSync(filePath, JSON.stringify(dummyOrders, null, 2));
  } catch {
    // Ignore EROFS on Vercel
  }
  return dummyOrders;
}

export async function GET() {
  const orders = getOrdersList();
  return NextResponse.json(orders, {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

export async function POST(request: Request) {
  try {
    const orderData = await request.json();
    const orders = [...getOrdersList()];
    const nowIso = new Date().toISOString();

    const newOrder = {
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      ...orderData,
      date: nowIso,
      createdAt: nowIso
    };

    orders.push(newOrder);
    globalThis.__ordersCache = orders;

    try {
      fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
    } catch {
      // Ignore EROFS on Vercel
    }

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}
