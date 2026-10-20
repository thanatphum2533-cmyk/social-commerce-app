import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'products.json');
  if (!fs.existsSync(filePath)) {
    // ใส่ข้อมูลสินค้าตัวอย่าง
    const defaultProducts = [
      { id: 'P001', name: 'เสื้อยืด Minimal สีดำ', price: 250, stock: 50 },
      { id: 'P002', name: 'เสื้อยืด Minimal สีขาว', price: 250, stock: 30 },
      { id: 'P003', name: 'สร้อยเงินแท้ 92.5%', price: 590, stock: 15 },
    ];
    fs.writeFileSync(filePath, JSON.stringify(defaultProducts, null, 2));
    return NextResponse.json(defaultProducts);
  }
  
  const data = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(data));
}

export async function POST(request: Request) {
  try {
    const product = await request.json();
    const filePath = path.join(process.cwd(), 'data', 'products.json');
    
    let products = [];
    if (fs.existsSync(filePath)) {
      products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    
    product.id = 'P' + Date.now().toString().slice(-4); // Gen ID ง่ายๆ
    products.push(product);
    
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const filePath = path.join(process.cwd(), 'data', 'products.json');
    
    if (fs.existsSync(filePath) && id) {
      let products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      products = products.filter((p: any) => p.id !== id);
      fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
