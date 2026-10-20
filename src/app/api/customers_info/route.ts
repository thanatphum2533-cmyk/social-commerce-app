import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const filePath = path.join(process.cwd(), 'data', 'customers_info.json');

declare global {
  // eslint-disable-next-line no-var
  var __customersInfoCache: Record<string, any> | undefined;
}

export function getCustomersInfoMap(): Record<string, any> {
  if (globalThis.__customersInfoCache) {
    return globalThis.__customersInfoCache;
  }
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      globalThis.__customersInfoCache = parsed;
      return parsed;
    }
  } catch {
    // Ignore read error
  }
  const empty: Record<string, any> = {};
  globalThis.__customersInfoCache = empty;
  try {
    fs.writeFileSync(filePath, JSON.stringify(empty, null, 2));
  } catch {
    // Ignore EROFS on Vercel
  }
  return empty;
}

export function saveCustomersInfoMap(db: Record<string, any>): void {
  globalThis.__customersInfoCache = db;
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
  } catch {
    // Ignore EROFS on Vercel
  }
}

export async function GET() {
  return NextResponse.json(getCustomersInfoMap(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

export async function POST(request: Request) {
  try {
    const { customerId, phone, address, status, isStarred, tags } = await request.json();
    const db: Record<string, any> = { ...getCustomersInfoMap() };

    db[customerId] = {
      ...(db[customerId] || {}),
      phone: phone !== undefined ? phone : db[customerId]?.phone,
      address: address !== undefined ? address : db[customerId]?.address,
      status: status !== undefined ? status : db[customerId]?.status,
      isStarred: isStarred !== undefined ? isStarred : db[customerId]?.isStarred,
      tags: tags !== undefined ? tags : (db[customerId]?.tags || []),
      updatedAt: new Date().toISOString()
    };

    saveCustomersInfoMap(db);

    return NextResponse.json({ success: true, customer: db[customerId] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save customer info' }, { status: 500 });
  }
}
