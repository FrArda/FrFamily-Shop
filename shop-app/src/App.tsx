import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { SiDiscord, SiRoblox } from 'react-icons/si';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronRight, Crown,
  CircleHelp, Clock3, Coins, Gift, Headphones, LayoutGrid, LockKeyhole,
  MessageCircle, Package, Search, ShieldCheck, ShoppingBag, Sparkles, Ticket, X,
} from 'lucide-react';
import './shop.css';
import './discount-prices.css';
import './gift.css';
import './info-panel.css';
import { playShopSound, primeShopSound } from './shop-sounds';

type Product = {
  id: string; name: string; category: string; price: number; icon: string;
  description: string; imageUrl?: string; featured?: boolean; roleId?: string;
  originalPrice?: number;
  stock?: number | null;
};
type User = { id?: string; isOwner?: boolean; name: string; tag: string; avatar?: string; guildName?: string };
type Campaign = { discount: number; expiresAt?: string | null };
type Maintenance = { active: boolean; message?: string };
type TicketMessage = { id: string; authorId?: string; authorName?: string; body: string; createdAt: string };
type SupportTicket = { id: string; subject: string; status: string; messages?: TicketMessage[] };
type Order = { id: string; product: string; price: number; createdAt: string; status: string; giftRecipientId?: string; giftRecipientName?: string; cancelReason?: string };
type GuildMember = { id: string; name: string; username: string };
type CoinEntry = { id: string; reason: string; createdAt: string; amount: number; balance: number };
type GuildInfo = { id?: string; icon?: string; iconUrl?: string; icon_url?: string; name?: string };
type BotProfile = { id?: string; avatar?: string; avatarUrl?: string; avatar_url?: string };
type View = 'shop' | 'orders' | 'coins' | 'support';

