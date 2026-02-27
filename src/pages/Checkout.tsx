import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, LocateFixed, MapPin, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useFeedback } from '../context/FeedbackContext';

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart, cartCount } = useCart();
  const { user } = useAuth();
  const { showToast } = useFeedback();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'takeaway'>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [mapsLink, setMapsLink] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [promoCode, setPromoCode] = useState('');
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [availablePoints, setAvailablePoints] = useState(0);
  const [useAllPoints, setUseAllPoints] = useState(false);

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/menu');
      return;
    }
  }, [cart.length, navigate]);

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
      setPromoError('Invalid promotion code');
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
      showToast('Geolocation not supported.', 'error');
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
    if (isSubmitting) return;
    if (!customerName.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }
    if (!customerPhone.trim()) {
      showToast('Please enter your WhatsApp number.', 'error');
      return;
    }
    if (orderType === 'delivery' && !deliveryAddress.trim() && !mapsLink.trim()) {
      showToast('Please add address or pin your location for delivery.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const customOrderId = generateOrderId();
      const { error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            id: customOrderId,
            customer_name: customerName,
            customer_phone: customerPhone,
            address: orderType === 'delivery' ? deliveryAddress : null,
            maps_link: orderType === 'delivery' ? mapsLink : null,
            type: orderType,
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

      const orderId = customOrderId;
      const orderItemsData = cart.map((item) => ({
        order_id: orderId,
        product_id: item.id,
        price_at_time: item.price,
        quantity: item.quantity,
        notes: item.modifiers?.notes || null,
        modifiers: item.modifiers?.selections || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
      if (itemsError) throw itemsError;

      showToast('Order placed successfully.', 'success');
      clearCart();
      navigate('/menu');
    } catch (e: any) {
      showToast(`Checkout failed: ${e.message}`, 'error');
    } finally {
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
            <ArrowLeft size={14} /> Back to menu
          </button>

          <h1 className="text-2xl font-serif text-slate-900 mb-4">Checkout</h1>

          <div className="space-y-3">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="WhatsApp number" className="w-full rounded-xl border border-slate-200 px-4 py-2.5" />

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-1">
              <button type="button" onClick={() => setOrderType('takeaway')} className={`py-2 rounded-lg text-sm ${orderType === 'takeaway' ? 'bg-[#C5A572] text-black font-semibold' : 'text-slate-600'}`}>Takeaway</button>
              <button type="button" onClick={() => setOrderType('delivery')} className={`py-2 rounded-lg text-sm ${orderType === 'delivery' ? 'bg-[#C5A572] text-black font-semibold' : 'text-slate-600'}`}>Delivery</button>
            </div>

            {orderType === 'delivery' && (
              <div className="space-y-2">
                <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Full address" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 min-h-[84px]" />
                <div className="flex gap-2">
                  <input value={mapsLink} onChange={(e) => setMapsLink(e.target.value)} placeholder="Google Maps link" className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5" />
                  <button type="button" onClick={handleUseCurrentLocation} className="rounded-xl border border-slate-200 px-3 text-sm inline-flex items-center gap-1" disabled={locationLoading}>
                    <LocateFixed size={14} /> {locationLoading ? 'Pinning...' : 'Pin'}
                  </button>
                </div>
                {mapsLink && (
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="text-xs text-[#9c7a4c] inline-flex items-center gap-1 hover:underline">
                    <MapPin size={12} /> View pinned map
                  </a>
                )}
                <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2">
                  Delivery fee is paid by the buyer directly to courier upon delivery.
                </p>
              </div>
            )}

            <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Order notes" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 min-h-[72px]" />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Promo code" className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5" />
              </div>
              <button type="button" onClick={handleApplyPromo} className="rounded-xl bg-slate-900 text-slate-50 px-4 text-sm font-medium" disabled={isCheckingPromo}>
                {isCheckingPromo ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {!!promoError && <p className="text-xs text-rose-500">{promoError}</p>}

            {user && (
              <button
                type="button"
                onClick={() => setUseAllPoints((v) => !v)}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm flex items-center justify-between ${useAllPoints ? 'border-[#C5A572] bg-[#C5A572]/10 text-[#9c7a4c]' : 'border-slate-200 text-slate-600'}`}
              >
                <span className="inline-flex items-center gap-2"><Coins size={14} /> Use all points</span>
                <span>{useAllPoints ? `On (${pointsToUse})` : `Off • Balance ${availablePoints}`}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 h-fit sticky top-24">
          <h2 className="font-serif text-xl mb-4">Order Summary</h2>
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
                  <p className="text-[11px] text-slate-500 mt-1">Base: Rp {baseUnitPrice.toLocaleString()} / item</p>
                  {modifierLines.map((line, idx) => (
                    <p key={idx} className="text-[11px] text-slate-500">• {line.label} {line.extra > 0 ? `( +Rp ${line.extra.toLocaleString()} )` : ''}</p>
                  ))}
                  {item.modifiers?.notes && <p className="text-[11px] italic text-slate-500">Note: {item.modifiers.notes}</p>}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>Rp {cartTotal.toLocaleString()}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Promo</span><span>-Rp {discountAmount.toLocaleString()}</span></div>}
            {pointsToUse > 0 && <div className="flex justify-between text-emerald-600"><span>Points</span><span>-Rp {pointsToUse.toLocaleString()}</span></div>}
            <div className="flex justify-between text-lg font-serif pt-1"><span>Total</span><span className="text-[#9c7a4c]">Rp {finalTotal.toLocaleString()}</span></div>
            <p className="text-xs text-slate-500 pt-1">
              {user
                ? `Points earned from this order: +${estimatedPointsEarned} (0.5% of total)`
                : `If you register, you could earn +${estimatedPointsEarned} points from this order (0.5% of total).`}
            </p>
            
          </div>

          <button onClick={placeOrder} disabled={isSubmitting} className="w-full mt-5 rounded-xl bg-[#C5A572] text-black font-semibold py-3 hover:bg-[#b18f60]">
            {isSubmitting ? 'Processing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}