import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function GET() {
  const hasSupabase = !!supabase;
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'NOT_FOUND';
  const hasKey = !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  let dbError = null;
  let dbCount = 0;
  let testInsertResult = null;
  let testInsertError = null;

  if (supabase) {
    // ทดสอบ insert
    const testId = Date.now();
    const { data: insData, error: insErr } = await supabase.from('messages').insert([{
      id: testId,
      mid: `test_${testId}`,
      text: 'ระบบ Supabase ใช้งานได้สมบูรณ์แบบ!',
      time: new Date().toLocaleTimeString('th-TH'),
      is_customer: false,
      timestamp: testId,
      sender_name: 'ระบบทดสอบ'
    }]).select();

    if (insErr) {
      testInsertError = insErr.message;
    } else {
      testInsertResult = insData;
    }

    const { data, error } = await supabase.from('messages').select('id', { count: 'exact' });
    if (error) dbError = error.message;
    if (data) dbCount = data.length;
  }

  return NextResponse.json({
    hasSupabase,
    envUrl: envUrl !== 'NOT_FOUND' ? envUrl.slice(0, 15) + '...' : 'MISSING',
    hasKey,
    dbCount,
    dbError,
    testInsertError,
    testInsertResult
  });
}
