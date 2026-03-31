import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  CircleDollarSign, 
  Copy, 
  ReceiptText, 
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Coffee,
  MessageSquareQuote,
  CreditCard,
  Timer
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { getGuestOrderAccessPhone, hasGuestOrderAccess, normalizeOrderPhone, saveGuestOrderAccess } from '../utils/orderAccess';
import { useLanguage } from '../context/LanguageContext';

declare global {
  interface Window {
    snap: any;
  }
}

const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY as string | undefined;
const IS_MIDTRANS_PRODUCTION = String(import.meta.env.VITE_MIDTRANS_IS_PRODUCTION || 'false') === 'true';
const MIDTRANS_SNAP_URL = IS_MIDTRANS_PRODUCTION
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

type AccessState = 'checking' | 'granted' | 'needs_recovery' | 'not_found';

const getModifierDetails = (item: any) => {
  const selected = item.modifiers || {};
  const groups = item.products?.modifiers || [];

  return Object.entries(selected)
    .map(([groupId, selectedOptionIds]) => {
      const group = groups.find((g: any) => g.id === groupId);
      if (!group) return null;

      const options = (selectedOptionIds as string[])
        .map((optId) => group.options?.find((opt: any) => opt.id === optId))
        .filter(Boolean)
        .map((opt: any) => ({
          name: opt.name,
          price: Number(opt.price || 0),
        }));

      if (options.length === 0) return null;

      return {
        groupName: group.name,
        options,
        extra: options.reduce((sum: number, opt: { name: string; price: number }) => sum + opt.price, 0),
      };
    })
    .filter(Boolean);
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useFeedback();
  const { t } = useLanguage();

  const parsedOrderId = Number(orderId || 0);
  const isInvalidOrderId = !parsedOrderId || Number.isNaN(parsedOrderId);

  const [order, setOrder] = useState<any | null>(null);
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [phoneInput, setPhoneInput] = useState('');
  const [recoveryOrderInput, setRecoveryOrderInput] = useState(orderId || '');
  const [recoveryError, setRecoveryError] = useState('');
  const [recovering, setRecovering] = useState(false);

  const isGuestOrder = !order?.user_id;
  const shouldWarnGuestNavigation = accessState === 'granted' && isGuestOrder;

  const loadOrderWithItems = async (id: number, guestPhone?: string | null) => {
    let orderQuery = supabase
      .from('orders')
      .select('*')
      .eq('id', id);

    if (!user?.id && guestPhone) {
      orderQuery = orderQuery.eq('customer_phone', guestPhone);
    }

    const { data: orderData, error: orderError } = await orderQuery.maybeSingle();
    if (orderError || !orderData) {
      return { data: null, error: orderError || new Error('Order not found') };
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*, products(*)')
      .eq('order_id', id);

    return {
      data: {
        ...orderData,
        order_items: orderItems || [],
      },
      error: null,
    };
  };

  // 1. Initial Fetch
  useEffect(() => {
    if (isInvalidOrderId) return;

    const fetchOrder = async () => {
      setAccessState('checking');
      const savedGuestPhone = getGuestOrderAccessPhone(parsedOrderId);

      const { data, error } = await loadOrderWithItems(parsedOrderId, savedGuestPhone);

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

      if (!data.user_id && savedGuestPhone && normalizeOrderPhone(data.customer_phone || '') === savedGuestPhone) {
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

  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  const handleAutoCancel = async () => {
    if (!order?.id || order.status === 'cancelled') return;
    
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    
    setOrder((prev: any) => ({ ...prev, status: 'cancelled' }));

    showToast("Order cancelled due to payment timeout", "error");
  };

  useEffect(() => {
    if (order?.status?.toLowerCase() !== 'pending' || !order?.created_at) {
      setTimeLeft(null);
      return;
    }

    // const EXPIRY_HOURS = 24;
    // const expiryTime = new Date(order.created_at).getTime() + (EXPIRY_HOURS * 60 * 60 * 1000);

    const EXPIRY_MINUTES = 15;
    const expiryTime = new Date(order.created_at).getTime() + (EXPIRY_MINUTES * 60 * 1000);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiryTime - now;

      if (distance <= 0) {
        clearInterval(interval);
        setTimeLeft("00:00:00");
        handleAutoCancel();
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setTimeLeft(formattedTime);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order?.status, order?.created_at]);

  useEffect(() => {
    if (!order?.id || accessState !== 'granted') return;

    const channel = supabase
      .channel(`public:orders:${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          setOrder((currentOrder: any) => ({
            ...currentOrder,
            ...payload.new,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, accessState]);

  useEffect(() => {
    if (!MIDTRANS_CLIENT_KEY) return;

    let scriptTag = document.querySelector(`script[src="${MIDTRANS_SNAP_URL}"]`);

    if (!scriptTag) {
      const script = document.createElement('script');
      script.src = MIDTRANS_SNAP_URL;
      script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePayNow = () => {
    const token = order?.payment_token; 

    if (!token) {
      console.error("Payment token not found. Please contact support or place a new order.");
      return;
    }

    if (window.snap) {
      window.snap.pay(token, {
        onSuccess: function (result: any) {
          console.log('Payment success:', result);
          window.location.reload(); 
        },
        onPending: function (result: any) {
          console.log('Payment pending:', result);
        },
        onError: function (result: any) {
          console.error('Payment error:', result);
        },
        onClose: function () {
          console.log('User closed the modal again.');
        }
      });
    } else {
      console.error("Midtrans Snap script failed to load.");
    }
  };

  useEffect(() => {
    if (!shouldWarnGuestNavigation) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldWarnGuestNavigation]);

  useEffect(() => {
    if (!shouldWarnGuestNavigation) return;

    const onPopState = () => {
      const shouldLeave = window.confirm(t('order_detail_leave_warning'));

      if (!shouldLeave) {
        window.history.go(1);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [shouldWarnGuestNavigation, t]);

  const handleCopyOrderId = async () => {
    if (!order?.id) return;

    const orderIdText = String(order.id);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(orderIdText);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = orderIdText;
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.focus();
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      showToast(t('order_detail_toast_copied'), 'success');
    } catch {
      showToast(t('order_detail_toast_copy_failed'), 'error');
    }
  };

  const handleBackNavigation = () => {
    if (!shouldWarnGuestNavigation) {
      navigate(user ? '/profile' : '/menu');
      return;
    }

    const shouldLeave = window.confirm(t('order_detail_leave_warning'));
    if (shouldLeave) {
      navigate(user ? '/profile' : '/menu');
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');

    const idToRecover = Number(recoveryOrderInput);
    const normalizedPhone = normalizeOrderPhone(phoneInput);

    if (!idToRecover || !normalizedPhone) {
      setRecoveryError(t('order_detail_err_invalid_input'));
      return;
    }

    setRecovering(true);
    const { data, error } = await loadOrderWithItems(idToRecover);
    setRecovering(false);

    if (error || !data) {
      setRecoveryError(t('order_detail_err_not_found'));
      return;
    }

    if (normalizeOrderPhone(data.customer_phone || '') !== normalizedPhone) {
      setRecoveryError(t('order_detail_err_mismatch'));
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

  // 3. UI Status Configuration
  const statusConfig = useMemo(() => {
    if (!order) return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock, label: t('order_detail_loading') || 'Loading...' };
    
    const status = order.status?.toLowerCase();
    switch(status) {
      case 'completed':
        return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: t('order_status_completed') };
      case 'active':
      case 'processing':
        // Purple/Indigo color to show it is currently being worked on
        return { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Coffee, label: status === 'active' ? t('order_status_active') : t('order_status_processing') };
      case 'paid':
        // Blue color to show payment is confirmed but maybe not started making yet
        return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CircleDollarSign, label: t('order_status_paid') };
      case 'cancelled':
        return { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle, label: t('order_status_cancelled') };
      case 'pending':
      default:
        // Yellow/Amber for waiting on payment/confirmation
        return { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: t('order_status_pending') };
    }
  }, [order, t]);


  if (accessState === 'checking') {
    return <div className="min-h-screen pt-24 px-4 flex items-center justify-center text-slate-500">{t('order_detail_loading')}</div>;
  }

  if (isInvalidOrderId || accessState === 'not_found') {
    return (
      <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-10">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <h1 className="font-serif text-3xl text-slate-900 mb-3">{t('order_detail_not_found_title')}</h1>
          <p className="text-slate-500 mb-8">{t('order_detail_not_found_desc')}</p>
          <Link to="/" className="rounded-full bg-[#C5A572] px-6 py-3 inline-block font-medium text-black hover:bg-[#b18f60] transition-colors">
            {t('order_detail_back_home')}
          </Link>
        </div>
      </div>
    );
  }

  if (accessState !== 'granted' || !order) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-10">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h1 className="font-serif text-3xl text-slate-900 mb-3">{t('order_detail_recover_title')}</h1>
          <p className="text-slate-500 mb-8">{t('order_detail_recover_desc')}</p>

          <form onSubmit={handleRecover} className="space-y-4">
            <input
              value={recoveryOrderInput}
              onChange={(e) => setRecoveryOrderInput(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-5 py-3.5 focus:border-[#C5A572] focus:ring-1 focus:ring-[#C5A572] outline-none transition-all"
              placeholder={t('order_detail_order_id_placeholder')}
            />
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-5 py-3.5 focus:border-[#C5A572] focus:ring-1 focus:ring-[#C5A572] outline-none transition-all"
              placeholder={t('order_detail_phone_placeholder')}
            />
            {recoveryError && <p className="text-sm text-rose-500 px-2">{recoveryError}</p>}
            <button disabled={recovering} className="w-full rounded-full bg-[#C5A572] px-6 py-3.5 font-medium text-black hover:bg-[#b18f60] transition-colors disabled:opacity-50">
              {recovering ? t('order_detail_recovering') : t('order_detail_recover_btn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-12">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <button onClick={handleBackNavigation} className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-2 transition-colors">
          <ArrowLeft size={16} /> {t('order_detail_back')}
        </button>

        {isGuestOrder && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm flex gap-3 items-start shadow-sm">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="leading-relaxed">{t('order_detail_guest_warning')}</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          
          {/* Highlighted Status Banner */}
          <div className={`px-6 py-8 border-b ${statusConfig.color} flex flex-col items-center justify-center text-center transition-colors duration-500`}>
            <StatusIcon size={40} className="mb-3 opacity-80" />
            <p className="text-sm font-medium uppercase tracking-widest opacity-70 mb-1">{t('order_detail_status_label')}</p>
            <h2 className="text-3xl font-serif">{statusConfig.label}</h2>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="font-serif text-2xl text-slate-900">{t('order_detail_order')} #{order.id}</h1>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                    title={t('order_detail_copy')}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-sm text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Customer & Total Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">{t('order_detail_customer')}</p>
                <p className="font-medium text-slate-900 text-lg mb-0.5">{order.customer_name || t('order_detail_guest_customer')}</p>
                <p className="text-sm text-slate-500">{order.customer_phone || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <CircleDollarSign size={14} /> {t('order_detail_total')}
                </p>
                <p className="font-serif text-3xl text-[#9c7a4c]">Rp {Number(order.total_price || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>

            {order.status === 'pending' && order.payment_token && (
              <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center shadow-sm relative overflow-hidden">
                
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20">
                  <div className="h-full bg-amber-400 animate-pulse w-full rounded-full"></div>
                </div>

                <h3 className="text-amber-900 font-serif text-lg mb-2">Awaiting Payment</h3>
                <p className="text-sm text-amber-700 mb-4">
                  It looks like this order hasn't been paid yet. Please complete your payment to process the order.
                </p>

                {timeLeft && (
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200 font-mono font-medium tracking-wider">
                      <Timer size={16} className={timeLeft.startsWith('00:00') ? 'animate-pulse text-rose-600' : ''} />
                      {timeLeft}
                    </div>
                  </div>
                )}

                <button
                  onClick={handlePayNow}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-black uppercase tracking-widest bg-[#C5A572] hover:bg-[#b09366] active:scale-95 transition-all shadow-md inline-flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} />
                  Pay Now
                </button>
              </div>
            )}

            {order.notes && (
              <div className="mb-10 rounded-2xl bg-amber-50/50 p-5 border border-amber-100/50 flex gap-3 items-start">
                <MessageSquareQuote size={20} className="text-[#C5A572] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">{t('order_detail_order_notes')}</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{order.notes}</p>
                </div>
              </div>
            )}
            {!order.notes && <div className="mb-10" />}

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
                <ReceiptText size={18} className="text-[#C5A572]" /> {t('order_detail_items')}
              </h3>
              
              <div className="space-y-4">
                {(order.order_items || []).map((item: any) => {
                  const modifierDetails = getModifierDetails(item);
                  const modifierExtra = modifierDetails.reduce((sum: number, group: any) => sum + Number(group.extra || 0), 0);
                  const unitPrice = Number(item.price_at_time || 0);
                  const basePrice = Math.max(0, unitPrice - modifierExtra);
                  
                  return (
                    <div key={item.id} className="flex justify-between items-start gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-slate-200 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 text-xs font-medium flex items-center justify-center shrink-0">
                            {item.quantity}x
                          </span>
                          <p className="font-medium text-slate-900 text-base">{item.products?.name || t('order_detail_fallback_item')}</p>
                        </div>
                        
                        <p className="text-xs text-slate-500 mb-2 pl-8">{t('order_detail_base')}: Rp {basePrice.toLocaleString('id-ID')}</p>
                        
                        {modifierDetails.length > 0 && (
                          <div className="pl-8 space-y-1.5 border-l-2 border-slate-100 ml-3">
                            {modifierDetails.map((group: any, idx: number) => (
                              <div key={`${group.groupName}-${idx}`}>
                                <p className="text-xs text-slate-600 font-medium">
                                  {group.groupName}
                                </p>
                                {group.options.map((opt: any, optionIdx: number) => (
                                  <p key={`${group.groupName}-${opt.name}-${optionIdx}`} className="text-xs text-slate-500 mt-0.5 flex justify-between">
                                    <span>- {opt.name}</span>
                                    {opt.price > 0 && <span>+Rp {Number(opt.price).toLocaleString('id-ID')}</span>}
                                  </p>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs italic text-slate-500 mt-3 pl-8 bg-slate-50 py-1.5 px-3 rounded-lg inline-block">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 pt-1">
                        <p className="text-base font-semibold text-slate-900">
                          Rp {(unitPrice * Number(item.quantity || 0)).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {(order.order_items || []).length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">{t('order_detail_no_items')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}