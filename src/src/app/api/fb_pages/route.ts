import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userAccessToken } = await request.json();

    // ดึงรายการเพจที่ user คนนี้เป็นแอดมินอยู่
    const response = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`);
    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ pages: data.data }); // data.data เป็น array ของ { id, name, access_token }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
