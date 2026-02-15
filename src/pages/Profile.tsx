import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Clock3,
  Coins,
  Package,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import OrderDetailModal from '../components/common/OrderDetailModal';
import PageSkeleton from '../components/common/PageSkeleton';
import { useCart } from '../context/CartContext';
import { useFeedback } from '../context/FeedbackContext';

type LedgerRow = {
  order_id: number | null;
  entry_type: 'earn' | 'redeem' | 'expire' | 'adjustment' | 'refund';
  points_delta: number;
  created_at?: string;
  expires_at?: string | null;
};

type SortType = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useFeedback();
  const [orders, setOrders] = useState<any[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrder, setSearchOrder] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function fetchProfileData() {
      setLoading(true);

      const [ordersRes, ledgerRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*, products(*))')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('points_ledger')
          .select('order_id, entry_type, points_delta, created_at')
          .eq('user_id', user!.id),
      ]);

      setOrders(ordersRes.error ? [] : ordersRes.data || []);
      setLedger(ledgerRes.error ? [] : ((ledgerRes.data || []) as LedgerRow[]));

      setLoading(false);
    }

    fetchProfileData();
    const orderChannel = supabase
      .channel(`profile-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, fetchProfileData)
      .subscribe();

    const pointsChannel = supabase
      .channel(`profile-points-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_ledger', filter: `user_id=eq.${user.id}` }, fetchProfileData)
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(pointsChannel);
    };
  }, [user, navigate]);

  const pointsByOrder = useMemo(() => {
    const map = new Map<number, { earned: number; used: number }>();

    for (const row of ledger) {
      if (!row.order_id) continue;
      const current = map.get(row.order_id) || { earned: 0, used: 0 };

      if (row.entry_type === 'earn') current.earned += Math.max(0, row.points_delta || 0);
      else if (row.entry_type === 'redeem') current.used += Math.max(0, Math.abs(row.points_delta || 0));
      else if (row.entry_type === 'refund') {
        if (row.points_delta > 0) current.used = Math.max(0, current.used - row.points_delta);
        else if (row.points_delta < 0) current.earned = Math.max(0, current.earned - Math.abs(row.points_delta));
      }

      map.set(row.order_id, current);
    }

    return map;
  }, [ledger]);

  const { pointsBalance, pointsEarned, pointsUsed, pointsPending } = useMemo(() => {
    const earned = ledger.filter((row) => row.points_delta > 0).reduce((sum, row) => sum + row.points_delta, 0);
    const used = ledger.filter((row) => row.points_delta < 0).reduce((sum, row) => sum + Math.abs(row.points_delta), 0);

    const pending = orders
      .filter((order) => order.status === 'pending')
      .reduce((sum, order) => sum + Math.max(0, Math.floor((order.total_price || 0) * 0.005)), 0);

    return {
      pointsBalance: Math.max(0, earned - used),
      pointsEarned: earned,
      pointsUsed: used,
      pointsPending: pending,
    };
  }, [ledger, orders]);

  const loyaltyTier = useMemo(() => {
    if (pointsEarned >= 5000) return 'Gold';
    if (pointsEarned >= 2000) return 'Silver';
    return 'Bronze';
  }, [pointsEarned]);

  const expiringSoonPoints = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);

    return ledger
      .filter((row) => row.points_delta > 0 && row.created_at)
      .filter((row) => {
        const earnedAt = new Date(row.created_at as string);
        const expiresAt = new Date(earnedAt);
        expiresAt.setDate(expiresAt.getDate() + 90);
        return expiresAt >= now && expiresAt <= sevenDaysFromNow;
      })
      .reduce((sum, row) => sum + row.points_delta, 0);
  }, [ledger]);

  const filteredOrders = useMemo(() => {
    const q = searchOrder.trim().toLowerCase();

    const byFilter = orders.filter((order) => (statusFilter === 'all' ? true : order.status === statusFilter));

    const bySearch = byFilter.filter((order) => {
      if (!q) return true;
      const orderId = String(order.id).toLowerCase();
      const itemText = (order.order_items || [])
        .map((item: any) => item.products?.name || '')
        .join(' ')
        .toLowerCase();
      return orderId.includes(q) || itemText.includes(q);
    });

    const sorted = [...bySearch];
    if (sortBy === 'newest') sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortBy === 'oldest') sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortBy === 'highest') sorted.sort((a, b) => b.total_price - a.total_price);
    if (sortBy === 'lowest') sorted.sort((a, b) => a.total_price - b.total_price);

    return sorted;
  }, [orders, searchOrder, statusFilter, sortBy]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const normalizeSelections = (raw: unknown) => {
    if (!raw) return {} as Record<string, string[]>;

    const parsed = typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : raw;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {} as Record<string, string[]>;

    const result: Record<string, string[]> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        result[key] = value.map((v) => String(v));
      }
    });

    return result;
  };

  const handleBuyAgain = (order: any) => {
    const items = order?.order_items || [];
    if (!items.length) {
      showToast('No items found for this order.', 'info');
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    items.forEach((orderItem: any) => {
      const product = orderItem.products;
      const quantity = Number(orderItem.quantity || 0);

      if (!product || product.is_available === false || quantity < 1) {
        skippedCount += 1;
        return;
      }

      const cartProduct = {
        ...product,
        modifiers: {
          selections: normalizeSelections(orderItem.modifiers),
          notes: orderItem.notes || '',
        },
        modifiersData: Array.isArray((product as any).modifiers) ? (product as any).modifiers : [],
      };

      addToCart(cartProduct as any, quantity);
      addedCount += quantity;
    });

    if (addedCount > 0) {
      showToast(`Added ${addedCount} item(s) to your cart.${skippedCount ? ` ${skippedCount} item(s) unavailable.` : ''}`, 'success');
      navigate('/menu');
      return;
    }

    showToast('Unable to add items because they are unavailable.', 'error');
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 md:px-6 pb-12 text-slate-900">
      <OrderDetailModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} order={selectedOrder} />
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-8 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-serif text-slate-900">My Profile</h1>
            <p className="text-slate-500 text-sm mt-1 break-all">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs uppercase tracking-widest text-red-500 hover:text-red-600 border border-red-200 px-4 py-2 rounded-lg bg-white"
          >
            Log Out
          </button>
        </div>

        <section className="mb-10">
          <h2 className="text-[#C5A572] text-xs uppercase tracking-widest mb-4">My Rewards</h2>

            <div className="grid grid-cols-4 gap-2 md:gap-4">
            <div className="bg-white border border-[#C5A572]/40 rounded-xl p-2.5 md:p-4 shadow-sm min-w-0">
              <p className="text-[9px] md:text-[11px] uppercase tracking-wide md:tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <Wallet size={13} className="text-[#C5A572]" /> Balance
              </p>
              <p className="text-lg md:text-3xl font-serif text-[#9c7a4c]">{pointsBalance}</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-1 leading-tight">1 point = Rp 1 discount at checkout.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2.5 md:p-4 shadow-sm min-w-0">
              <p className="text-[9px] md:text-[11px] uppercase tracking-wide md:tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-500" /> Earned
              </p>
              <p className="text-lg md:text-3xl font-serif text-emerald-600">+{pointsEarned}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2.5 md:p-4 shadow-sm min-w-0">
              <p className="text-[9px] md:text-[11px] uppercase tracking-wide md:tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <TrendingDown size={13} className="text-rose-500" /> Used
              </p>
              <p className="text-lg md:text-3xl font-serif text-rose-600">-{pointsUsed}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 md:p-4 shadow-sm min-w-0">
              <p className="text-[9px] md:text-[11px] uppercase tracking-wide md:tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock3 size={13} className="text-amber-500" /> Pending
              </p>
              <p className="text-lg md:text-3xl font-serif text-amber-600">{pointsPending}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 leading-relaxed shadow-sm space-y-2">
            <p className="flex items-start gap-2">
              <Coins size={15} className="text-[#C5A572] mt-0.5 shrink-0" />
              Pending points are estimated from orders that are still in pending status and move to balance after completion.
            </p>
            <p>
              Loyalty tier: <span className="font-semibold text-slate-900">{loyaltyTier}</span>
              {loyaltyTier === 'Gold' ? ' • 1.20x point multiplier perk unlocked.' : loyaltyTier === 'Silver' ? ' • 1.10x point multiplier perk unlocked.' : ' • Place more orders to unlock Silver and Gold perks.'}
            </p>
            <p>
              {expiringSoonPoints > 0 ? `Heads up: ${expiringSoonPoints} points expire within 7 days.` : 'No points are expiring within 7 days.'}
            </p>
          </div>
        </section>

        <section>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <h2 className="text-[#C5A572] text-xs uppercase tracking-widest">Order History</h2>
            <p className="text-xs text-slate-500">{filteredOrders.length} orders shown</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order ID or item name..."
                value={searchOrder}
                onChange={(e) => setSearchOrder(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#C5A572]"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none w-full md:w-44 pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#C5A572]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="appearance-none w-full md:w-44 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-[#C5A572]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest total</option>
              <option value="lowest">Lowest total</option>
            </select>
          </div>

          {loading ? (
            <PageSkeleton rows={5} />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border border-slate-200 rounded-xl bg-white shadow-sm">
              <Package className="mx-auto mb-3 opacity-50" size={32} />
              <p>No matching orders found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const orderPoints = pointsByOrder.get(order.id) || { earned: 0, used: Math.max(0, order.points_used || 0) };

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 md:p-5 hover:border-slate-300 transition-colors shadow-sm"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                      <div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                          order.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : order.status === 'cancelled'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>{order.status}</span>
                        <p className="text-slate-500 text-xs mt-2">#{order.id} • {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="font-serif text-[#9c7a4c] text-lg">Rp {order.total_price.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs mb-4">
                      <p className="text-slate-500">Points earned: <span className="text-emerald-600 font-medium">+{orderPoints.earned}</span></p>
                      <p className="text-slate-500 sm:text-right">Points used: <span className="text-rose-600 font-medium">-{orderPoints.used}</span></p>
                    </div>
                  <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        View details
                      </button>
                      <button
                        onClick={() => handleBuyAgain(order)}
                        className="px-3 py-2 text-xs rounded-lg bg-[#C5A572] text-black font-semibold hover:bg-[#b18f60]"
                      >
                        Buy Again
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}