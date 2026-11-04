 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string; name: string; price: number; store: string; category: string;
  image_url: string | null; affiliate_url: string; description: string | null;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [adminOpen, setAdminOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({name:"", price:"", store:"Mercado Livre", category:"Outros", image_url:"", affiliate_url:"", description:""});
  const [command, setCommand] = useState("");

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*").eq("active", true).order("created_at", {ascending:false});
    if (error) setMessage("Não foi possível carregar os produtos. Confira a configuração do banco.");
    else setProducts((data || []) as Product[]);
  }

  async function checkAdmin(current: any) {
    if (!current) { setIsAdmin(false); return; }
    const { data } = await supabase.from("admin_users").select("user_id").eq("user_id", current.user.id).maybeSingle();
    setIsAdmin(!!data);
  }

  useEffect(() => {
    loadProducts();
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session);
      checkAdmin(data.session);
    });
    const {data: listener} = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      checkAdmin(current);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map(p => p.category || "Outros")))], [products]);
  const visible = products.filter(p => (category === "Todas" || p.category === category) &&
    `${p.name} ${p.store} ${p.category}`.toLowerCase().includes(query.toLowerCase()));

  async function login(e: React.FormEvent) {
    e.preventDefault(); setMessage("Entrando...");
    const {error} = await supabase.auth.signInWithPassword({email, password});
    setMessage(error ? "E-mail ou senha incorretos." : "Login realizado.");
  }
  async function logout() { await supabase.auth.signOut(); setMessage("Você saiu do painel."); }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault(); setMessage("Salvando produto...");
    const {error} = await supabase.from("products").insert({
      name: form.name, price: Number(form.price), store: form.store, category: form.category,
      image_url: form.image_url || null, affiliate_url: form.affiliate_url, description: form.description || null
    });
    if (error) setMessage("Não foi possível salvar. Confirme se seu usuário foi autorizado como administrador.");
    else { setMessage("Produto cadastrado!"); setForm({name:"",price:"",store:"Mercado Livre",category:"Outros",image_url:"",affiliate_url:"",description:""}); loadProducts(); }
  }

  async function interpretCommand() {
    setMessage("Interpretando comando...");
    const response = await fetch("/api/interpretar", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({command})});
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Não foi possível interpretar o comando."); return; }
    setForm({...form, ...data.product, price: String(data.product.price ?? "")});
    setMessage("Confira os campos preenchidos e toque em Cadastrar produto.");
  }

  async function removeProduct(id: string) {
    if (!confirm("Excluir este produto?")) return;
    const {error} = await supabase.from("products").delete().eq("id", id);
    setMessage(error ? "Não foi possível excluir." : "Produto excluído.");
    loadProducts();
  }

  return <main>
    <div className="topline">Ofertas selecionadas • Encontre seu próximo achado</div>
    <header className="header">
      <a className="logo" href="#">COMPRA CERTA <span>ONLINE</span></a>
      <div className="search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="O que você está procurando?"/><button onClick={()=>{}}>Buscar</button></div>
      <button className="adminButton" onClick={()=>setAdminOpen(true)}>⚙ Painel</button>
    </header>
    <section className="hero"><div><small>ESCOLHAS INTELIGENTES</small><h1>Boas ofertas para comprar melhor.</h1><p>Produtos selecionados do Mercado Livre e da Shopee em um só lugar.</p></div><div className="bag">🛍️</div></section>
    <section className="section"><h2>Explore por categoria</h2><div className="chips">{categories.map(c=><button key={c} className={category===c?"chip selected":"chip"} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <h2>Produtos em destaque</h2>
      <div className="grid">{visible.map(p=><article className="product" key={p.id}><div className="photo">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🛍️</span>}</div><div className="productInfo"><small>{p.store}</small><h3>{p.name}</h3><p className="price">{Number(p.price).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><a className="buy" href={p.affiliate_url} target="_blank" rel="noreferrer sponsored">Ver oferta</a></div></article>)}
      {visible.length===0 && <p className="empty">Nenhum produto encontrado. Em breve teremos novidades!</p>}</div>
    </section>
    <footer><b>Compra Certa Online</b><p>Uma vitrine de produtos e ofertas de lojas parceiras.</p><small>Este site pode utilizar links de afiliados. Ao comprar por esses links, o responsável pelo site poderá receber comissão, sem custo adicional para você.</small></footer>

    {adminOpen && <div className="overlay"><section className="panel"><div className="panelHead"><div><h2>Painel administrativo</h2><p>Área exclusiva do administrador.</p></div><button className="close" onClick={()=>setAdminOpen(false)}>✕</button></div>
      {!session ? <form onSubmit={login} className="form"><h3>Entrar</h3><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary">Entrar</button></form> :
      !isAdmin ? <p>Seu usuário está conectado, mas ainda não foi autorizado como administrador. Peça para conferir o passo 5 do guia.</p> :
      <><div className="tabs"><button className="tab active">Cadastro manual</button></div>
        <form onSubmit={saveProduct} className="form">
          <label>Nome do produto<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
          <div className="two"><label>Preço (R$)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/></label><label>Loja<select value={form.store} onChange={e=>setForm({...form,store:e.target.value})}><option>Mercado Livre</option><option>Shopee</option></select></label></div>
          <label>Categoria<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label>
          <label>Link da imagem (opcional)<input type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})}/></label>
          <label>Link de afiliado<input type="url" value={form.affiliate_url} onChange={e=>setForm({...form,affiliate_url:e.target.value})} required/></label>
          <label>Descrição (opcional)<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
          <button className="primary">Cadastrar produto</button>
        </form>
        <div className="form"><h3>Cadastro por comando inteligente</h3><textarea value={command} onChange={e=>setCommand(e.target.value)} placeholder="Ex.: Adicione cafeteira por R$ 159,90 na Shopee. Link: https://..."/><button className="secondary" onClick={interpretCommand}>Interpretar comando</button></div>
        <h3>Produtos cadastrados</h3>{products.map(p=><div className="adminItem" key={p.id}><span>{p.name} — R$ {p.price}</span><button className="delete" onClick={()=>removeProduct(p.id)}>Excluir</button></div>)}
        <button className="secondary" onClick={logout}>Sair</button>
      </>}
      {message && <p className="message">{message}</p>}
    </section></div>}
  </main>;
}
