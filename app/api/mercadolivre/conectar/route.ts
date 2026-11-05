import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const required = [
    "MERCADOLIVRE_CLIENT_ID",
    "MERCADOLIVRE_CLIENT_SECRET",
    "MERCADOLIVRE_REDIRECT_URI",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    return new NextResponse(
      [
        "A conexão do Mercado Livre ainda não está pronta.",
        "",
        "Faltam estas variáveis no Netlify:",
        ...missing.map((key) => "- " + key),
        "",
        "Cadastre somente os nomes indicados. Nunca compartilhe os valores secretos.",
      ].join("\n"),
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  const clientId = process.env.MERCADOLIVRE_CLIENT_ID!;
  const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI!;

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
