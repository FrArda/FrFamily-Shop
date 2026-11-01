import { useEffect, useMemo, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";
import "./styles.css";
import "./icon-overrides.css";
import "./support-fixes.css";
import "./visual-upgrade.css";
import "./campaign-admin.css";

type Product = { id: string; name: string; category: string; price: number; icon: string; description: string; imageUrl?: string; featured?: boolean; roleId?: string; stock?: number | null };
type User = { id?: string; isOwner?: boolean; name: string; tag: string; avatar?: string; guildName?: string; };
type Campaign = { discount: number; expiresAt?: string | null };
type Maintenance = { active: boolean; message?: string };

const demoProducts: Product[] = [
  { id: "emperor", name: "FR | EMPEROR", category: "Roller", price: 50000, icon: "crown-gold", description: "Sunucunun en prestijli rolü.", featured: true },
  { id: "king", name: "FR | KING", category: "Roller", price: 40000, icon: "crown-purple", description: "Gücünü ve tarzını göster." },
  { id: "ayyildiz", name: "FR | AYYILDIZ", category: "Roller", price: 38000, icon: "star-crimson", description: "Topluluğun yıldızı ol." },
  { id: "elite", name: "FR | ELİTE", category: "Roller", price: 30000, icon: "diamond-blue", description: "Özel topluluğun seçimi." },
  { id: "robux-manyagi", name: "FR | Robux Manyağı", category: "Roller", price: 25000, icon: "robux-purple", description: "Robux tutkunu topluluk üyeleri için özel rol." },
  { id: "vip", name: "FR | VİP", category: "Roller", price: 18000, icon: "bolt-violet", description: "VIP ayrıcalıklarla öne çık." },
  { id: "special-role", name: "Özel Rol", category: "Özel Rol", price: 10000, icon: "role-special", description: "Sana özel bir rol talep et." },
  { id: "nitro", name: "1 Aylık Discord Nitro", category: "Discord", price: 100000, icon: "nitro-blue", description: "Nitro siparişin manuel olarak teslim edilir." },
  { id: "robux-100", name: "100 Robux", category: "Roblox", price: 10000, icon: "robux-red", description: "Roblox hesabına 100 Robux siparişi." },
  { id: "robux-500", name: "500 Robux", category: "Roblox", price: 40000, icon: "robux-red", description: "Roblox hesabına 500 Robux siparişi." },
  { id: "robux-1000", name: "1.000 Robux", category: "Roblox", price: 75000, icon: "robux-gold", description: "Roblox hesabına 1.000 Robux siparişi." },
  { id: "robux-2500", name: "2.500 Robux", category: "Roblox", price: 150000, icon: "robux-gold", description: "Roblox hesabına 2.500 Robux siparişi." },
];

const money = (n: number) => `${n.toLocaleString("tr-TR")} Coin`;
// In an Activity, keep API calls relative so Discord's URL Mapping/proxy handles them.
// An absolute Render URL can bypass the Activity proxy and be blocked by the embedded CSP.
const api = "";
const configuredDiscordClientId = String(import.meta.env.VITE_DISCORD_CLIENT_ID || "");
const isDiscordActivity = typeof window !== "undefined" && window.parent !== window;

// Discord'un gömülü webview'i storage erişimi hazır olmadan başlayabilir veya
// yeni Activity origin'i için storage erişimini engelleyebilir. Bu durumda
// React uygulamasını tamamen siyah bırakmak yerine bellek içi oturumla devam et.
function safeStorageGet(key: string): string {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  } catch {
    // Activity bellek içi oturumla çalışmaya devam edebilir.
  }
}
const shopRoleOrder = ["FR | EMPEROR", "FR | KING", "FR | AYYILDIZ", "FR | ELITE", "FR | ROBUX MANYAGI", "FR | VIP"];
const shopRolePrices: Record<string, number> = {
  "FR | EMPEROR": 50000,
  "FR | KING": 40000,
  "FR | AYYILDIZ": 38000,
  "FR | ELITE": 30000,
  "FR | ROBUX MANYAGI": 25000,
  "FR | VIP": 18000,
};

