import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function returnToSite(origin: string, status: string) {
  const response = NextResponse.redirect(
    new URL(`/?mercadolivre=${encodeURIComponent(status)}`, origin)
  );
  response.cookies.delete("ml_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const receivedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("ml_oauth_state")?.value;

  if (!code || !receivedState || !expectedState || receivedState !== expectedState) {
    return returnToSite(request.nextUrl.origin, "erro_validacao");
  }

  const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
  const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceRoleKey) {
    return returnToSite(request.nextUrl.origin, "configuracao_pendente");
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!tokenResponse.ok) return returnToSite(request.nextUrl.origin, "erro_token");

    const token = await tokenResponse.json();
    if (!token.access_token || !token.refresh_token) {
      return returnToSite(request.nextUrl.origin, "erro_token");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await supabase.from("mercadolivre_tokens").upsert(
      {
        id: 1,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_type: token.token_type || "Bearer",
        expires_at: new Date(Date.now() + Number(token.expires_in || 0) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) return returnToSite(request.nextUrl.origin, "erro_armazenamento");
    return returnToSite(request.nextUrl.origin, "conectado");
  } catch {
    return returnToSite(request.nextUrl.origin, "erro_conexao");
  }
}
