import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveGuestOrderAccess } from '../utils/orderAccess';
import { ArrowLeft, Coins, LocateFixed, MapPin, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useFeedback } from '../context/FeedbackContext';
import { checkOrderingAvailability } from '../utils/orderAvailability';
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

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart, cartCount, tableNumber } = useCart();
  const { user } = useAuth();
  const { showToast } = useFeedback();
  const { t } = useLanguage();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'takeaway' | 'dine_in'>(tableNumber ? 'dine_in' : 'takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOrderAvailability, setIsCheckingOrderAvailability] = useState(true);
  const [isOrderingUnavailable, setIsOrderingUnavailable] = useState(false);

  const [promoCode, setPromoCode] = useState('');
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [availablePoints, setAvailablePoints] = useState(0);
  const [useAllPoints, setUseAllPoints] = useState(false);

  useEffect(() => {
    if (!MIDTRANS_CLIENT_KEY) return;

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-midtrans-snap="true"]');
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = MIDTRANS_SNAP_URL;
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
    script.setAttribute('data-midtrans-snap', 'true');
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (tableNumber) {
      setOrderType('dine_in');
    }
  }, [tableNumber]);
  
  useEffect(() => {
    if (cart.length === 0 && !isSubmitting) {
      navigate('/menu', { replace: true });
    }
  }, [cart.length, navigate, isSubmitting]);

  useEffect(() => {
    let mounted = true;

    const verifyOrderingAvailability = async () => {
      setIsCheckingOrderAvailability(true);
      const isAvailable = await checkOrderingAvailability();
      if (!mounted) return;
      setIsOrderingUnavailable(!isAvailable);
      setIsCheckingOrderAvailability(false);
    };

    verifyOrderingAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (user?.email) {
      setCustomerName(user.email.split('@')[0]);
      const phone = (user.user_metadata as any)?.phone || '';
      if (phone) setCustomerPhone(phone);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAvailablePoints(0);  
      return;
    }

    supabase
      .from('profiles')
      .select('points_balance')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAvailablePoints(Math.max(0, Number(data?.points_balance || 0)));
      });
  }, [user]);

  const checkMinQuantity = (promo: any) => {
    if (!promo.min_quantity) return true;

    if (promo.scope === 'order' || promo.scope === 'global') {
      if (cartCount < promo.min_quantity) {
        throw new Error(`Minimum purchase of ${promo.min_quantity} items required.`);
      }
      return true;
    }

    if (promo.scope === 'category') {
      const targetCategory = promo.promotion_targets?.[0]?.target_category;
      const categoryQty = cart
        .filter((item) => item.category === targetCategory)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (categoryQty < promo.min_quantity) {
        throw new Error(`Add at least ${promo.min_quantity} item(s) from ${targetCategory}.`);
      }
      return true;
    }

    if (promo.scope === 'product') {
      const targetProductId = promo.promotion_targets?.[0]?.target_product_id;
      const productQty = cart
        .filter((item) => item.id === targetProductId)
        .reduce((sum, item) => sum + item.quantity, 0);

      if (productQty < promo.min_quantity) {
        throw new Error(`Add at least ${promo.min_quantity} of the required product.`);
      }
      return true;
    }

    return true;
  };

  const calculateDiscount = (promo: any) => {
    const now = new Date();
    if (!promo.is_active) throw new Error('Promotion is no longer active');
    if (new Date(promo.starts_at) > now) throw new Error('Promotion has not started yet');
    if (promo.ends_at && new Date(promo.ends_at) < now) throw new Error('Promotion has expired');
    if (promo.min_order_value && cartTotal < promo.min_order_value) {
      throw new Error(`Minimum order of Rp ${promo.min_order_value.toLocaleString()} required.`);
    }

    checkMinQuantity(promo);

    let eligibleAmount = 0;

    if (promo.scope === 'order' || promo.scope === 'global') {
      eligibleAmount = cartTotal;
    } else if (promo.scope === 'category') {
      const targetCategory = promo.promotion_targets?.[0]?.target_category;
      if (!targetCategory) throw new Error('Invalid promotion category setup.');

      const categoryItems = cart.filter((item) => item.category === targetCategory);
      if (categoryItems.length === 0) throw new Error(`Promotion applies to ${targetCategory} items only.`);

      eligibleAmount = categoryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    } else if (promo.scope === 'product') {
      const targetProductId = promo.promotion_targets?.[0]?.target_product_id;
      if (!targetProductId) throw new Error('Invalid promotion product setup.');

      const productItems = cart.filter((item) => item.id === targetProductId);
      if (productItems.length === 0) throw new Error('Required product is not in cart.');

      eligibleAmount = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    if (promo.type === 'percentage') {
      return Math.floor(eligibleAmount * (promo.value / 100));
    }

    return Math.floor(Math.min(promo.value, eligibleAmount));
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    setIsCheckingPromo(true);
    setPromoError('');
    setDiscountAmount(0);
    setAppliedPromo(null);

    const { data, error } = await supabase
      .from('promotions')
      .select('*, promotion_targets(*)')
      .eq('code', promoCode.toUpperCase())
      .single();

    if (error || !data) {
      setPromoError(t('checkout_invalid_promo'));
      setIsCheckingPromo(false);
      return;
    }

    try {
      const calculated = calculateDiscount(data);
      setDiscountAmount(calculated);
      setAppliedPromo(data);
    } catch (e: any) {
      setPromoError(e.message);
    } finally {
      setIsCheckingPromo(false);
    }
  };

  const pointsToUse = useMemo(() => {
    if (!user || !useAllPoints) return 0;
    return Math.max(0, Math.min(availablePoints, cartTotal - discountAmount));
  }, [user, useAllPoints, availablePoints, cartTotal, discountAmount]);

  const finalTotal = Math.max(0, cartTotal - discountAmount - pointsToUse);
  const estimatedPointsEarned = Math.floor(finalTotal * 0.005);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
    showToast(t('checkout_geo_not_supported'), 'error');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapsLink(`https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const generateOrderId = () => {
    const now = new Date();
    return parseInt(`${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(100 + Math.random() * 900)}`);
  };

  const placeOrder = async () => {
    if (isOrderingUnavailable) {
      showToast(t('common_ordering_unavailable'), 'error');
      return;
    }
    if (!customerName.trim()) {
      showToast(t('checkout_enter_name'), 'error');
      return;
    }
    if (!customerPhone.trim()) {
      showToast(t('checkout_enter_phone'), 'error');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim() && !mapsLink.trim()) {
      showToast(t('checkout_add_address'), 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      let masterOrderId: number | null = null;

      if (orderType === 'dine_in' && tableNumber) {
        const { data: existingOrder, error: fetchError } = await supabase
          .from('orders')
          .select('id')
          .eq('table_number', tableNumber)
          .eq('session_status', 'open')
          .maybeSingle();

        // 1. Actually use the fetchError variable!
        if (fetchError) {
          console.error('Error fetching existing open tab:', fetchError);
          throw new Error('Failed to check open table session. Please try again.');
        }

        if (existingOrder) {
          masterOrderId = existingOrder.id;
        }
      }

      if (!masterOrderId) {
        masterOrderId = generateOrderId();
        const { error: orderError } = await supabase
          .from('orders')
          .insert([
            {
              id: masterOrderId,
              customer_name: customerName,
              customer_phone: customerPhone,
              address: orderType === 'delivery' ? deliveryAddress : null,
              maps_link: orderType === 'delivery' ? mapsLink : null,
              type: orderType,
              table_number: orderType === 'dine_in' ? tableNumber : null,
              session_status: orderType === 'dine_in' ? 'open' : 'closed',
              notes: orderNotes || null,
              subtotal: cartTotal,
              discount_total: discountAmount + pointsToUse,
              total_price: finalTotal,
              promo_code_used: appliedPromo?.code || null,
              points_used: user ? pointsToUse : 0,
              status: 'pending',
              user_id: user?.id || null,
            },
          ]);

        if (orderError) throw orderError;
      }

      saveGuestOrderAccess(masterOrderId, customerPhone);

      const orderItemsData = cart.map((item) => ({
        order_id: masterOrderId,
        product_id: item.id,
        price_at_time: item.price,
        quantity: item.quantity,
        notes: item.modifiers?.notes || null,
        modifiers: item.modifiers?.selections || null,
        payment_status: 'unpaid', 
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData)
        .select('id');
      if (itemsError) throw itemsError;

      const paymentTransactionId = `${masterOrderId}-${Date.now()}`;

      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('create-midtrans-transaction', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: {
          transaction_id: paymentTransactionId,
          master_order_id: masterOrderId,
          gross_amount: finalTotal,
          customer_name: customerName,
          customer_phone: customerPhone,
        },
      });

      if (edgeError || !edgeData?.token) {
        throw new Error(edgeError?.message || edgeData?.error || 'Failed to retrieve payment token');
      }

      if (!window.snap) throw new Error('Midtrans Snap script is not loaded.');

      window.snap.pay(edgeData.token, {
        onSuccess: async (_result: any) => {
          const createdItemIds = (insertedItems || []).map((item) => item.id);
          const paidBatchId = crypto.randomUUID();

          if (createdItemIds.length > 0) {
            const { error: itemPaidError } = await supabase
              .from('order_items')
              .update({ payment_status: 'paid', batch_id: paidBatchId })
              .in('id', createdItemIds);
            if (itemPaidError) {
              console.error('Failed to mark just-paid items as paid:', itemPaidError);
            }
          }

          const { error: paymentStatusError } = await supabase
            .from('payments')
            .update({ status: 'paid' })
            .eq('midtrans_transaction_id', paymentTransactionId);
          if (paymentStatusError) {
            console.error('Failed to set payment status to paid:', paymentStatusError);
          }

          const { error: orderStatusError } = await supabase
            .from('orders')
            .update({ status: orderType === 'dine_in' ? 'active' : 'paid' })
            .eq('id', masterOrderId);
          if (orderStatusError) {
            console.error('Failed to update order status after payment success:', orderStatusError);
          }
          
          showToast(t('checkout_payment_success'), 'success');
          clearCart();
          navigate(`/orders/${masterOrderId}`, { replace: true });
        },
        onPending: (_result: any) => {
          showToast(t('checkout_payment_waiting'), 'info');
          clearCart();
          navigate(`/orders/${masterOrderId}`, { replace: true });
        },
        onError: async (_result: any) => {
          showToast(t('checkout_payment_failed'), 'error');
          setIsSubmitting(false);
        },
        onClose: async () => {
          clearCart();
          showToast("Payment paused. You can complete it from the order detail.", 'info');
          navigate(`/orders/${masterOrderId}`, { replace: true });
        }
      });
    } catch (e: any) {
      showToast(`Checkout failed: ${e.message}`, 'error');
      setIsSubmitting(false);
    }
  };

  const getModifierLines = (item: any) => {
    if (!item.modifiersData || !item.modifiers) return [] as { label: string; extra: number }[];

    const lines: { label: string; extra: number }[] = [];

    item.modifiersData.forEach((group: any) => {
      const selectedIds = item.modifiers?.selections?.[group.id] || [];
      if (!selectedIds.length) return;

      const selectedOptions = (group.options || []).filter((opt: any) => selectedIds.includes(opt.id));
      if (!selectedOptions.length) return;

      const names = selectedOptions.map((opt: any) => opt.name).join(', ');
      const extra = selectedOptions.reduce((sum: number, opt: any) => sum + Number(opt.price || 0), 0);

      lines.push({ label: `${group.name}: ${names}`, extra });
    });

    return lines;
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-16">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
          <button onClick={() => navigate('/menu')} className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mb-4">
            <ArrowLeft size={14} /> {t('checkout_back_menu')}
          </button>

          <h1 className="text-2xl font-serif text-slate-900 mb-4">{t('checkout_title')}</h1>

          <div className="space-y-3">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('checkout_your_name')} className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t('checkout_whatsapp')} className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 p-1 mb-2">
              <button type="button" onClick={() => setOrderType('dine_in')} className={`py-2 rounded-lg text-sm ${orderType === 'dine_in' ? 'bg-[#C5A572] text-black font-semibold' : 'text-slate-600'}`}>Dine-In</button>
              <button type="button" onClick={() => setOrderType('takeaway')} className={`py-2 rounded-lg text-sm ${orderType === 'takeaway' ? 'bg-[#C5A572] text-black font-semibold' : 'text-slate-600'}`}>{t('checkout_takeaway')}</button>
              <button type="button" onClick={() => setOrderType('delivery')} className={`py-2 rounded-lg text-sm ${orderType === 'delivery' ? 'bg-[#C5A572] text-black font-semibold' : 'text-slate-600'}`}>{t('checkout_delivery')}</button>
            </div>

            {orderType === 'dine_in' && (
              <div className="space-y-2 mb-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <p className="text-sm font-medium text-amber-900 flex items-center justify-between">
                  <span>Ordering for Table:</span>
                  <span className="text-xl font-bold ml-2">{tableNumber || 'Unknown'}</span>
                </p>
                <p className="text-xs text-amber-700">We will bring your order directly to your table. You can keep ordering here as long as you are seated.</p>
              </div>
            )}

            {orderType === 'delivery' && (
              <div className="space-y-2">
                <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={t('checkout_full_address')} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 min-h-[84px]" />
                <div className="flex gap-2">
                  <input value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} placeholder={t('checkout_maps_link')} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5" />
                  <button type="button" onClick={handleUseCurrentLocation} className="rounded-xl border border-slate-200 px-3 text-sm inline-flex items-center gap-1" disabled={locationLoading}>
                    <LocateFixed size={14} /> {locationLoading ? t('checkout_pinning') : t('checkout_pin')}
                  </button>
                </div>
                {mapsLink && (
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="text-xs text-[#9c7a4c] inline-flex items-center gap-1 hover:underline">
                    <MapPin size={12} /> {t('checkout_view_map')}
                  </a>
                )}
                <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2">
                  {t('checkout_delivery_fee_note')}
                </p>
              </div>
            )}

            <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder={t('checkout_order_notes')} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 min-h-[72px]" />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder={t('checkout_promo_code')} className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5" />
              </div>
              <button type="button" onClick={handleApplyPromo} className="rounded-xl bg-slate-900 text-slate-50 px-4 text-sm font-medium" disabled={isCheckingPromo}>
                {isCheckingPromo ? t('home_checking') : t('checkout_apply')}
              </button>
            </div>
            {!!promoError && <p className="text-xs text-rose-500">{promoError}</p>}

            {user && (
              <button
                type="button"
                onClick={() => setUseAllPoints((v) => !v)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm flex items-center justify-between ${useAllPoints ? 'border-[#C5A572] bg-[#C5A572]/10 text-[#9c7a4c]' : 'border-slate-200 text-slate-600'}`}
              >
                <span className="inline-flex items-center gap-2"><Coins size={14} /> {t('checkout_use_all_points')}</span>
                <span>{useAllPoints ? `On (${pointsToUse})` : `Off • Balance ${availablePoints}`}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 h-fit sticky top-24">
          <h2 className="font-serif text-xl mb-4">{t('checkout_summary')}</h2>
          <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
            {cart.map((item) => {
              const modifierLines = getModifierLines(item);
              const perUnitModifierExtra = modifierLines.reduce((sum, line) => sum + line.extra, 0);
              const baseUnitPrice = Number(item.basePrice ?? item.price - perUnitModifierExtra);

              return (
                <div key={item.cartId} className="text-sm text-slate-700 gap-3 border-b border-slate-100 pb-2">
                  <div className="flex justify-between">
                    <span>{item.name} <span className="text-slate-400">x{item.quantity}</span></span>
                    <span>Rp {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{t('checkout_base')}: Rp {baseUnitPrice.toLocaleString()} / item</p>
                  {modifierLines.map((line, idx) => (
                    <p key={idx} className="text-[11px] text-slate-500">• {line.label} {line.extra > 0 ? `( +Rp ${line.extra.toLocaleString()} )` : ''}</p>
                  ))}
                  {item.modifiers?.notes && <p className="text-[11px] italic text-slate-500">{t('cart_note')}: {item.modifiers.notes}</p>}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
            <div className="flex justify-between"><span className="text-slate-500">{t('checkout_subtotal')}</span><span>Rp {cartTotal.toLocaleString()}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>{t('checkout_promo')}</span><span>-Rp {discountAmount.toLocaleString()}</span></div>}
            {pointsToUse > 0 && <div className="flex justify-between text-emerald-600"><span>{t('checkout_points')}</span><span>-Rp {pointsToUse.toLocaleString()}</span></div>}
            <div className="flex justify-between text-lg font-serif pt-1"><span>{t('checkout_total')}</span><span className="text-[#9c7a4c]">Rp {finalTotal.toLocaleString()}</span></div>
            <p className="text-xs text-slate-500 pt-1">
              {user
                ? `Points earned from this order: +${estimatedPointsEarned} (0.5% of total)`
                : `If you register, you could earn +${estimatedPointsEarned} points from this order (0.5% of total).`}
            </p>
            
          </div>

          {isOrderingUnavailable && (
            <p className="text-xs rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 mt-4">
              {t('checkout_ordering_retry')}
            </p>
          )}

          <button
            onClick={placeOrder}
            disabled={isSubmitting || isCheckingOrderAvailability || isOrderingUnavailable}
            className={`w-full mt-5 rounded-xl font-semibold py-3 ${
              isSubmitting || isCheckingOrderAvailability || isOrderingUnavailable
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#C5A572] text-black hover:bg-[#b18f60]'
            }`}
          >
            {isSubmitting
              ? t('checkout_processing')
              : isCheckingOrderAvailability
                ? t('checkout_checking_service')
                : isOrderingUnavailable
                  ? t('cart_unavailable')
                  : t('checkout_place_order')}
          </button>
        </div>
      </div>
    </div>
  );
}