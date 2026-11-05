import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
  const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/?mercadolivre= configurar", process.env.URL || "https://compra-certa-online.netlify.app"));
  }

  const state = crypto.randomUUID();
  const authorizationUrl = new URL("https://auth.mercadolivre.com.br/authorization");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("ml_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/mercadolivre/callback",
    maxAge: 600,
  });
  return response;
}
