import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// เก็บใน Server Memory สำหรับสถานะออนไลน์ Real-time (ไม่พึ่งพาไฟล์ disk)
const onlineMap = new Map<string, number>();

export async function GET() {
  const now = Date.now();
  const onlineAdmins: string[] = [];
  
  onlineMap.forEach((lastSeen, name) => {
    if (now - lastSeen < 20000) { // 20 วินาที
      onlineAdmins.push(name);
    } else {
      onlineMap.delete(name);
    }
  });

  return NextResponse.json({ online: onlineAdmins }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}

export async function POST(request: Request) {
  try {
    const { adminName } = await request.json();
    if (adminName) {
      onlineMap.set(adminName, Date.now());
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
