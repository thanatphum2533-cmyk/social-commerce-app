import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(process.cwd(), 'data', 'messages.json');
  let msgs = [];
  try {
    if (fs.existsSync(filePath)) {
      msgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {}
  return NextResponse.json(msgs);
}
