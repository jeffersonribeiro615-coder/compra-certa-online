import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function itemIdFromUrl(value: string) {
  return value.match(/(MLB-?\d{6,})/i)?.[1]?.replace("-", "").toUpperCase() || "";
}

async function resolveItemId(affiliateUrl: string): Promise<string> {
  const directId = itemIdFromUrl(affiliateUrl);
  if (directId) return directId;

  try {
    const response = await fetch(affiliateUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompraCertaOnline/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    return itemIdFromUrl(response.url || "");
  } catch {
    return "";
  }
}

async function updateOne(
  supabase: ReturnType<typeof createClient>,
  product: { id: string; affiliate_url: string; price: number }
) {
  const itemId = await resolveItemId(product.affiliate_url);
  if (!itemId) return { id: product.id, status: "link_sem_id" };

  try {
    const response = await fetch(
      `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );

    if (!response.ok) return { id: product.id, status: "item_indisponivel" };

    const item = await response.json();
    const price = Number(item.price);

    if (item.currency_id !== "BRL" || !Number.isFinite(price) || price <= 0) {
      return { id: product.id, status: "preco_invalido" };
    }

    if (Number(product.price) === price) {
      return { id: product.id, status: "sem_alteracao" };
    }

    const { error } = await supabase
      .from("products")
      .update({ price })
      .eq("id", product.id);

    if (error) return { id: product.id, status: "erro_ao_salvar" };
    return { id: product.id, status: "atualizado", price };
  } catch {
    return { id: product.id, status: "erro_consulta" };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Acesso não autorizado ou CRON_SECRET não configurado." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Configuração do banco de dados incompleta." },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: products, error } = await supabase
      .from("products")
      .select("id, affiliate_url, price")
      .eq("is_active", true)
      .like("affiliate_url", "%mercadolivre%")
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: "Não foi possível carregar os produtos." },
        { status: 500 }
      );
    }

    const mercadoLivreProducts = products || [];
    const results = [];

    // Processa em pequenos grupos para evitar excesso de chamadas externas.
    for (let index = 0; index < mercadoLivreProducts.length; index += 5) {
      const batch = mercadoLivreProducts.slice(index, index + 5);
      results.push(...await Promise.all(batch.map((product) =>
        updateOne(supabase, product)
      )));
    }

    return NextResponse.json({
      success: true,
      checked: results.length,
      updated: results.filter((item) => item.status === "atualizado").length,
      results,
    });
  } catch {
    return NextResponse.json(
      { error: "Falha ao atualizar os preços." },
      { status: 500 }
    );
  }
}
