import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch (e) {}
  }

  const filePath = path.join(process.cwd(), 'data', 'products.json');
  if (!fs.existsSync(filePath)) {
    const defaultProducts = [
      { id: 'P001', name: 'เสื้อยืด Minimal สีดำ', price: 250, stock: 50, image: '', weight: 150 },
      { id: 'P002', name: 'เสื้อยืด Minimal สีขาว', price: 250, stock: 30, image: '', weight: 150 },
      { id: 'P003', name: 'สร้อยเงินแท้ 92.5%', price: 590, stock: 15, image: '', weight: 50 },
    ];
    try { fs.writeFileSync(filePath, JSON.stringify(defaultProducts, null, 2)); } catch(e){}
    return NextResponse.json(defaultProducts);
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch(e) {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const product = await request.json();
    product.id = product.id || 'P' + Date.now().toString().slice(-4);

    if (supabase) {
      try {
        const { error } = await supabase.from('products').insert([product]);
        if (!error) {
          return NextResponse.json({ success: true, product });
        }
      } catch (sErr) {}
    }

    const filePath = path.join(process.cwd(), 'data', 'products.json');
    let products = [];
    if (fs.existsSync(filePath)) {
      products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    products.push(product);
    try {
      fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    } catch (fErr) {}

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (supabase && id) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (!error) {
          return NextResponse.json({ success: true });
        }
      } catch (sErr) {}
    }

    const filePath = path.join(process.cwd(), 'data', 'products.json');
    if (fs.existsSync(filePath) && id) {
      let products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      products = products.filter((p: any) => p.id !== id);
      try {
        fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
      } catch (fErr) {}
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
