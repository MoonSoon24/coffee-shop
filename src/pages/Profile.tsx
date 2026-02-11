import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  Loader2,
  Package,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type LedgerRow = {
  order_id: number | null;
  entry_type: 'earn' | 'redeem' | 'expire' | 'adjustment' | 'refund';
  points_delta: number;
};

type SortType = 'newest' | 'oldest' | 'highest' | 'lowest';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrder, setSearchOrder] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
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
          .select('order_id, entry_type, points_delta')
          .eq('user_id', user!.id),
      ]);

      if (ordersRes.error) {
        console.error('Failed to load orders:', ordersRes.error.message);
        setOrders([]);
      } else {
        setOrders(ordersRes.data || []);
      }

      if (ledgerRes.error) {
        console.error('Failed to load points ledger:', ledgerRes.error.message);
        setLedger([]);
      } else {
        setLedger((ledgerRes.data || []) as LedgerRow[]);
      }

      setLoading(false);
    }

    fetchProfileData();
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

  const { pointsBalance, pointsEarned, pointsUsed } = useMemo(() => {
    const earned = ledger.filter((row) => row.points_delta > 0).reduce((sum, row) => sum + row.points_delta, 0);
    const used = ledger.filter((row) => row.points_delta < 0).reduce((sum, row) => sum + Math.abs(row.points_delta), 0);

    return {
      pointsBalance: Math.max(0, earned - used),
      pointsEarned: earned,
      pointsUsed: used,
    };
  }, [ledger]);

  const filteredOrders = useMemo(() => {
    const q = searchOrder.trim().toLowerCase();

    const byFilter = orders.filter((order) => {
      if (statusFilter === 'all') return true;
      return order.status === statusFilter;
    });

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

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 md:px-6 pb-12 text-slate-900">
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

          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="bg-white border border-[#C5A572]/40 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <Wallet size={13} className="text-[#C5A572]" /> Balance
              </p>
              <p className="text-3xl font-serif text-[#9c7a4c]">{pointsBalance}</p>
              <p className="text-xs text-slate-500 mt-1">1 point = Rp 1 discount at checkout.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-500" /> Earned
              </p>
              <p className="text-2xl font-serif text-slate-900">{pointsEarned}</p>
              <p className="text-xs text-slate-500 mt-1">From all successful ledger entries.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm sm:col-span-2 md:col-span-1">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                <TrendingDown size={13} className="text-rose-500" /> Used
              </p>
              <p className="text-2xl font-serif text-slate-900">{pointsUsed}</p>
              <p className="text-xs text-slate-500 mt-1">Redeemed / reversed entries included.</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 leading-relaxed shadow-sm">
            <p className="flex items-start gap-2">
              <Coins size={15} className="text-[#C5A572] mt-0.5 shrink-0" />
              Earn points automatically every time you order. To use points, open your cart while signed in and redeem
              any amount up to your balance.
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
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#C5A572]" />
            </div>
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
                  <div key={order.id} className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 hover:border-slate-300 transition-colors shadow-sm">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                      <div>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                            order.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : order.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {order.status}
                        </span>
                        <p className="text-slate-500 text-xs mt-2">#{order.id} • {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="font-serif text-[#9c7a4c] text-lg">Rp {order.total_price.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs mb-4">
                      <p className="text-slate-500">
                        Points earned: <span className="text-emerald-600 font-medium">+{orderPoints.earned}</span>
                      </p>
                      <p className="text-slate-500 sm:text-right">
                        Points used: <span className="text-rose-600 font-medium">-{orderPoints.used}</span>
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {(order.order_items || []).map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm text-slate-700 gap-3">
                          <span className="line-clamp-1">
                            {item.products?.name} <span className="text-slate-400">x{item.quantity}</span>
                          </span>
                          <span className="shrink-0">Rp {(item.price_at_time || 0).toLocaleString()}</span>
                        </div>
                      ))}
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