const demoProducts: Product[] = [
  { id: 'consigliere', name: 'FR | Consigliere', category: 'Roller', price: 50000, icon: 'crown-gold', description: 'Saygınlığı ve etkisiyle toplulukta öne çık.', featured: true },
  { id: 'king', name: 'FR | KING', category: 'Roller', price: 40000, icon: 'crown-purple', description: 'Gücünü ve tarzını göster.' },
  { id: 'ayyildiz', name: 'FR | AYYILDIZ', category: 'Roller', price: 38000, icon: 'star-crimson', description: 'Topluluğun yıldızı ol.' },
  { id: 'elite', name: 'FR | ELİTE', category: 'Roller', price: 30000, icon: 'diamond-blue', description: 'Özel topluluğun seçimi.' },
  { id: 'robux-manyagi', name: 'FR | Robux Manyağı', category: 'Roller', price: 25000, icon: 'robux-purple', description: 'Robux tutkunu topluluk üyeleri için özel rol.' },
  { id: 'vip', name: 'FR | VİP', category: 'Roller', price: 18000, icon: 'bolt-violet', description: 'VIP ayrıcalıklarla öne çık.' },
  { id: 'special-role', name: 'Özel Rol', category: 'Özel Rol', price: 10000, icon: 'role-special', description: 'Sana özel bir rol talep et.' },
  { id: 'nitro', name: '1 Aylık Discord Nitro', category: 'Discord', price: 100000, icon: 'nitro-blue', description: 'Nitro siparişin manuel olarak teslim edilir.' },
  { id: 'robux-100', name: '100 Robux', category: 'Roblox', price: 10000, icon: 'robux-red', description: 'Roblox hesabına 100 Robux siparişi.' },
  { id: 'robux-500', name: '500 Robux', category: 'Roblox', price: 40000, icon: 'robux-red', description: 'Roblox hesabına 500 Robux siparişi.' },
  { id: 'robux-1000', name: '1.000 Robux', category: 'Roblox', price: 75000, icon: 'robux-gold', description: 'Roblox hesabına 1.000 Robux siparişi.' },
  { id: 'robux-2500', name: '2.500 Robux', category: 'Roblox', price: 150000, icon: 'robux-gold', description: 'Roblox hesabına 2.500 Robux siparişi.' },
];
const money = (amount: number) => `${Number(amount || 0).toLocaleString('tr-TR')} Coin`;
const activityMode = typeof window !== 'undefined' && window.parent !== window;
const clientIdFromEnv = String(import.meta.env.VITE_DISCORD_CLIENT_ID || '');
const shopRoleOrder = ['FR | CONSIGLIERE', 'FR | KING', 'FR | AYYILDIZ', 'FR | ELITE', 'FR | ROBUX MANYAGI', 'FR | VIP'];
const shopRolePrices: Record<string, number> = {
  'FR | CONSIGLIERE': 50000, 'FR | KING': 40000, 'FR | AYYILDIZ': 38000,
  'FR | ELITE': 30000, 'FR | ROBUX MANYAGI': 25000, 'FR | VIP': 18000,
};
function safeGet(key: string) { try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch { return ''; } }
function safeSet(key: string, value: string) { try { sessionStorage.setItem(key, value); localStorage.setItem(key, value); } catch { /* Embedded session can remain in memory. */ } }
function safeRemove(key: string) { try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch { /* Storage may be unavailable in an embedded browser. */ } }
function normalizedRole(name: string) {
  const normalized = name.replace(/[♛♕⚕✦◇◆•·⋅]/g, '').replace(/^.*?(?=FR\s*\|)/i, '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized === 'FR | ELIT' ? 'FR | ELITE' : normalized;
}
function prepareCatalog(items: Product[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.category !== 'Roller') return true;
    const role = normalizedRole(item.name);
    if (role === 'FR | EMPEROR' || role === 'FR | AYYILDIZI' || role === 'FR | VIP') return false;
    if (shopRolePrices[role]) {
      if (seen.has(role)) return false;
      seen.add(role);
      item.name = role === 'FR | CONSIGLIERE' ? 'FR | Consigliere' : role === 'FR | ROBUX MANYAGI' ? 'FR | Robux Manyağı' : role === 'FR | VIP' ? 'FR | VİP' : role;
      if (role === 'FR | CONSIGLIERE') {
        item.icon = 'crown-gold';
        item.featured = true;
      }
    }
    return true;
  }).sort((a, b) => {
    const rank = (p: Product) => p.category === 'Roller' && shopRoleOrder.includes(normalizedRole(p.name)) ? shopRoleOrder.indexOf(normalizedRole(p.name)) : 99;
    return rank(a) - rank(b);
  });
}
function ProductArt({ product, large = false }: { product: Product; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = product.imageUrl && !failed;
  const robux = product.category === 'Roblox' || product.icon.toLowerCase().includes('robux');
  const nitro = product.category === 'Discord' || product.icon.toLowerCase().includes('nitro');
  return <div className={`product-art art-${product.icon} ${large ? 'art-large' : ''} ${image ? 'has-photo' : ''}`} aria-hidden="true">
    {image ? <img src={product.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> :
      robux ? <div className="brand-glyph roblox-glyph"><SiRoblox /><span>ROBUX</span></div> :
        nitro ? <div className="brand-glyph discord-glyph"><SiDiscord /></div> :
          <div className="role-crest"><span className="crest-glint" /><span className="crest-core">{product.icon.includes('crown') ? '♛' : product.icon.includes('star') ? '✦' : product.icon.includes('diamond') ? '◆' : product.icon.includes('bolt') ? 'ϟ' : '✧'}</span><span className="crest-rim" /></div>}
  </div>;
}
function BrandMark({ imageUrl, className = '' }: { imageUrl?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  return imageUrl && !broken
    ? <img className={`brand-mark-image ${className}`} src={imageUrl} alt="" onError={() => setBroken(true)} />
    : <span className={`brand-monogram ${className}`} aria-hidden="true"><b>FR</b><i /></span>;
}
function UserAvatar({ user }: { user: User }) {
  const [failed, setFailed] = useState(false);
  if (!user.avatar || failed) {
    const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR') || 'FR';
    return <span className="user-initials" aria-hidden="true">{initials}</span>;
  }
  return <img src={user.avatar} alt="" onError={() => setFailed(true)} />;
}
function BotAvatar({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false);
  return <img src={failed ? '/assets/shop-bot-avatar.jpg' : imageUrl} alt="" onError={() => setFailed(true)} />;
}
function botAvatarFrom(data: { botAvatarUrl?: string; bot?: BotProfile }) {
  const direct = data.botAvatarUrl || data.bot?.avatarUrl || data.bot?.avatar_url;
  if (direct) return direct;
  const id = data.bot?.id;
  const hash = data.bot?.avatar;
  if (!id || !hash) return '';
  const extension = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.${extension}?size=128`;
}
function CoinToken({ small = false, large = false }: { small?: boolean; large?: boolean }) {
  return <span className={`coin-token ${small ? 'coin-small' : ''} ${large ? 'coin-large' : ''}`} role="img" aria-label="FR Coin"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="12" textAnchor="middle" dominantBaseline="middle">FR</text></svg></span>;
}
function dateText(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('tr-TR'); }
function productDiscountPercent(product: Product, campaign: Campaign | null) {
  const originalPrice = product.originalPrice;
  if (typeof originalPrice !== 'number' || originalPrice <= product.price) return 0;
  return campaign?.discount && campaign.discount > 0
    ? campaign.discount
    : Math.round((originalPrice - product.price) / originalPrice * 100);
}

export default function App() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [balance, setBalance] = useState(0);
  const [category, setCategory] = useState('Tümü');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [specialDescription, setSpecialDescription] = useState('');
  const [giftProduct, setGiftProduct] = useState<Product | null>(null);
  const [giftRecipient, setGiftRecipient] = useState<GuildMember | null>(null);
  const [giftMemberQuery, setGiftMemberQuery] = useState('');
  const [giftMembers, setGiftMembers] = useState<GuildMember[]>([]);
  const [giftMembersLoading, setGiftMembersLoading] = useState(false);
  const [giftMemberSearchError, setGiftMemberSearchError] = useState('');
  const [giftSpecialDescription, setGiftSpecialDescription] = useState('');
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [session, setSession] = useState(() => safeGet('fr_shop_session'));
  const [user, setUser] = useState<User>({ name: 'Discord Kullanıcısı', tag: '@discord-user' });
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [vipPurchaseUrl, setVipPurchaseUrl] = useState('');
  const [infoOpen, setInfoOpen] = useState(() => safeGet('fr_shop_info_dismissed') !== '1');
  const [botAvatarUrl, setBotAvatarUrl] = useState('/assets/shop-bot-avatar.jpg');
  const [activityError, setActivityError] = useState('');
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [activeView, setActiveView] = useState<View>('shop');
  const [orders, setOrders] = useState<Order[]>([]);
  const [coinHistory, setCoinHistory] = useState<CoinEntry[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance>({ active: false });
  const [panelLoading, setPanelLoading] = useState(false);

  const notify = useCallback((message: string) => setToast(message), []);
  const playSound = (sound: 'gift' | 'success') => playShopSound(sound);
  const loadCatalog = useCallback(async (token: string) => {
    const response = await fetch('/api/shop/catalog', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
    if (response.status === 401) throw new Error('unauthorized');
    if (!response.ok) throw new Error('catalog');
    const data: { products?: Product[]; balance?: number; campaign?: Campaign | null; maintenance?: Maintenance; user?: User; guild?: GuildInfo; botAvatarUrl?: string; bot?: BotProfile; vipPurchaseUrl?: string } = await response.json();
    setProducts(prepareCatalog(Array.isArray(data.products) ? data.products : demoProducts));
    setBalance(Number(data.balance || 0));
    setCampaign(data.campaign || null);
    setMaintenance(data.maintenance || { active: false });
    setVipPurchaseUrl(String(data.vipPurchaseUrl || ''));
    if (data.user) setUser(data.user);
    if (data.guild) setGuild(data.guild);
    const botAvatar = botAvatarFrom(data);
    if (botAvatar) setBotAvatarUrl(botAvatar);
    setDemoMode(false);
    setLoading(false);
  }, []);

  useEffect(() => { if (session) safeSet('fr_shop_session', session); }, [session]);
  useEffect(() => {
    let cancelled = false;
    async function setupActivity() {
      if (!activityMode) { setLoading(false); return; }
      try {
        const configResponse = await fetch('/api/shop/activity-config', { credentials: 'include' });
        const config = await configResponse.json().catch(() => ({})) as { clientId?: string };
        const clientId = String(config.clientId || clientIdFromEnv || '');
        if (!clientId) throw new Error('discord_client_id_missing');
        const sdk = new DiscordSDK(clientId);
        await Promise.race([sdk.ready(), new Promise((_, reject) => window.setTimeout(() => reject(new Error('discord_sdk_ready_timeout')), 12000))]);
        const { code } = await sdk.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify', 'guilds', 'applications.commands'] });
        const response = await fetch('/api/shop/auth/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const data = await response.json().catch(() => ({})) as { access_token?: string; session?: string; user?: User; guild?: GuildInfo; botAvatarUrl?: string; bot?: BotProfile; message?: string; error?: string };
        if (data.user && !cancelled) setUser(data.user);
        if (!response.ok || !data.access_token || !data.session) {
          if (data.error === 'no_shop_guild') {
            safeRemove('fr_shop_session');
            if (!cancelled) {
              setSession('');
              setBalance(0);
            }
          }
          throw new Error(data.message || data.error || 'activity_auth');
        }
        await sdk.commands.authenticate({ access_token: data.access_token });
        if (cancelled) return;
        safeSet('fr_shop_session', data.session);
        setSession(data.session);
        if (data.user) setUser(data.user);
        if (data.guild) setGuild(data.guild);
        const botAvatar = botAvatarFrom(data);
        if (botAvatar) setBotAvatarUrl(botAvatar);
        setActivityError('');
        await loadCatalog(data.session);
      } catch (error) {
        console.error('FR Activity initialization failed', error);
        if (!cancelled) { setLoading(false); setActivityError(error instanceof Error ? error.message : 'Discord oturumu başlatılamadı.'); }
      }
    }
    void setupActivity();
    return () => { cancelled = true; };
  }, [loadCatalog]);
  useEffect(() => {
    if (activityMode) return;
    let cancelled = false;
    (async () => {
      try { await loadCatalog(session); }
      catch (error) {
        if (cancelled) return;
        setLoading(false);
        setDemoMode(true);
        if (error instanceof Error && error.message === 'unauthorized') {
          try { const response = await fetch('/api/shop/auth/discord', { credentials: 'include' }); if (response.redirected) window.location.href = response.url; } catch { /* Preview remains local when auth is offline. */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [session, loadCatalog]);

  const categories = useMemo(() => ['Tümü', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visible = useMemo(() => products.filter((product) =>
    (category === 'Tümü' || product.category === category) &&
    product.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')),
  ), [products, category, query]);
  const activeTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const serverIconHash = guild?.icon || '';
  const serverIconFromHash = guild?.id && serverIconHash
    ? `https://cdn.discordapp.com/icons/${guild.id}/${serverIconHash}.${serverIconHash.startsWith('a_') ? 'gif' : 'png'}?size=128`
    : '';
  const serverIconUrl = guild?.iconUrl || guild?.icon_url || serverIconFromHash || '/assets/server-logo.gif';
  const chooseView = (view: View) => { setActiveView(view); if (view === 'shop') window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const scrollToProducts = () => { setActiveView('shop'); setCategory('Tümü'); document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const dismissInfo = () => { setInfoOpen(false); safeSet('fr_shop_info_dismissed', '1'); };

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3600); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!session || activeView === 'shop') { setPanelLoading(false); return; }
    let alive = true;
    const headers = { Authorization: `Bearer ${session}` };
    const path = activeView === 'orders' ? '/api/shop/orders' : activeView === 'coins' ? '/api/shop/coin-history' : '/api/shop/support';
    const loadPanel = async () => {
      setPanelLoading(true);
      try {
        const response = await fetch(path, { headers, credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { orders?: Order[]; entries?: CoinEntry[]; tickets?: SupportTicket[] };
        if (!alive) return;
        if (activeView === 'orders') setOrders(data.orders || []);
        if (activeView === 'coins') setCoinHistory(data.entries || []);
        if (activeView === 'support') {
          const next = data.tickets || [];
          setTickets(next);
          setSelectedTicketId((current) => current || next[0]?.id || '');
        }
      } catch { /* Keep the panel available with an explanatory state. */ }
      finally { if (alive) setPanelLoading(false); }
    };
    void loadPanel();
    if (activeView !== 'support') return () => { alive = false; };
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch('/api/shop/support', { headers, credentials: 'include' });
        if (response.ok) { const data = await response.json() as { tickets?: SupportTicket[] }; if (alive) setTickets(data.tickets || []); }
      } catch { /* Polling can recover on the next cycle. */ }
    }, 5000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [activeView, session]);
  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch('/api/shop/catalog', { headers: { Authorization: `Bearer ${session}` }, credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { products?: Product[]; balance?: number; maintenance?: Maintenance; vipPurchaseUrl?: string };
        setMaintenance(data.maintenance || { active: false });
        if (Array.isArray(data.products)) setProducts(prepareCatalog(data.products));
        if (typeof data.balance === 'number') setBalance(data.balance);
        setVipPurchaseUrl(String(data.vipPurchaseUrl || ''));
      } catch { /* Retain last known state while the endpoint is unavailable. */ }
    }, 8000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const search = giftMemberQuery.trim();
    if (!giftProduct || !session || giftRecipient || search.length < 2) {
      setGiftMembers([]);
      setGiftMembersLoading(false);
      setGiftMemberSearchError('');
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setGiftMembersLoading(true);
      setGiftMemberSearchError('');
      try {
        const response = await fetch(`/api/shop/members?query=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${session}` },
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({})) as { members?: GuildMember[] };
        if (!response.ok) throw new Error('member_search_unavailable');
        if (active) setGiftMembers(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setGiftMembers([]);
          setGiftMemberSearchError('Sunucu üyeleri şu anda getirilemiyor.');
        }
      } finally {
        if (active) setGiftMembersLoading(false);
      }
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [giftProduct, session, giftRecipient, giftMemberQuery]);

  const buy = async () => {
    if (!selected) return;
    if (maintenance.active) { notify('Mağaza bakımda. Satın alma işlemleri geçici olarak kapalı.'); return; }
    if (!session) { notify('Discord oturumun henüz hazır değil.'); return; }
    if (balance < selected.price) { notify('Bu ürün için yeterli coin bakiyen yok.'); return; }
    if (selected.id === 'special-role' && specialDescription.trim().length < 5) { notify('Özel rol isteğin için kısa bir açıklama yaz.'); return; }
    primeShopSound();
    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, credentials: 'include',
        body: JSON.stringify({ productId: selected.id, description: selected.id === 'special-role' ? specialDescription.trim() : undefined }),
      });
      const data = await response.json().catch(() => ({})) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'purchase');
      setBalance(Number(data.balance ?? balance - selected.price));
      setSelected(null); setSpecialDescription('');
      playSound('success');
      notify('Sipariş oluşturuldu. Coin bakiyen güncellendi.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      notify(reason === 'insufficient_balance' ? 'Yeterli coin bakiyen yok.' : reason === 'role_already_owned' ? 'Bu rolü daha önce satın aldın.' : reason === 'out_of_stock' ? 'Bu ürün stokta kalmadı.' : 'Sipariş oluşturulamadı. Sunucu yanıt vermedi; herhangi bir ödeme alınmadı.');
    }
  };
  const submitGift = async () => {
    if (!giftProduct) return;
    const recipientId = giftRecipient?.id ?? '';
    if (!session) { notify('Hediye siparişi için Discord bağlantısı gerekli.'); return; }
    if (!recipientId) { notify('Hediye alıcısını sunucu üyeleri arasından seç.'); return; }
    if (recipientId === String(user.id || '')) { notify('Kendine hediye gönderemezsin.'); return; }
    if (balance < giftProduct.price) { notify('Bu hediye için yeterli coin bakiyen yok.'); return; }
    if (giftProduct.id === 'special-role' && giftSpecialDescription.trim().length < 5) { notify('Özel rol hediyesi için kısa bir açıklama yaz.'); return; }
    if (maintenance.active) { notify('Mağaza bakımda. Hediye siparişleri geçici olarak kapalı.'); return; }
    primeShopSound();
    setGiftSubmitting(true);
    try {
      const response = await fetch('/api/shop/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        credentials: 'include',
        body: JSON.stringify({
          productId: giftProduct.id,
          recipientId,
          description: giftProduct.id === 'special-role' ? giftSpecialDescription.trim() : undefined,
        }),
      });
      const data = await response.json().catch(() => ({})) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'gift_order_failed');
      setBalance(Number(data.balance ?? balance - giftProduct.price));
      setGiftProduct(null);
      setGiftRecipient(null);
      setGiftMemberQuery('');
      setGiftSpecialDescription('');
      playSound('success');
      notify('Hediye siparişin yönetici onayına iletildi; teslimat manuel yapılacak.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      notify(reason === 'insufficient_balance' ? 'Yeterli coin bakiyen yok.' : reason === 'recipient_not_in_server' ? 'Seçilen kişi artık sunucuda değil; başka bir üye seç.' : reason === 'recipient_validation_unavailable' ? 'Alıcının sunucu üyeliği doğrulanamadı. Biraz sonra tekrar dene.' : reason === 'invalid_recipient_id' ? 'Seçilen sunucu üyesi geçersiz.' : reason === 'gift_self_not_allowed' ? 'Kendine hediye gönderemezsin.' : reason === 'out_of_stock' ? 'Bu ürün stokta kalmadı.' : 'Hediye siparişi oluşturulamadı. Siparişlerim bölümünü kontrol et.');
    } finally {
      setGiftSubmitting(false);
    }
  };
  const createTicket = async () => {
    if (!session) { notify('Destek talebi açmak için Discord bağlantısı gerekli.'); return; }
    if (supportSubject.trim().length < 5) { notify('Destek konusu en az 5 karakter olmalı.'); return; }
    try {
      const response = await fetch('/api/shop/support', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, credentials: 'include', body: JSON.stringify({ subject: supportSubject }) });
      if (!response.ok) throw new Error('request_failed');
      const data = await response.json() as { ticket?: SupportTicket };
      setSupportSubject('');
      if (data.ticket) { setTickets((current) => [data.ticket!, ...current]); setSelectedTicketId(data.ticket.id); }
      notify('Destek talebin oluşturuldu. Mesajların FrArda’ya iletilecek.');
      setActiveView('support');
    } catch { notify('Destek talebi oluşturulamadı. Sunucu yanıt vermedi; talep kaydedilmedi.'); }
  };
  const sendSupportMessage = async (ticketId: string) => {
    if (!session) { notify('Mesaj göndermek için Discord bağlantısı gerekli.'); return; }
    if (!supportMessage.trim()) return;
    try {
      const response = await fetch(`/api/shop/support/${ticketId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` }, credentials: 'include', body: JSON.stringify({ body: supportMessage }) });
      if (!response.ok) throw new Error('send_failed');
      const data = await response.json() as { ticket?: SupportTicket };
      if (data.ticket) setTickets((current) => current.map((ticket) => ticket.id === ticketId ? data.ticket! : ticket));
      setSupportMessage('');
      notify('Mesajın FrArda’ya iletildi.');
    } catch { notify('Mesaj gönderilemedi veya talep kapalı. Sunucu yanıt vermedi; mesaj kaydedilmedi.'); }
  };

  const navItems: { id: View; title: string; Icon: typeof ShoppingBag }[] = [
    { id: 'shop', title: 'Mağaza', Icon: ShoppingBag }, { id: 'orders', title: 'Siparişlerim', Icon: Package },
    { id: 'coins', title: 'Coin Geçmişi', Icon: Coins }, { id: 'support', title: 'Destek Merkezi', Icon: MessageCircle },
  ];
  const heading = activeView === 'orders' ? ['Hesabın', 'Siparişlerim'] : activeView === 'coins' ? ['Hesabın', 'Coin geçmişi'] : activeView === 'support' ? ['FR FAMILY DESTEK', 'Destek merkezi'] : ['', ''];
  const selectedDiscountPercent = selected ? productDiscountPercent(selected, campaign) : 0;
  const serverBrandName = guild?.name && guild.name !== 'Discord Sunucusu' ? guild.name : 'FR FAMILY';

  return <main className="app-shell">
    <div className="ambient ambient-a" /><div className="ambient ambient-b" />
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandMark imageUrl={serverIconUrl} className="server-brand-mark" />
        <div><strong>{serverBrandName}</strong><small>COMMUNITY SHOP</small></div>
      </div>
      <span className="sidebar-kicker">MENÜ</span>
      <nav className="side-links" aria-label="Ana menü">
        {navItems.map(({ id, title, Icon }) => <button data-testid={`nav-${id}`} className={`side-link ${activeView === id ? 'selected' : ''}`} key={id} onClick={() => chooseView(id)}><Icon size={17} strokeWidth={1.8} /><span>{title}</span>{activeView === id && <ChevronRight size={15} />}</button>)}
      </nav>
      {activeView === 'shop' && <div className="side-categories">
        <span className="sidebar-kicker">KATEGORİLER</span>
        {categories.map((item) => <button key={item} className={`category-link ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}><span className="category-dot" />{item}<small>{item === 'Tümü' ? products.length : products.filter((product) => product.category === item).length}</small></button>)}
      </div>}
      <div className="sidebar-status"><span className="status-led" /><div><b>Sistem durumu</b><small>{demoMode ? 'Önizleme modu' : 'Mağaza ve ödeme sistemi aktif.'}</small></div></div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <div className="mobile-server"><BrandMark imageUrl={serverIconUrl} className="server-brand-mark" /><div><strong>{serverBrandName}</strong><small>COMMUNITY SHOP</small></div></div>
        <div className="shop-identity"><BotAvatar key={botAvatarUrl} imageUrl={botAvatarUrl} /><div><strong>FrFamily</strong><small>Community store</small></div></div>
        <div className="topbar-right">
          {user.id ? <div className="user-chip">
            <UserAvatar user={user} />
            <span className="user-copy"><b>{user.name}</b><small>{user.tag}</small></span>
          </div> : <div className="user-chip guest-chip"><span className="user-initials">FR</span><span className="user-copy"><b>Discord</b><small>{activityMode ? 'Bağlantı bekleniyor' : 'Önizleme'}</small></span></div>}
          <div className="balance-chip"><CoinToken /><b>{balance.toLocaleString('tr-TR')}</b><small>COIN</small></div>
        </div>
      </header>

      {demoMode && <div className="preview-notice" role="status"><span><CircleHelp size={16} /></span><div><b>Mağaza önizlemesi</b><small>Shop API şu anda bağlı değil. Gösterilen katalog demo ürünleridir; satın alma ve destek işlemleri sunucu yanıtı olmadan tamamlanmaz.</small></div><span className="preview-tag">PREVIEW</span></div>}
      {activityError && <div className="activity-notice"><CircleHelp size={17} /><div><b>Discord bağlantısı kurulamadı</b><small>{activityError}</small></div></div>}

      {activeView === 'shop' ? <>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> FR FAMILY <span>·</span> SANA ÖZEL MAĞAZA</p>
            <h1>Tarzını <em>yükselt.</em></h1>
            <p className="hero-description">FR Family’de öne çık. Özel rollerini seç, dijital ürünlere göz at ve topluluktaki yerini kendi tarzınla göster.</p>
            <div className="hero-actions"><button className="button-primary start-shopping-button" data-testid="start-shopping" onClick={scrollToProducts}><span>Alışverişe başla</span><span className="start-shopping-icon"><ArrowRight size={15} /></span></button><button className="button-soft" data-testid="how-it-works" onClick={() => setInfoOpen(true)}><CircleHelp size={16} /> Ekonomi rehberi</button></div>
            <div className="hero-metrics"><span><LayoutGrid size={16} /><b>{products.length}</b> ürün</span><i /><span><Clock3 size={16} /><b>7/24</b> erişim</span><i /><span><BadgeCheck size={16} /><b>{session ? '100%' : 'Discord'}</b> {session ? 'hesap bağlı' : 'ile bağlantı'}</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-halo" /><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-crest"><BrandMark imageUrl={serverIconUrl} /></div>
            <div className="balance-float"><small>BAKİYEN</small><strong>{balance.toLocaleString('tr-TR')}</strong><span><CoinToken small /> Coin</span><i /></div>
          </div>
        </section>
        <section className="catalog-section" id="catalog">
          <div className="catalog-toolbar">
            <div className="category-tabs" role="tablist" aria-label="Ürün kategorileri">{categories.map((item) => <button role="tab" aria-selected={category === item} data-testid={`category-${item}`} className={category === item ? 'tab active' : 'tab'} key={item} onClick={() => setCategory(item)}>{item}<span>{item === 'Tümü' ? products.length : products.filter((product) => product.category === item).length}</span></button>)}</div>
            <label className="search-field"><Search size={17} /><input data-testid="product-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ürün ara..." aria-label="Ürün ara" />{query && <button data-testid="clear-search" aria-label="Aramayı temizle" onClick={() => setQuery('')}><X size={15} /></button>}</label>
          </div>
          {campaign && <div className="campaign-banner"><span className="campaign-symbol">%</span><div><b><i /> Kampanya aktif</b><small>Mağazada %{campaign.discount} indirim var; indirimli coin fiyatları ürün kartlarında gösteriliyor.</small></div>{campaign.expiresAt && <time>{new Date(campaign.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar</time>}</div>}
          {maintenance.active && <div className="maintenance-inline"><LockKeyhole size={18} /><div><b>Mağaza bakımda</b><small>{maintenance.message || 'Sipariş işlemleri geçici olarak kullanılamıyor.'}</small></div></div>}
          <div className="section-head"><div><p className="eyebrow">MAĞAZAYI KEŞFET</p><h2>Senin için seçtiklerimiz</h2><p>FR Family dünyasında tarzına uygun bir şey mutlaka var.</p></div><div className={`connection-state ${session ? 'is-connected' : ''}`}><span />{loading ? 'Bağlanıyor' : session ? 'Discord hesabına bağlı' : demoMode ? 'Demo katalog' : 'Discord bağlantısı bekleniyor'}</div></div>
          <div className="product-grid">
            {loading ? Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index}><span /><i /><b /><small /></div>) :
              visible.map((product, index) => {
                const discountPercent = productDiscountPercent(product, campaign);
                return <article className={`product-card ${product.featured ? 'featured' : ''} ${discountPercent ? 'on-sale' : ''}`} key={product.id} style={{ animationDelay: `${Math.min(index * 35, 240)}ms` }}>
                  <div className="product-card-top"><ProductArt product={product} /><div className="product-card-flags">{product.featured && <span className="featured-badge"><Crown size={11} strokeWidth={2.4} /> ÖNE ÇIKAN</span>}{discountPercent > 0 && <span className="sale-badge">-%{discountPercent} İNDİRİM</span>}<span className="stock-dot">{product.stock != null ? product.stock > 0 ? `${product.stock} stok` : 'Tükendi' : 'Dijital ürün'}</span></div></div>
                  <div className="product-copy"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p></div>
                  <div className="product-bottom">
                    <div className="product-price"><small>{discountPercent > 0 ? 'İNDİRİMLİ FİYAT' : 'FİYAT'}</small>{discountPercent > 0 && <s>{money(product.originalPrice ?? product.price)}</s>}<strong className={discountPercent > 0 ? 'sale-price' : ''}>{money(product.price)}</strong></div>
                    <div className="product-actions">
                      <button className="gift-button" data-testid={`gift-product-${product.id}`} disabled={product.stock != null && product.stock < 1} onClick={() => { setGiftProduct(product); setGiftRecipient(null); setGiftMemberQuery(''); setGiftMembers([]); setGiftMemberSearchError(''); setGiftSpecialDescription(''); playSound('gift'); }}><Gift size={15} /><span>Hediye et</span></button>
                      <button className="product-details-button" data-testid={`product-details-${product.id}`} disabled={product.stock != null && product.stock < 1} onClick={() => setSelected(product)}>{product.stock != null && product.stock < 1 ? 'Stok yok' : 'İncele'}<ArrowUpRight size={15} /></button>
                    </div>
                  </div>
                </article>;
              })}
            {!loading && visible.length === 0 && <div className="empty-catalog"><span><Search size={24} /></span><h3>Burada ürün bulunamadı</h3><p>Aramana uyan bir ürün göremedik. Başka bir kelime dene.</p><button className="button-soft" onClick={() => { setQuery(''); setCategory('Tümü'); }}>Filtreleri temizle</button></div>}
          </div>
          <div className="benefit-strip"><div><span><ShieldCheck size={19} /></span><p><b>Güvenli ödeme</b><small>Her işlem sunucu tarafından doğrulanır.</small></p></div><div><span><Package size={19} /></span><p><b>Kontrollü teslimat</b><small>Siparişler yönetici onayına iletilir.</small></p></div><div><span><Headphones size={19} /></span><p><b>İnsan desteği</b><small>Bir sorun varsa destek ekibine yaz.</small></p></div></div>
        </section>
      </> : <section className="account-view">
        <div className="account-heading"><p className="eyebrow">{heading[0]}</p><h1>{heading[1]}</h1><p>{activeView === 'orders' ? 'Mağaza üzerinden verdiğin siparişlerin durumu.' : activeView === 'coins' ? 'Coin bakiyendeki tüm hareketler.' : 'Destek ekibimizle yaptığın konuşmalar.'}</p></div>
        {!session ? <div className="account-locked"><span><LockKeyhole size={22} /></span><h2>Discord bağlantısı gerekli</h2><p>Hesap bilgilerin ve geçmişin ancak Discord oturumun doğrulandığında görüntülenir. Bu önizlemede hesap verisi uydurulmaz.</p><button className="button-primary" onClick={() => notify('Discord OAuth, /api/shop/auth/discord endpointi kullanıma açıldığında etkinleşir.')}>Discord ile devam et <ArrowRight size={16} /></button></div> :
            activeView === 'orders' ? <div className="history-list">{panelLoading ? <LoadingRows /> : orders.length ? orders.map((order) => <article className="history-row" key={order.id}><span className="history-icon"><ShoppingBag size={18} /></span><div className="history-main"><b>{order.product}</b><small>{order.id} <i>·</i> {dateText(order.createdAt)}</small>{order.giftRecipientId && <small className="gift-order-label">🎁 Hediye edilen: {order.giftRecipientName || 'Sunucu üyesi'}</small>}{order.status === 'devam-ediyor' && <small className="order-deadline-note">30 saat içinde teslim edilmezse otomatik iade edilir.</small>}</div><div className="history-value"><strong>{money(order.price)}</strong><small className={`order-status ${order.status}`}>{order.status === 'tamamlandi' ? 'Tamamlandı' : order.status === 'iptal' ? order.cancelReason === 'delivery_timeout' ? 'Süre doldu · iade' : 'İptal edildi · iade' : 'İşlemde'}</small></div></article>) : <EmptyState title="Henüz sipariş yok" description="İlk siparişin burada görünecek." Icon={Package} />}</div> :
            activeView === 'coins' ? <div className="history-list">{panelLoading ? <LoadingRows /> : coinHistory.length ? coinHistory.map((entry) => <article className="history-row" key={entry.id}><span className="history-icon"><CoinToken /></span><div className="history-main"><b>{entry.reason}</b><small>{dateText(entry.createdAt)}</small></div><div className="history-value"><strong className={entry.amount > 0 ? 'positive' : 'negative'}>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('tr-TR')} Coin</strong><small>Bakiye: {entry.balance.toLocaleString('tr-TR')}</small></div></article>) : <EmptyState title="Coin hareketi bulunamadı" description="Bakiye hareketlerin oluştuğunda burada listelenecek." Icon={Coins} />}</div> :
              <div className="support-layout">
                <aside className="ticket-panel"><div className="ticket-panel-head"><div><span className="eyebrow">GELEN KUTUSU</span><h2>Konuşmalar</h2></div><button data-testid="new-ticket" aria-label="Yeni destek talebi" onClick={() => setSelectedTicketId('new')}><Ticket size={17} /></button></div>
                  <button className="new-ticket-cta" onClick={() => setSelectedTicketId('new')}><span>+</span> Yeni destek talebi</button>
                  {tickets.map((ticket) => <button key={ticket.id} className={`ticket-item ${selectedTicketId === ticket.id ? 'active' : ''}`} onClick={() => setSelectedTicketId(ticket.id)}><span className="ticket-mark">FR</span><span><b>{ticket.subject}</b><small>{ticket.messages?.length || 0} mesaj <i>·</i> {ticket.status === 'acik' ? 'Açık' : ticket.status === 'kapali' ? 'Kapalı' : 'Bekliyor'}</small></span><ChevronRight size={15} /></button>)}
                  {!tickets.length && <p className="ticket-empty">Henüz konuşman yok.</p>}
                </aside>
                <div className="support-conversation">
                  {selectedTicketId === 'new' || (!activeTicket && !tickets.length) ? <div className="new-conversation"><div className="conversation-mark"><MessageCircle size={24} /></div><span className="eyebrow">FR FAMILY DESTEK</span><h2>Nasıl yardımcı olabiliriz?</h2><p>Konunu aç, destek ekibi bu özel konuşmadan sana yanıt versin. Yazdıkların FrArda’ya da iletilir.</p><label className="field-label" htmlFor="support-subject">Konu başlığı</label><input id="support-subject" data-testid="support-subject" value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} placeholder="Örn. Siparişim teslim edilmedi" /><button className="button-primary" data-testid="create-ticket" onClick={() => void createTicket()}>Sohbeti başlat <ArrowRight size={16} /></button></div> :
                    activeTicket ? <><div className="conversation-header"><div><span className="ticket-mark">FR</span><div><b>{activeTicket.subject}</b><small>{activeTicket.id} · Destek ekibiyle özel konuşma</small></div></div><span className={`ticket-status ${activeTicket.status}`}>{activeTicket.status === 'acik' ? 'Açık' : activeTicket.status === 'kapali' ? 'Kapalı' : 'Bekliyor'}</span></div>
                      <div className="message-list">{activeTicket.messages?.length ? activeTicket.messages.map((message) => <article className={`message ${message.authorId === user.id ? 'mine' : ''}`} key={message.id}><span className="message-avatar">{message.authorId === user.id ? 'SEN' : 'FR'}</span><div><div className="message-meta"><b>{message.authorId === user.id ? 'Sen' : message.authorName || 'FrArda'}</b><small>{dateText(message.createdAt)}</small></div><p>{message.body}</p></div></article>) : <div className="message-empty"><MessageCircle size={24} /><p>Talebin alındı. Destek ekibinin yanıtı burada görünecek.</p></div>}</div>
                      {activeTicket.status === 'acik' ? <form className="message-compose" onSubmit={(event) => { event.preventDefault(); void sendSupportMessage(activeTicket.id); }}><input data-testid="support-message" value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Mesajını yaz..." /><button data-testid="send-support-message" aria-label="Mesajı gönder" type="submit" disabled={!supportMessage.trim()}><ArrowRight size={18} /></button></form> : <div className="closed-note">Bu destek talebi kapatıldı.</div>}
                    </> : <div className="message-empty"><MessageCircle size={24} /><p>Bir konuşma seç veya yeni destek talebi oluştur.</p></div>}
                </div>
              </div>}
      </section>}

      <section className="closing-banner"><div className="closing-logo"><BrandMark imageUrl={serverIconUrl} /></div><div><p className="eyebrow">FR FAMILY</p><h2>Topluluğun tarzı burada başlar.</h2><p>Rollerini seç, coinlerini değerlendir ve FR Family dünyasında kendine ait bir iz bırak.</p></div><div className="closing-stamp"><Sparkles size={17} /><span>FR FAMILY<br />COMMUNITY</span></div></section>
      <footer className="footer"><span><LockKeyhole size={13} /> Güvenli sipariş</span><span><i /> {session ? 'Discord hesabınla bağlı' : 'Discord bağlantısı gerekli'}</span></footer>
    </div>

    {infoOpen && activeView === 'shop' && <div className="info-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissInfo(); }}>
      <section className="info-panel" role="dialog" aria-modal="true" aria-labelledby="info-panel-title">
        <button className="info-close" type="button" aria-label="Bilgilendirmeyi kapat" onClick={dismissInfo}><X size={18} /></button>
        <p className="eyebrow">FR FAMILY · EKONOMİ REHBERİ</p>
        <h2 id="info-panel-title">Coin kazan, toplulukta öne çık.</h2>
        <p className="info-intro">Ekonomi komutları yalnızca <b>FR | VİP</b> rolüne sahip üyeler için açıktır.</p>
        <div className="info-command-grid">
          <article><strong>Coin kazan</strong><code>/günlük</code><code>/çalış</code><code>/kazı</code></article>
          <article><strong>Bakiyeni yönet</strong><code>/coin</code><code>/ekonomi</code><code>/profil</code><code>/zenginler</code></article>
          <article><strong>Oyunlara katıl</strong><code>/cf</code><code>/zar</code><code>/slot</code></article>
        </div>
        <div className="info-vip-callout">
          <span>👑 FR | VİP</span>
          <p>VIP rolünü almak için Discord’da <code>/vip-satin-al</code> komutunu kullan. Komut, yönetimin eklediği satın alma sayfasını açar.</p>
          {vipPurchaseUrl && <a href={vipPurchaseUrl} target="_blank" rel="noreferrer">FR | VİP satın al <ArrowUpRight size={15} /></a>}
        </div>
        <button className="info-dismiss" type="button" onClick={dismissInfo}>Anladım</button>
      </section>
    </div>}

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <button className="modal-close" data-testid="close-product-modal" aria-label="Kapat" onClick={() => setSelected(null)}><X size={19} /></button>
        <ProductArt product={selected} large />
        <span className="product-category">{selected.category}</span><h2 id="product-modal-title">{selected.name}</h2><p className="modal-description">{selected.description} Sipariş oluşturulduğunda coin bakiyen sunucu tarafından doğrulanır ve talebin yönetici onayına iletilir.</p>
        {selected.id === 'special-role' && <label className="special-field"><span>İstediğin özel rolü açıkla</span><textarea data-testid="special-role-description" value={specialDescription} onChange={(event) => setSpecialDescription(event.target.value)} placeholder="Rol adı, renk, yetkiler ve diğer detaylar..." maxLength={2000} /></label>}
        <div className="modal-price">
          <div><small>{selectedDiscountPercent > 0 ? 'İNDİRİMLİ ÜRÜN TUTARI' : 'ÜRÜN TUTARI'}</small>{selectedDiscountPercent > 0 && <s className="modal-original-price">{money(selected.originalPrice ?? selected.price)}</s>}<span className="modal-coin-amount"><CoinToken large /><strong className={selectedDiscountPercent > 0 ? 'sale-price' : ''}>{selected.price.toLocaleString('tr-TR')}</strong><em>COIN</em>{selectedDiscountPercent > 0 && <em className="modal-discount-badge">-%{selectedDiscountPercent}</em>}</span>{selectedDiscountPercent > 0 && <small className="modal-savings">{money(Number(selected.originalPrice) - selected.price)} indirim</small>}</div>
          <div><small>MEVCUT BAKİYE</small><span className="modal-coin-amount"><CoinToken large /><strong>{balance.toLocaleString('tr-TR')}</strong><em>COIN</em></span></div>
        </div>
        {selected.stock != null && <p className={`modal-stock ${selected.stock < 1 ? 'sold-out' : ''}`}>{selected.stock < 1 ? 'Bu ürün stokta kalmadı.' : `${selected.stock} adet stokta`}</p>}
        <button className="button-primary purchase-button" data-testid="purchase-product" disabled={maintenance.active || selected.stock != null && selected.stock < 1 || balance < selected.price || !session} onClick={() => void buy()}>{maintenance.active ? 'Bakım modu aktif' : selected.stock != null && selected.stock < 1 ? 'Stok yok' : !session ? 'Discord bağlantısı bekleniyor' : balance < selected.price ? 'Yetersiz coin' : 'Satın alma talebi oluştur'}<ArrowRight size={17} /></button>
        {!session && <p className="purchase-hint">Satın alma için doğrulanmış Discord oturumu gerekir.</p>}
        <button className="modal-cancel" data-testid="cancel-purchase" onClick={() => { setSelected(null); setSpecialDescription(''); }}>Vazgeç</button>
      </section>
    </div>}
    {giftProduct && <div className="modal-backdrop gift-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !giftSubmitting) setGiftProduct(null); }}>
      <section className="product-modal gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-modal-title">
        <button className="modal-close" data-testid="close-gift-modal" aria-label="Kapat" disabled={giftSubmitting} onClick={() => setGiftProduct(null)}><X size={19} /></button>
        <div className="gift-modal-heading"><span className="gift-modal-icon"><Gift size={24} /></span><div><span className="eyebrow">FR FAMILY HEDİYE</span><small>Bir arkadaşına sürpriz gönder</small></div></div>
        <div className="gift-product-summary"><ProductArt product={giftProduct} /><div><span className="product-category">{giftProduct.category}</span><h2 id="gift-modal-title">{giftProduct.name}</h2></div></div>
        <div className="gift-price-summary">
          <div><small>ÖDENECEK TUTAR</small>{productDiscountPercent(giftProduct, campaign) > 0 && <s>{money(giftProduct.originalPrice ?? giftProduct.price)}</s>}<strong>{money(giftProduct.price)}</strong></div>
          <div><small>BAKİYEN</small><strong>{money(balance)}</strong></div>
        </div>
        <div className="gift-id-field">
          <label htmlFor="gift-member-search">Hediye alıcısı</label>
          <div className="gift-member-picker">
            <input id="gift-member-search" data-testid="gift-recipient-search" type="search" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={!giftRecipient && giftMembers.length > 0} value={giftRecipient?.name ?? giftMemberQuery} onChange={(event) => { setGiftRecipient(null); setGiftMemberQuery(event.target.value); }} placeholder="Sunucu üyesi ara..." />
            {!giftRecipient && giftMembersLoading && <small className="gift-member-loading">Üyeler aranıyor…</small>}
            {!giftRecipient && giftMembers.length > 0 && <div className="gift-member-results" role="listbox">{giftMembers.map((member) => <button type="button" role="option" aria-selected="false" key={member.id} onClick={() => { setGiftRecipient(member); setGiftMemberQuery(''); }}><span>{member.name}</span><small>@{member.username}</small></button>)}</div>}
          </div>
          {!giftRecipient && giftMemberQuery.trim().length < 2 && <small className="gift-member-hint">Bir sunucu üyesinin adından en az 2 harf yaz.</small>}
          {!giftRecipient && giftMemberSearchError && <small className="gift-validation">{giftMemberSearchError}</small>}
          {!giftRecipient && !giftMemberSearchError && !giftMembersLoading && giftMemberQuery.trim().length >= 2 && giftMembers.length === 0 && <small className="gift-member-hint">Eşleşen sunucu üyesi bulunamadı.</small>}
        </div>
        {giftRecipient && <div className="gift-recipient-preview"><span><Gift size={15} /></span><div>Hediye alıcısı <b>{giftRecipient.name}</b><small>@{giftRecipient.username}</small></div><BadgeCheck size={16} /><button type="button" aria-label="Alıcıyı değiştir" onClick={() => { setGiftRecipient(null); setGiftMemberQuery(''); }}><X size={14} /></button></div>}
        {giftProduct.id === 'special-role' && <label className="gift-id-field gift-description-field"><span>İstenen özel rolü açıkla</span><textarea data-testid="gift-special-description" value={giftSpecialDescription} onChange={(event) => setGiftSpecialDescription(event.target.value)} placeholder="Rol adı, renk ve diğer detaylar..." maxLength={2000} /></label>}
        <div className="gift-delivery-note"><Clock3 size={15} /><span>Yönetici onayından sonra manuel teslim edilir. 30 saat içinde teslim olmazsa coin otomatik iade edilir.</span></div>
        {!session && <p className="purchase-hint">Hediye siparişi için Discord hesabını bağla.</p>}
        <button className="button-primary gift-submit-button" data-testid="submit-gift" disabled={!session || giftSubmitting || maintenance.active || !giftRecipient || giftRecipient.id === String(user.id || '') || balance < giftProduct.price || giftProduct.stock != null && giftProduct.stock < 1 || giftProduct.id === 'special-role' && giftSpecialDescription.trim().length < 5} onClick={() => void submitGift()}>{giftSubmitting ? 'İstek iletiliyor…' : maintenance.active ? 'Mağaza bakımda' : balance < giftProduct.price ? 'Yetersiz coin' : 'Hediye isteğini gönder'}<Gift size={17} /></button>
        <button className="modal-cancel" data-testid="cancel-gift" disabled={giftSubmitting} onClick={() => setGiftProduct(null)}>Vazgeç</button>
      </section>
    </div>}
    {maintenance.active && <div className="maintenance-overlay" role="dialog" aria-modal="true"><div className="maintenance-card"><span><LockKeyhole size={25} /></span><p className="eyebrow">FR FAMILY</p><h2>Mağaza bakımda</h2><p>{maintenance.message || 'Mağaza üzerinde kısa bir çalışma yapılıyor. Lütfen daha sonra tekrar deneyin.'}</p><small>Bu sırada sipariş ve ödeme işlemleri kullanılamaz.</small></div></div>}
    {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}<button aria-label="Bildirimi kapat" onClick={() => setToast('')}><X size={14} /></button></div>}
  </main>;
}

function EmptyState({ title, description, Icon }: { title: string; description: string; Icon: typeof Package }) {
  return <div className="empty-state"><span><Icon size={22} /></span><h2>{title}</h2><p>{description}</p></div>;
}
function LoadingRows() {
  return <div className="loading-rows" aria-label="Yükleniyor"><span /><span /><span /></div>;
}
