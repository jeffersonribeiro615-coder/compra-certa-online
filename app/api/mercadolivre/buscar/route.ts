import { NextResponse } from "next/server";

type MercadoLivreItem = {
  id: string;
  title: string;
  price: number;
  currency_id?: string;
  thumbnail?: string;
  permalink: string;
  category_id?: string;
};

function collectProducts(value: any, output: any[] = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const entry of value) collectProducts(entry, output);
    return output;
  }

  const type = value["@type"];
  const isProduct = type === "Product" ||
    (Array.isArray(type) && type.includes("Product"));

  if (isProduct) {
    const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers;
    const rawImage = Array.isArray(value.image) ? value.image[0] : value.image;
    const image = typeof rawImage === "string" ? rawImage : rawImage?.url;
    const price = Number(offer?.price || offer?.lowPrice || 0);
    const url = value.url || offer?.url || "";
    if (value.name && price > 0 && url) {
      output.push({
        id: String(value.sku || value.productID || url),
        title: String(value.name),
        price,
        category: "Outros",
        image_url: String(image || "").replace(/^http:/, "https:"),
        product_url: String(url).startsWith("http") ? String(url) : `https://www.mercadolivre.com.br${url}`,
        affiliate_url: "",
        description: "",
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key !== "offers" && key !== "image") collectProducts(child, output);
  }
  return output;
}

async function searchWebsite(query: string) {
  const pageUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`;
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const html = await response.text();
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const found: any[] = [];
  for (const script of scripts) {
    try {
      const json = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
      collectProducts(JSON.parse(json), found);
    } catch {
      // Ignora dados estruturados inválidos e tenta os demais blocos.
    }
  }
  const unique = new Map<string, any>();
  for (const item of found) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return Array.from(unique.values()).slice(0, 12);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body.query || "").trim().slice(0, 100);

    if (query.length < 2) {
      return NextResponse.json(
        { error: "Digite o nome de um produto para pesquisar." },
        { status: 400 }
      );
    }

    const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "12");

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    let products: any[] = [];

    if (response.ok) {
      const data = await response.json();
      products = (data.results || [])
      .filter((item: MercadoLivreItem) =>
        item.id &&
        item.title &&
        item.permalink &&
        Number.isFinite(Number(item.price)) &&
        item.currency_id === "BRL"
      )
      .map((item: MercadoLivreItem) => ({
        id: item.id,
        title: item.title,
        price: Number(item.price),
        category: "Outros",
        image_url: item.thumbnail
          ? item.thumbnail.replace(/^http:/, "https:")
          : "",
        product_url: item.permalink,
        affiliate_url: "",
        description: "",
      }));
    }

    // A busca pela API oficial pode estar bloqueada para algumas aplicações.
    // Nesse caso, tenta obter os dados estruturados da página pública de resultados.
    if (!products.length) {
      try {
        products = await searchWebsite(query);
      } catch {
        products = [];
      }
    }

    return NextResponse.json({
      products,
      warning: products.length
        ? ""
        : "O Mercado Livre não disponibilizou os resultados automaticamente. Tente novamente mais tarde.",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível pesquisar produtos no Mercado Livre." },
      { status: 500 }
    );
  }
}
