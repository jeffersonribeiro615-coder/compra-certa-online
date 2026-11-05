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

    if (!response.ok) {
      return NextResponse.json(
        { error: "O Mercado Livre não respondeu à pesquisa agora. Tente novamente." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const products = (data.results || [])
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

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível pesquisar produtos no Mercado Livre." },
      { status: 500 }
    );
  }
}
