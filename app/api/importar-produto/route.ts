
import { NextResponse } from "next/server";

function clean(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }

  return "";
}

function findProduct(value: any): any {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }

  const type = value["@type"];
  if (
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product"))
  ) {
    return value;
  }

  if (value["@graph"]) return findProduct(value["@graph"]);

  return null;
}

function categoryFrom(title: string) {
  const name = title.toLowerCase();

  if (/furadeira|parafusadeira|ferramenta|serra/.test(name)) return "Ferramentas";
  if (/fone|celular|câmera|camera|smartwatch|eletrônico/.test(name)) return "Eletrônicos";
  if (/cozinha|panela|cafeteira|liquidificador/.test(name)) return "Casa e Cozinha";
  if (/roupa|camisa|calça|vestido|tênis|sapato/.test(name)) return "Moda";
  if (/brinquedo|boneca|carrinho/.test(name)) return "Brinquedos";

  return "Outros";
}

function findImage(value: any): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return findImage(value[0]);
  if (value && typeof value === "object") {
    return value.url || value.contentUrl || "";
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const affiliateUrl = String(body.url || "").trim();

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(affiliateUrl);
    } catch {
      return NextResponse.json(
        { error: "Cole um link válido do produto." },
        { status: 400 }
      );
    }

    const host = parsedUrl.hostname.toLowerCase();

    const allowed =
      host === "shopee.com.br" ||
      host.endsWith(".shopee.com.br") ||
      host === "shopee.com" ||
      host.endsWith(".shopee.com") ||
      host === "mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolibre.com" ||
      host.endsWith(".mercadolibre.com") ||
      host === "meli.la";

    if (!allowed) {
      return NextResponse.json(
        { error: "Por enquanto, aceitamos somente links da Shopee e Mercado Livre." },
        { status: 400 }
      );
    }

    const response = await fetch(affiliateUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "A loja não permitiu acessar as informações. Tente novamente ou preencha os dados manualmente." },
        { status: 422 }
      );
    }

    const finalUrl = response.url || affiliateUrl;
    const html = await response.text();

    // Links curtos do Mercado Livre podem redirecionar para a página do anúncio.
    // Quando encontramos o código MLB, consultamos a API oficial do item.
    let apiItem: any = null;
    if (host === "meli.la" || /mercadolivre|mercadolibre/.test(host)) {
      const itemId = finalUrl.match(/(MLB-?\d+)/i)?.[1]?.replace("-", "").toUpperCase();
      if (itemId) {
        try {
          const itemResponse = await fetch(
            `https://api.mercadolibre.com/items/${itemId}`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" }
          );
          if (itemResponse.ok) apiItem = await itemResponse.json();
        } catch {
          // Continua com os metadados da página se a consulta do item falhar.
        }
      }
    }

    let product: any = null;

    const scripts = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) || [];

    for (const script of scripts) {
      try {
        const json = script
          .replace(/^<script[^>]*>/i, "")
          .replace(/<\/script>$/i, "");

        product = findProduct(JSON.parse(json));
        if (product) break;
      } catch {
        continue;
      }
    }

    let title =
      clean(product?.name || "") ||
      meta(html, "og:title") ||
      meta(html, "twitter:title") ||
      clean(apiItem?.title || "");

    let image =
      findImage(product?.image) ||
      meta(html, "og:image") ||
      meta(html, "twitter:image") ||
      String(apiItem?.pictures?.[0]?.secure_url || apiItem?.pictures?.[0]?.url || apiItem?.thumbnail || "");

    // Descarta endereços de imagem incompletos ou malformados.
    function validImageUrl(value: string) {
      try {
        const parsed = new URL(value);
        return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
          /\.(jpg|jpeg|png|webp)(\?|$)/i.test(parsed.pathname + parsed.search) ||
          (parsed.protocol === "https:" || parsed.protocol === "http:") &&
          /mlstatic\.com/i.test(parsed.hostname);
      } catch {
        return false;
      }
    }

    if (!validImageUrl(image)) image = "";

    // Complementa dados ausentes consultando a busca pública do Mercado Livre.
    // Isso também recupera o preço quando a página do link afiliado não o fornece.
    let searchItem: any = null;
    if (
      host === "meli.la" ||
      host === "mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolibre.com" ||
      host.endsWith(".mercadolibre.com")
    ) {
      try {
        const searchUrl = new URL("https://api.mercadolibre.com/sites/MLB/search");
        searchUrl.searchParams.set("q", title);
        searchUrl.searchParams.set("limit", "10");

        const searchResponse = await fetch(searchUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const results = Array.isArray(searchData.results) ? searchData.results : [];
          const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          const titleWords = normalizedTitle.split(" ").filter((word: string) => word.length > 2);
          const ranked = results.map((item: any) => {
            const candidate = String(item.title || "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, " ")
              .trim();
            const candidateWords = new Set(candidate.split(" "));
            const overlap = titleWords.filter((word: string) => candidateWords.has(word)).length;
            return { item, score: titleWords.length ? overlap / titleWords.length : 0 };
          }).sort((a: any, b: any) => b.score - a.score);

          searchItem = ranked[0]?.score >= 0.35
            ? ranked[0].item
            : results[0] || null;

          if (!image) {
            image = String(
              searchItem?.thumbnail ||
              searchItem?.pictures?.[0]?.secure_url ||
              searchItem?.pictures?.[0]?.url ||
              ""
            ).replace(/^http:/, "https:");
          }
        }
      } catch {
        // A importação continua mesmo se a busca auxiliar falhar.
      }
    }

    if (image && image.startsWith("//")) {
      image = `https:${image}`;
    }
    if (!validImageUrl(image)) image = "";

    const description =
      clean(product?.description || "") ||
      meta(html, "og:description") ||
      meta(html, "description");

    let price = Number(
      String(
        product?.offers?.price ||
        (Array.isArray(product?.offers) ? product.offers[0]?.price : "") ||
        meta(html, "product:price:amount") ||
        apiItem?.price ||
        searchItem?.price ||
        ""
      ).replace(",", ".")
    );

    const currency =
      apiItem?.currency_id ||
      product?.offers?.priceCurrency ||
      (Array.isArray(product?.offers) ? product.offers[0]?.priceCurrency : "") ||
      meta(html, "product:price:currency") ||
      "BRL";

    if (currency !== "BRL" || !Number.isFinite(price) || price <= 0) {
      price = 0;
    }

    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Não conseguimos identificar o nome deste produto. A loja pode bloquear a leitura automática." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      product: {
        title,
        price: price || "",
        category: categoryFrom(title),
        image_url: image,
        affiliate_url: affiliateUrl,
        description,
      },
      warning: price
        ? ""
        : "Não foi possível identificar o preço. Confira o valor na loja antes de cadastrar.",
    });
  } catch (error) {
    console.error("Erro ao importar produto:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar o produto. Tente novamente." },
      { status: 500 }
    );
  }
}
