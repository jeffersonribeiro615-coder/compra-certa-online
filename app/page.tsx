 "use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  title: string;
  price: number;
  category: string;
  image_url: string | null;
  affiliate_url: string;
  description: string | null;
  is_active: boolean;
};

const ADMIN_ID = "3d29a2cd-9685-4028-82b6-fbe423568f34";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: "",
    price: "",
    category: "Outros",
    image_url: "",
    affiliate_url: "",
    description: "",
  });

  const [command, setCommand] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Erro ao carregar produtos: " + error.message);
    } else {
      setProducts((data || []) as Product[]);
    }
  }

  function checkAdmin(current: any) {
    setIsAdmin(current?.user?.id === ADMIN_ID);
  }

  useEffect(() => {
    loadProducts();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      checkAdmin(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, current) => {
        setSession(current);
        checkAdmin(current);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // Cria uma lista única de categorias, sem espaços extras.
  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((p) => p.category?.trim() || "Outros"))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products]
  );

  // A busca procura pelo nome e pela categoria.
  const visible = products.filter((p) =>
    `${p.title} ${p.category || "Outros"}`
      .toLowerCase()
      .includes(query.toLowerCase().trim())
  );

  // Separa automaticamente os produtos por categoria.
  const groupedProducts = categories
    .map((name) => ({
      name,
      items: visible.filter(
        (p) => (p.category?.trim() || "Outros") === name
      ),
    }))
    .filter((group) => group.items.length > 0);

  function categoryId(value: string) {
    return (
      "categoria-" +
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
    );
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setMessage("Entrando...");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setMessage(
      error
        ? "Erro no login: " + error.message
        : "Login realizado com sucesso!"
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    setMessage("Você saiu do painel.");
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setMessage("Salvando produto...");

    if (!session || !isAdmin) {
      setMessage("Você precisa estar conectado como administrador.");
      return;
    }

    let imageUrl = form.image_url || null;

    if (imageFile) {
      if (!imageFile.type.startsWith("image/")) {
        setMessage("Selecione um arquivo de imagem válido.");
        return;
      }

      const extension = imageFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("produtos")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setMessage("Erro ao enviar imagem: " + uploadError.message);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("produtos")
        .getPublicUrl(fileName);

      imageUrl = publicData.publicUrl;
    }

    const { error } = await supabase.from("products").insert({
      title: form.title,
      price: Number(form.price),
      category: form.category,
      image_url: imageUrl,
      affiliate_url: form.affiliate_url,
      description: form.description || null,
      is_active: true,
    });

    if (error) {
      setMessage("Erro ao salvar: " + error.message);
    } else {
      setMessage("Produto cadastrado com sucesso!");

      setForm({
        title: "",
        price: "",
        category: "Outros",
        image_url: "",
        affiliate_url: "",
        description: "",
      });

      setImageFile(null);

      const fileInput = document.getElementById(
        "product-image"
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      loadProducts();
    }
  }

  async function interpretCommand() {
    const url = command.trim();

    if (!url) {
      setMessage("Cole o link da Shopee ou do Mercado Livre.");
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      setMessage("Cole um link válido da Shopee ou do Mercado Livre.");
      return;
    }

    setMessage("Consultando o produto...");

    try {
      const response = await fetch("/api/importar-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Não foi possível importar o produto.");
        return;
      }

      const product = data.product || {};

      setForm({
        title: product.title || product.name || "",
        price: String(product.price ?? ""),
        category: product.category || "Outros",
        image_url: product.image_url || "",
        affiliate_url: product.affiliate_url || url,
        description: product.description || "",
      });

      setMessage(
        data.warning
          ? data.warning + " Confira os dados antes de cadastrar."
          : "Produto identificado! Confira os campos e toque em Cadastrar produto."
      );
    } catch {
      setMessage("Erro ao consultar o produto. Tente novamente.");
    }
  }

  async function searchMercadoLivre() {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setMessage("Digite o nome do produto que deseja encontrar.");
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setMessage("Buscando produtos no Mercado Livre...");

    try {
      const response = await fetch("/api/mercadolivre/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Não foi possível buscar produtos.");
        return;
      }

      setSearchResults(data.products || []);
      setMessage(
        data.products?.length
          ? data.products.length + " produtos encontrados. Escolha um para preencher o cadastro."
          : "Nenhum produto encontrado. Tente outro termo."
      );
    } catch {
      setMessage("Erro ao pesquisar no Mercado Livre. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }

  function selectMercadoLivreProduct(product: any) {
    setForm({
      title: product.title || "",
      price: String(product.price ?? ""),
      category: product.category || "Outros",
      image_url: product.image_url || "",
      affiliate_url: "",
      description: "",
    });
    setSearchResults([]);
    setMessage("Produto carregado! Agora cole seu link de afiliado do Mercado Livre antes de cadastrar.");
  }

  async function removeProduct(id: number) {
    if (!confirm("Excluir este produto?")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    setMessage(
      error ? "Erro ao excluir: " + error.message : "Produto excluído."
    );

    loadProducts();
  }

  return (
    <main>
      <div className="topline">
        Ofertas selecionadas • Encontre seu próximo achado
      </div>

      <header className="header">
        <a className="logo" href="#">
          COMPRA CERTA <span>ONLINE</span>
        </a>

        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="O que você está procurando?"
          />
          <button onClick={() => {}}>Buscar</button>
        </div>

        <button className="adminButton" onClick={() => setAdminOpen(true)}>
          ⚙ Painel
        </button>
      </header>

      <section className="hero">
        <div>
          <small>ESCOLHAS INTELIGENTES</small>
          <h1>Boas ofertas para comprar melhor.</h1>
          <p>
            Produtos selecionados do Mercado Livre e da Shopee em um só lugar.
          </p>
        </div>
        <div className="bag">🛍️</div>
      </section>

      <section className="section" id="catalogo">
        <h2>Explore por categoria</h2>

        <div className="chips">
          <button
            className="chip selected"
            onClick={() =>
              document.getElementById("catalogo")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          >
            Todas
          </button>

          {categories.map((c) => (
            <button
              key={c}
              className="chip"
              onClick={() =>
                document.getElementById(categoryId(c))?.scrollIntoView({
                  behavior: "smooth",
                })
              }
            >
              {c}
            </button>
          ))}
        </div>

        <h2>{query.trim() ? "Resultados da busca" : "Nossos produtos"}</h2>

        {groupedProducts.map((group) => (
          <div
            className="categorySection"
            id={categoryId(group.name)}
            key={group.name}
          >
            <h2>{group.name}</h2>

            <div className="grid">
              {group.items.map((p) => (
                <article className="product" key={p.id}>
                  <div className="photo">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} />
                    ) : (
                      <span>🛍️</span>
                    )}
                  </div>

                  <div className="productInfo">
                    <small>{p.category || "Outros"}</small>
                    <h3>{p.title}</h3>

                    <p className="price">
                      {Number(p.price).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>

                    <a
                      className="buy"
                      href={p.affiliate_url}
                      target="_blank"
                      rel="noreferrer sponsored"
                    >
                      Ver oferta
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="empty">
            Nenhum produto encontrado. Tente outra pesquisa!
          </p>
        )}
      </section>

      <footer>
        <b>Compra Certa Online</b>
        <p>Uma vitrine de produtos e ofertas de lojas parceiras.</p>
        <small>
          Este site pode utilizar links de afiliados. Ao comprar por esses
          links, o responsável pelo site poderá receber comissão, sem custo
          adicional para você.
        </small>
      </footer>

      {adminOpen && (
        <div className="overlay">
          <section className="panel">
            <div className="panelHead">
              <div>
                <h2>Painel administrativo</h2>
                <p>Área exclusiva do administrador.</p>
              </div>

              <button
                className="close"
                onClick={() => setAdminOpen(false)}
              >
                ✕
              </button>
            </div>

            {!session ? (
              <form onSubmit={login} className="form">
                <h3>Entrar</h3>

                <label>
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Senha
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>

                <button className="primary">Entrar</button>
              </form>
            ) : !isAdmin ? (
              <p>
                Seu usuário está conectado, mas não está autorizado como
                administrador.
              </p>
            ) : (
              <>
                <div className="tabs">
                  <button className="tab active">Cadastro manual</button>
                </div>

                <form onSubmit={saveProduct} className="form">
                  <label>
                    Nome do produto
                    <input
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Preço (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Categoria
                    <input
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Escolher foto da galeria do celular
                    <input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setImageFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>

                  {imageFile && <p>Foto selecionada: {imageFile.name}</p>}

                  <label>
                    Link da imagem (opcional, se não escolher uma foto)
                    <input
                      type="url"
                      value={form.image_url}
                      onChange={(e) =>
                        setForm({ ...form, image_url: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Link de afiliado
                    <input
                      type="url"
                      value={form.affiliate_url}
                      onChange={(e) =>
                        setForm({ ...form, affiliate_url: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Descrição (opcional)
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </label>

                  <button className="primary">Cadastrar produto</button>
                </form>

                <div className="form">
                  <h3>Robô de busca do Mercado Livre</h3>
                  <p>Pesquise produtos no catálogo público e escolha um para preencher o cadastro automaticamente.</p>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ex.: fone bluetooth, liquidificador, tênis"
                  />
                  <button
                    className="secondary"
                    type="button"
                    onClick={searchMercadoLivre}
                    disabled={searching}
                  >
                    {searching ? "Buscando..." : "Buscar produtos"}
                  </button>

                  {searchResults.map((product) => (
                    <div className="adminItem" key={product.id}>
                      <div>
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            style={{ width: 64, height: 64, objectFit: "contain", display: "block" }}
                          />
                        )}
                        <b>{product.title}</b>
                        <p>R$ {Number(product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <button
                        className="primary"
                        type="button"
                        onClick={() => selectMercadoLivreProduct(product)}
                      >
                        Usar produto
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form">
                  <h3>Cadastro por comando inteligente</h3>

                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Cole aqui o link de um produto da Shopee ou do Mercado Livre"
                  />

                  <button
                    className="secondary"
                    onClick={interpretCommand}
                  >
                    Importar produto pelo link
                  </button>
                </div>

                <h3>Produtos cadastrados</h3>

                {products.map((p) => (
                  <div className="adminItem" key={p.id}>
                    <span>{p.title} — R$ {p.price}</span>
                    <button
                      className="delete"
                      onClick={() => removeProduct(p.id)}
                    >
                      Excluir
                    </button>
                  </div>
                ))}

                <button className="secondary" onClick={logout}>
                  Sair
                </button>
              </>
            )}

            {message && <p className="message">{message}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
