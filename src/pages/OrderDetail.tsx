import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, ReceiptText, ShieldAlert } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { hasGuestOrderAccess, normalizeOrderPhone, saveGuestOrderAccess } from '../utils/orderAccess';

type AccessState = 'checking' | 'granted' | 'needs_recovery' | 'not_found';

const renderModifierText = (item: any) => {
  const selected = item.modifiers || {};
  const groups = item.products?.modifiers || [];

  return Object.entries(selected)
    .map(([groupId, selectedOptionIds]) => {
      const group = groups.find((g: any) => g.id === groupId);
      if (!group) return null;

      const labels = (selectedOptionIds as string[])
        .map((optId) => group.options?.find((opt: any) => opt.id === optId)?.name)
        .filter(Boolean);

      if (labels.length === 0) return null;
      return `${group.name}: ${labels.join(', ')}`;
    })
    .filter(Boolean);
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const parsedOrderId = Number(orderId || 0);
  const isInvalidOrderId = !parsedOrderId || Number.isNaN(parsedOrderId);

  const [order, setOrder] = useState<any | null>(null);
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [phoneInput, setPhoneInput] = useState('');
  const [recoveryOrderInput, setRecoveryOrderInput] = useState(orderId || '');
  const [recoveryError, setRecoveryError] = useState('');
  const [recovering, setRecovering] = useState(false);

  const isGuestOrder = !order?.user_id;

  useEffect(() => {
    if (isInvalidOrderId) return;

    const fetchOrder = async () => {
      setAccessState('checking');
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .eq('id', parsedOrderId)
        .maybeSingle();

      if (error || !data) {
        setOrder(null);
        setAccessState('not_found');
        return;
      }

      setOrder(data);

      if (data.user_id && user?.id === data.user_id) {
        setAccessState('granted');
        return;
      }

      if (hasGuestOrderAccess(data.id, data.customer_phone || '')) {
        setAccessState('granted');
        return;
      }

      if (data.user_id && user?.id !== data.user_id) {
        setAccessState('needs_recovery');
        return;
      }

      setAccessState('needs_recovery');
    };

    fetchOrder();
  }, [isInvalidOrderId, parsedOrderId, user?.id]);

  useEffect(() => {
    if (accessState !== 'granted' || !isGuestOrder) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [accessState, isGuestOrder]);

  const statusTone = useMemo(() => {
    if (!order) return 'bg-slate-100 text-slate-700';
    if (order.status === 'completed' || order.status === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (order.status === 'cancelled') return 'bg-rose-100 text-rose-700';
    return 'bg-amber-100 text-amber-700';
  }, [order]);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');

    const idToRecover = Number(recoveryOrderInput);
    const normalizedPhone = normalizeOrderPhone(phoneInput);

    if (!idToRecover || !normalizedPhone) {
      setRecoveryError('Please enter valid order ID and phone number.');
      return;
    }

    setRecovering(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .eq('id', idToRecover)
      .maybeSingle();
    setRecovering(false);

    if (error || !data) {
      setRecoveryError('Order not found. Please recheck your input.');
      return;
    }

    if (normalizeOrderPhone(data.customer_phone || '') !== normalizedPhone) {
      setRecoveryError('Order ID and phone number do not match.');
      return;
    }



    if (!data.user_id) {
      saveGuestOrderAccess(data.id, data.customer_phone || '');
    }

    setOrder(data);
    setAccessState('granted');

    if (idToRecover !== parsedOrderId) {
      navigate(`/orders/${idToRecover}`);
    }
  };

  if (accessState === 'checking') {
    return <div className="min-h-screen pt-24 px-4">Loading order details...</div>;
  }

  if (isInvalidOrderId || accessState === 'not_found') {
    return (
      <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-10">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h1 className="font-serif text-2xl mb-2">Order not found</h1>
          <p className="text-slate-500 text-sm mb-5">We could not find this order ID.</p>
          <Link to="/" className="rounded-xl bg-[#C5A572] px-4 py-2 inline-block font-semibold text-black">Back to home</Link>
        </div>
      </div>
    );
  }

  if (accessState !== 'granted' || !order) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-10">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6">
          <h1 className="font-serif text-2xl mb-2">Recover your order page</h1>
          <p className="text-sm text-slate-500 mb-5">Enter your order ID and phone number to reopen your order details.</p>

          <form onSubmit={handleRecover} className="space-y-3">
            <input
              value={recoveryOrderInput}
              onChange={(e) => setRecoveryOrderInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5"
              placeholder="Order ID"
            />
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5"
              placeholder="Phone number"
            />
            {recoveryError && <p className="text-xs text-rose-500">{recoveryError}</p>}
            <button disabled={recovering} className="rounded-xl bg-[#C5A572] px-4 py-2.5 font-semibold text-black">
              {recovering ? 'Recovering...' : 'Recover order'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-10">
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => navigate(user ? '/profile' : '/menu')} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back
        </button>

        {isGuestOrder && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm flex gap-2 items-start">
            <ShieldAlert size={16} className="mt-0.5" />
            <p>
              This is a guest order page. Please keep this page URL and stay on this page if possible. If closed, you can recover it using order ID and phone number.
            </p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#C5A572]">Order detail</p>
              <h1 className="font-serif text-2xl text-slate-900">Order #{order.id}</h1>
              <p className="text-xs text-slate-500 mt-1">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-[11px] px-2.5 py-1 rounded-full uppercase font-bold ${statusTone}`}>{order.status}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Customer</p>
              <p className="font-medium text-slate-800">{order.customer_name || 'Guest customer'}</p>
              <p className="text-xs text-slate-500">{order.customer_phone || '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1 inline-flex items-center gap-1"><CircleDollarSign size={14} /> Total</p>
              <p className="font-serif text-xl text-[#9c7a4c]">Rp {Number(order.total_price || 0).toLocaleString()}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 inline-flex items-center gap-1"><ReceiptText size={14} /> Items</p>
            <div className="space-y-2">
              {(order.order_items || []).map((item: any) => {
                const modifiers = renderModifierText(item);
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.products?.name || 'Item'}</p>
                      <p className="text-xs text-slate-500 mt-1">Quantity: {item.quantity}</p>
                      {modifiers.length > 0 && modifiers.map((line, idx) => <p key={idx} className="text-[11px] text-slate-500">• {line}</p>)}
                      {item.notes && <p className="text-[11px] italic text-slate-500 mt-1">Note: {item.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-700 shrink-0">Rp {Number(item.price_at_time || 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}