function normalizedRoleName(name: string) {
  const normalized = name.replace(/[♛♕⚕✦◇◆•·⋅]/g, "").replace(/^.*?(?=FR\s*\|)/i, "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "FR | ELIT" ? "FR | ELITE" : normalized;
}

function prepareCatalog(items: Product[]): Product[] {
  const seenRoles = new Set<string>();
  const prepared: Product[] = [];
  for (const item of items) {
    if (item.category !== "Roller") {
      prepared.push(item);
      continue;
    }
    const normalized = normalizedRoleName(item.name);
    // Discord role names can arrive with an icon prefix (or with legacy
    // spellings). Treat those forms as the same shop product.
    if (normalized === "FR | AYYILDIZI") continue;
    const rolePrice = shopRolePrices[normalized];
    if (rolePrice) {
      if (seenRoles.has(normalized)) continue;
      seenRoles.add(normalized);
      prepared.push({ ...item, name: normalized === "FR | ROBUX MANYAGI" ? "FR | Robux Manyağı" : normalized === "FR | VIP" ? "FR | VİP" : normalized, price: rolePrice });
    } else {
      prepared.push(item);
    }
  }
  return prepared.sort((a, b) => {
    const aRoleIndex = a.category === "Roller" ? shopRoleOrder.indexOf(normalizedRoleName(a.name)) : -1;
    const bRoleIndex = b.category === "Roller" ? shopRoleOrder.indexOf(normalizedRoleName(b.name)) : -1;
    // Known roles always follow the shop's advertised order, regardless of
    // Discord role position or the order returned after account login.
    const aRank = aRoleIndex >= 0 ? aRoleIndex : shopRoleOrder.length + 1;
    const bRank = bRoleIndex >= 0 ? bRoleIndex : shopRoleOrder.length + 1;
    return aRank - bRank;
  });
}

function ProductIcon({ icon, imageUrl }: { icon: string; imageUrl?: string }) {
  const roleSymbols: Record<string, string> = {
    "crown-gold": "♛",
    "crown-purple": "♛",
    "diamond-blue": "◆",
    "bolt-violet": "ϟ",
    "role-pink": "✹",
    "star-crimson": "★",
    "robux-purple": "R$",
    "role-special": "✧",
  };
  const text = icon.includes("robux") ? "R$" : icon.includes("nitro") ? "N" : roleSymbols[icon] || "FR";
  return <span className={`product-icon icon-${icon}${imageUrl ? " has-image" : ""}`} aria-hidden="true">
    {imageUrl ? <img src={imageUrl} alt="" /> : <><span className="icon-shine" /><i>{text}</i>{icon.includes("robux") && <b>ROBUX</b>}</>}
  </span>;
}
function CoinMark() { return <span className="coin-mark" aria-label="FR Coin"><span>FR</span></span>; }

export default function App() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [balance, setBalance] = useState(0);
  const [category, setCategory] = useState("Tümü");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [specialDescription, setSpecialDescription] = useState("");
  const [toast, setToast] = useState("");
  const [session, setSession] = useState(() => safeStorageGet("fr_shop_session"));
  const [user, setUser] = useState<User>({ name: "Discord Kullanıcısı", tag: "@discord-user" });
  const [activityError, setActivityError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"shop" | "orders" | "coins" | "support">("shop");
  const [orders, setOrders] = useState<any[]>([]);
  const [coinHistory, setCoinHistory] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance>({ active: false });
  const iconForProduct = (product: Product) => {
    if (product.imageUrl || product.category !== "Roller") return product.icon;
    const name = product.name.toLocaleLowerCase("tr-TR");
    if (name.includes("emperor")) return "crown-gold";
    if (name.includes("king")) return "crown-purple";
    if (name.includes("elite") || name.includes("elıte")) return "diamond-blue";
    if (name.includes("ayyıldız") || name.includes("ayyildiz")) return "star-crimson";
    if (name.includes("robux")) return "robux-purple";
    if (name.includes("vip")) return "bolt-violet";
    if (name.includes("özel rol") || name.includes("ozel rol")) return "role-special";
    return "crown-purple";
  };

  const startShopping = () => {
    setActiveView("shop");
    setCategory("Tümü");
    requestAnimationFrame(() => {
      const grid = document.querySelector<HTMLElement>(".product-grid");
      grid?.scrollIntoView({ behavior: "smooth", block: "start" });
      grid?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (session) safeStorageSet("fr_shop_session", session);
  }, [session]);

  const loadCatalog = async (token: string) => {
    const response = await fetch(`${api}/api/shop/catalog`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (response.status === 401) throw new Error("unauthorized");
    if (!response.ok) throw new Error("catalog");
    const data = await response.json();
    const incoming = Array.isArray(data.products) ? data.products as Product[] : demoProducts;
    setProducts(prepareCatalog(incoming));
    setBalance(Number(data.balance || 0));
    setCampaign(data.campaign || null);
    setMaintenance(data.maintenance || { active: false });
    if (data.user) setUser(data.user);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const setupActivity = async () => {
      if (!isDiscordActivity) { setLoading(false); return; }
      try {
        // Client ID'yi sunucudan almak, Discord uygulaması değiştirildiğinde
        // eski hard-coded ID nedeniyle Activity'nin açılmamasını önler.
        const configResponse = await fetch("/api/shop/activity-config", { credentials: "include" });
        const config = await configResponse.json().catch(() => ({}));
        const discordClientId = String(config.clientId || configuredDiscordClientId || "");
        if (!discordClientId) throw new Error("discord_client_id_missing");

        const discordSdk = new DiscordSDK(discordClientId);
        await Promise.race([
          discordSdk.ready(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("discord_sdk_ready_timeout")), 12000)),
        ]);
        const { code } = await discordSdk.commands.authorize({
          client_id: discordClientId,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify", "guilds", "applications.commands"],
        });
        const response = await fetch("/api/shop/auth/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.access_token || !data.session) {
          throw new Error(data.message || data.error || "activity_auth");
        }
        await discordSdk.commands.authenticate({ access_token: data.access_token });
        if (cancelled) return;
        safeStorageSet("fr_shop_session", data.session);
        setSession(data.session);
        if (data.user) setUser(data.user);
        setActivityError("");
        await loadCatalog(data.session);
      } catch (error) {
        console.error("FR Activity initialization failed", error);
        if (!cancelled) {
          setLoading(false);
          setActivityError(error instanceof Error ? error.message : "Discord oturumu başlatılamadı.");
        }
      }
    };
    void setupActivity();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isDiscordActivity) return;
    const load = async () => {
      try { await loadCatalog(session); }
      catch (error) {
        setLoading(false);
        if (error instanceof Error && error.message === "unauthorized") {
          const response = await fetch(`${api}/api/shop/auth/discord`);
          if (response.redirected) window.location.href = response.url;
        }
      }
    };
    void load();
  }, [session]);

  const categories = ["Tümü", ...Array.from(new Set(products.map((p) => p.category)))];
  const visible = useMemo(() => products.filter((p) =>
    (category === "Tümü" || p.category === category) &&
    p.name.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))
  ), [products, category, query]);

  const buy = async () => {
    if (!selected) return;
    if (maintenance.active) { setToast("Mağaza bakımda. Satın alma işlemleri geçici olarak kapalı."); return; }
    if (!session) { setToast("Discord oturumun henüz hazır değil."); return; }
    if (balance < selected.price) { setToast("Bu ürün için yeterli coin bakiyen yok."); return; }
    if (selected.id === "special-role" && specialDescription.trim().length < 5) {
      setToast("Özel rol isteğin için kısa bir açıklama yaz.");
      return;
    }
    try {
      const res = await fetch(`${api}/api/shop/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
        body: JSON.stringify({ productId: selected.id, description: selected.id === "special-role" ? specialDescription.trim() : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "purchase");
      setBalance(Number(data.balance ?? balance - selected.price));
      setSelected(null);
      setSpecialDescription("");
      setToast("Sipariş oluşturuldu. Coin bakiyen güncellendi.");
    } catch (error) {
       setToast(error instanceof Error && error.message === "insufficient_balance" ? "Yeterli coin bakiyen yok." : error instanceof Error && error.message === "role_already_owned" ? "Bu rolü daha önce satın aldın." : error instanceof Error && error.message === "out_of_stock" ? "Bu ürün stokta kalmadı." : "Sipariş oluşturulamadı.");
    }
  };

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => {
    if (!session || activeView === "shop") return;
    const headers = { Authorization: `Bearer ${session}` };
    const loadPanel = async () => {
      const path = activeView === "orders" ? "/api/shop/orders" : activeView === "coins" ? "/api/shop/coin-history" : "/api/shop/support";
      const res = await fetch(path, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (activeView === "orders") setOrders(data.orders || []);
      if (activeView === "coins") setCoinHistory(data.entries || []);
      if (activeView === "support") {
        const nextTickets = data.tickets || [];
        setTickets(nextTickets);
        setSelectedTicketId((current) => current || nextTickets[0]?.id || "");
      }
    };
    void loadPanel();
    if (activeView !== "support") return;
    const timer = setInterval(async () => {
      const res = await fetch("/api/shop/support", { headers });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeView, session]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/shop/catalog", { headers: { Authorization: `Bearer ${session}` }, credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setMaintenance(data.maintenance || { active: false });
        if (Array.isArray(data.products)) {
          const incoming = data.products as Product[];
          setProducts(prepareCatalog(incoming));
        }
        if (typeof data.balance === "number") setBalance(data.balance);
      } catch {
        // The existing screen remains usable while a status refresh is unavailable.
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [session]);

  const createTicket = async () => {
    if (supportSubject.trim().length < 5) { setToast("Destek konusu en az 5 karakter olmalı."); return; }
    const res = await fetch("/api/shop/support", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` }, body: JSON.stringify({ subject: supportSubject }) });
    if (res.ok) {
      const data = await res.json();
      setSupportSubject("");
      if (data.ticket) {
        setTickets((current) => [data.ticket, ...current]);
        setSelectedTicketId(data.ticket.id);
      }
      setToast("Destek talebin oluşturuldu. Mesajların FrArda'ya iletilecek.");
      setActiveView("support");
    }
    else setToast("Destek talebi oluşturulamadı.");
  };
  const sendSupportMessage = async (ticketId: string) => {
    if (!supportMessage.trim()) return;
    const res = await fetch(`/api/shop/support/${ticketId}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` }, body: JSON.stringify({ body: supportMessage }) });
    if (res.ok) {
      const data = await res.json();
      if (data.ticket) setTickets((current) => current.map((ticket) => ticket.id === ticketId ? data.ticket : ticket));
      setSupportMessage("");
      setToast("Mesajın FrArda'ya iletildi.");
      setActiveView("support");
    }
    else setToast("Mesaj gönderilemedi veya talep kapalı.");
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="brand-mark">FR</div><div><strong>FR FAMILY</strong><small>COMMUNITY SHOP</small></div></div>
      <div className="side-links">
        <button className={activeView === "shop" ? "side-link selected" : "side-link"} onClick={() => setActiveView("shop")}><i className="nav-icon nav-shop" /><span>Mağaza</span></button>
        <button className={activeView === "orders" ? "side-link selected" : "side-link"} onClick={() => setActiveView("orders")}><i className="nav-icon nav-orders" /><span>Siparişlerim</span></button>
        <button className={activeView === "coins" ? "side-link selected" : "side-link"} onClick={() => setActiveView("coins")}><i className="nav-icon nav-coins" /><span>Coin Geçmişi</span></button>
        <button className={activeView === "support" ? "side-link selected" : "side-link"} onClick={() => setActiveView("support")}><i className="nav-icon nav-support" /><span>Destek Merkezi</span></button>
      </div>
      {activeView === "shop" && <><div className="sidebar-category-title">KATEGORİLER</div>
        <div className="sidebar-categories">
          {categories.map((item) => <button key={item} className={category === item ? "category-link active" : "category-link"} onClick={() => { setCategory(item); setActiveView("shop"); }}><i className={`category-icon category-${item.toLocaleLowerCase("tr-TR").replaceAll(" ", "-")}`} /><b>{item}</b><small>{item === "Tümü" ? products.length : products.filter((product) => product.category === item).length}</small></button>)}
        </div></>}
      <div className="sidebar-status"><b><i/> Sistem durumu</b><small>Mağaza ve ödeme sistemi aktif.</small></div>
    </aside>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <div className="brand"><div className="brand-mark">FR</div><div><strong>FR FAMILY</strong><span>COMMUNITY SHOP</span></div></div>
      <div className="profile">
        {user.avatar?.startsWith("http") ? <img className="avatar" src={user.avatar} alt="Discord avatar" /> : <div className="avatar avatar-fallback">FR</div>}
        <div className="profile-copy"><b>{user.name}</b><small>{user.tag}</small></div>
        <div className="balance"><CoinMark/><b>{balance.toLocaleString("tr-TR")}</b><small>COIN</small></div>
      </div>
    </header>

    {activeView === "shop" && <section className="hero">
       <div className="hero-copy-wrap"><p className="eyebrow">FR FAMILY • COMMUNITY SHOP</p><h1>Tarzını <em>yükselt.</em></h1><p className="hero-copy">Topluluğun içinde fark yarat. Özel roller, dijital ürünler ve avantajlarla kendini göster.</p><div className="hero-actions"><button className="primary hero-primary" onClick={startShopping}>Alışverişe başla</button><button className="hero-secondary" onClick={() => setToast("Coin bakiyenle ürün seç, incele ve siparişini oluştur.")}><i className="help-mark">i</i> Nasıl çalışır?</button></div><div className="hero-stats"><span><i className="stat-icon stat-products" aria-hidden="true" /><b>{products.length}</b> ürün</span><span><i className="stat-icon stat-clock" aria-hidden="true" /><b>7/24</b> erişim</span><span><i className="stat-icon stat-linked" aria-hidden="true" /><b>100%</b> hesap bağlı</span></div></div>
      <div className="hero-showcase"><div className="showcase-card"><span className="showcase-label">BAKİYEN</span><strong>{balance.toLocaleString("tr-TR")}</strong><small><CoinMark/> Coin</small><div className="showcase-line" /></div><div className="hero-orb"><div className="orb-ring">FR</div><span>FR</span></div></div>
    </section>}

      {activeView === "shop" && <nav className="shop-nav"><div className="tabs">{categories.map((item) => <button className={category === item ? "tab active" : "tab"} onClick={() => setCategory(item)} key={item}><i className={`tab-icon category-${item.toLocaleLowerCase("tr-TR").replaceAll(" ", "-")}`} />{item}</button>)}</div></nav>}
     {activeView === "shop" && campaign && <div className="campaign-banner"><span className="campaign-badge">%</span><div><b><i className="campaign-live-icon" /> Kampanya aktif</b><small>Mağazadaki ürünlerde %{campaign.discount} indirim uygulanıyor.</small></div>{campaign.expiresAt && <time>{new Date(campaign.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar</time>}</div>}

      {activeView === "shop" && <section className="section-heading"><div><p className="eyebrow">MAĞAZAYI KEŞFET</p><h2>Senin için seçtiklerimiz</h2></div><span className="live-dot"><i /> {loading ? "Bağlanıyor" : "Discord hesabına bağlı"}</span></section>}
     {activeView === "shop" && activityError && <div className="activity-status"><span className="warning-icon">!</span><div><b>Discord bağlantısı kurulamadı</b><small>{activityError}</small></div></div>}
       {activeView === "shop" && <section className="product-grid">{visible.map((p) => <article className={p.featured ? "product-card featured" : "product-card"} key={p.id}><div className="card-top"><div className="product-visual"><ProductIcon icon={iconForProduct(p)} imageUrl={p.imageUrl}/></div> {p.featured && <span className="badge">ÖNE ÇIKAN</span>}</div><p className="product-category">{p.category}</p><h3>{p.name}</h3><p className="product-description">{p.description}</p>{p.stock != null && <small className={p.stock < 1 ? "stock-label sold-out" : "stock-label"}>{p.stock < 1 ? "Stok tükendi" : `${p.stock} adet stokta`}</small>}<div className="card-bottom"><strong>{money(p.price)}</strong><button disabled={p.stock != null && p.stock < 1} onClick={() => setSelected(p)}>{p.stock != null && p.stock < 1 ? "Stok yok" : "İncele"} {! (p.stock != null && p.stock < 1) && <i className="button-arrow" />}</button></div></article>)}</section>}
     {activeView === "shop" && <section className="shop-benefits"><div><i className="benefit-icon benefit-safe" /><p><b>Güvenli ödeme</b><small>Tüm işlemler güvenli ve şifreli.</small></p></div><div><i className="benefit-icon benefit-delivery" /><p><b>Anında teslimat</b><small>Ödemeden sonra hızlı işlem.</small></p></div><div><i className="benefit-icon benefit-support" /><p><b>7/24 destek</b><small>Her zaman yanındayız.</small></p></div></section>}
    {activeView === "orders" && <section className="panel-list">{orders.length ? orders.map((o) => <article className="history-row" key={o.id}><div><b>{o.product}</b><small>{o.id} • {new Date(o.createdAt).toLocaleString("tr-TR")}</small></div><strong>{money(o.price)}<small className={`status ${o.status}`}>{o.status === "tamamlandi" ? "Tamamlandı" : o.status === "iptal" ? "İptal edildi" : "İşlemde"}</small></strong></article>) : <div className="empty-panel">Henüz sipariş geçmişin yok.</div>}</section>}
    {activeView === "coins" && <section className="panel-list">{coinHistory.length ? coinHistory.map((e) => <article className="history-row" key={e.id}><div><b>{e.reason}</b><small>{new Date(e.createdAt).toLocaleString("tr-TR")}</small></div><strong className={e.amount > 0 ? "coin-plus" : "coin-minus"}>{e.amount > 0 ? "+" : ""}{e.amount.toLocaleString("tr-TR")} Coin<small> Bakiye: {e.balance.toLocaleString("tr-TR")}</small></strong></article>) : <div className="empty-panel">Henüz coin hareketin yok.</div>}</section>}
     {activeView === "support" && <section className="support-chat">
       <aside className="ticket-list">
          <div className="chat-list-head"><div><p className="eyebrow">FR FAMILY DESTEK</p><h2>Mesajlar</h2></div><i className="support-icon"><span>FR</span></i></div>
         <button className="new-ticket-button" onClick={() => setSelectedTicketId("new")}><i className="plus-icon" /> Yeni destek talebi</button>
         {tickets.map((t) => <button className={selectedTicketId === t.id ? "ticket-item active" : "ticket-item"} key={t.id} onClick={() => setSelectedTicketId(t.id)}><span className="ticket-avatar">FR</span><span><b>{t.subject}</b><small>{t.messages?.length || 0} mesaj · {t.status === "acik" ? "Açık" : t.status === "kapali" ? "Kapalı" : "Bekliyor"}</small></span><i className="chevron-icon" /></button>)}
         {!tickets.length && <div className="chat-empty-list">Henüz destek talebin yok.</div>}
       </aside>
       <div className="chat-window">
         {selectedTicketId === "new" || (!tickets.length && !selectedTicketId) ? <div className="new-chat">
            <i className="large-chat-icon"><span>FR</span></i><p className="eyebrow">FR FAMILY DESTEK MERKEZİ</p><h2>Yeni bir konuşma başlat</h2><p>Konunu yaz, destek ekibi buradan yanıtlasın. Açtığın talepler ve gönderdiğin her mesaj FrArda'ya da iletilir.</p>
           <div className="new-ticket-form"><input value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="Örn. Siparişim teslim edilmedi" /><button className="primary" onClick={createTicket}>Sohbeti başlat <i className="button-arrow" /></button></div>
         </div> : (() => {
           const ticket = tickets.find((item) => item.id === selectedTicketId) || tickets[0];
           if (!ticket) return null;
           return <><header className="chat-header"><div><b>{ticket.subject}</b><small>{ticket.id} · Destek ekibiyle özel konuşma</small></div><span className={`status ${ticket.status}`}>{ticket.status === "acik" ? "Açık" : ticket.status === "kapali" ? "Kapalı" : "Bekliyor"}</span></header>
             <div className="chat-messages">{(ticket.messages || []).length ? ticket.messages.map((message: any) => <div className={message.authorId === user.id ? "chat-message mine" : "chat-message"} key={message.id}><span className="message-avatar">{message.authorId === user.id ? "SEN" : "FR"}</span><div><b>{message.authorId === user.id ? "Sen" : message.authorName || "FrArda"}</b><small>{new Date(message.createdAt).toLocaleString("tr-TR")}</small><p>{message.body}</p></div></div>) : <div className="chat-placeholder">Talebin alındı. Destek ekibinin yanıtı burada görünecek.</div>}</div>
             {ticket.status === "acik" ? <div className="chat-compose"><input value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendSupportMessage(ticket.id); }} placeholder="Mesajını yaz..." /><button onClick={() => sendSupportMessage(ticket.id)}>Gönder <i className="send-icon" /></button></div> : <div className="chat-closed">Bu destek talebi kapatıldı.</div>}</>;
         })()}
       </div>
     </section>}
      <section className="shop-footer-art" aria-label="FR Family Shop hakkında">
        <div className="footer-art-orb"><span>FR</span><i /></div>
        <div><p className="eyebrow">FR FAMILY SHOP</p><h2>Topluluğun tarzı burada başlar.</h2><p>Rollerini seç, coinlerini değerlendir ve FR Family dünyasında kendine ait bir iz bırak.</p></div>
        <div className="footer-art-badge"><b>FR</b><small>COMMUNITY<br/>SHOP</small></div>
      </section>
      <footer><span><i className="footer-shop-logo">✦</i> FR FAMILY SHOP</span><span><i className="lock-icon" /> Güvenli sipariş</span><span><i className="connected-dot" /> Discord hesabınla bağlı</span></footer>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><i className="close-icon" /></button><ProductIcon icon={iconForProduct(selected)} imageUrl={selected.imageUrl}/><p className="eyebrow">{selected.category}</p><h2>{selected.name}</h2><p>{selected.description} Sipariş oluşturulduğunda gerçek coin bakiyenden düşülür ve yöneticiye onay için iletilir.</p>{selected.id === "special-role" && <label className="special-description"><span>İstediğin özel rolü açıkla</span><textarea value={specialDescription} onChange={(e) => setSpecialDescription(e.target.value)} placeholder="Rol adı, renk, yetkiler ve diğer detaylar..." maxLength={2000} /></label>}<div className="modal-price">{money(selected.price)}<small>Mevcut bakiye: {money(balance)}{selected.stock != null ? ` · Stok: ${selected.stock}` : ""}</small></div><button className="primary" disabled={maintenance.active || selected.stock != null && selected.stock < 1 || balance < selected.price || !session} onClick={buy}>{maintenance.active ? "Bakım modu aktif" : selected.stock != null && selected.stock < 1 ? "Stok yok" : !session ? "Discord bağlantısı bekleniyor" : balance < selected.price ? "Yetersiz coin" : "Satın alma talebi oluştur"}<i className="button-arrow" /></button><button className="secondary cancel-button" onClick={() => { setSelected(null); setSpecialDescription(""); }}>Vazgeç</button></div></div>}
     {maintenance.active && <div className="maintenance-overlay" role="dialog" aria-modal="true"><div className="maintenance-card"><div className="maintenance-mark">FR</div><p className="eyebrow">FR FAMILY SHOP</p><h2>Mağaza bakımda</h2><p>{maintenance.message || "Mağaza üzerinde kısa bir çalışma yapılıyor. Lütfen daha sonra tekrar deneyin."}</p><small>Bu sırada sipariş ve ödeme işlemleri kullanılamaz.</small></div></div>}
    {toast && <div className="toast"><i className="toast-check" /> {toast}</div>}
  </main>;
}
