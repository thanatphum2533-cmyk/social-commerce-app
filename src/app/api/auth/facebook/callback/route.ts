import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const configPath = path.join(process.cwd(), 'data', 'config.json');
  let config: any = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const host = req.headers.get('host') || 'localhost:3001';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const redirectUri = `${proto}://${host}/api/auth/facebook/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${proto}://${host}?error=${encodeURIComponent(error || 'Cancelled')}`);
  }

  try {
    const appId = config.appId || '1055585047522758';
    const appSecret = config.appSecret || '6765d46e74a85b66d26214f631e522c9';

    // 1. Exchange code for User Access Token
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Failed to get user access token:', tokenData);
      return NextResponse.redirect(`${proto}://${host}?error=token_failed`);
    }

    const userAccessToken = tokenData.access_token;

    // 2. Fetch pages managed by this user
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${userAccessToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    if (accountsData.data && accountsData.data.length > 0) {
      // Pick the first page or match pageId
      let page = accountsData.data.find((p: any) => p.id === config.pageId) || accountsData.data[0];

      // 3. Save new Page Access Token (Never expires for pages managed by admin)
      config.pageId = page.id;
      config.pageName = page.name;
      config.accessToken = page.access_token;

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

      return NextResponse.redirect(`${proto}://${host}?fb_login=success&page=${encodeURIComponent(page.name)}`);
    } else {
      return NextResponse.redirect(`${proto}://${host}?error=no_pages_found`);
    }
  } catch (err: any) {
    console.error('Facebook OAuth error:', err);
    return NextResponse.redirect(`${proto}://${host}?error=oauth_exception`);
  }
}
