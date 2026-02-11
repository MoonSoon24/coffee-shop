import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ArrowRight, Coffee, Tag, Loader2, Sparkles, Coins } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import ProductModal from '../menu/ProductModal';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { cart, addToCart, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Promotion states
  const [promoCode, setPromoCode] = useState('');
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Points states
  const [availablePoints, setAvailablePoints] = useState(0);
  const [pointsToUseInput, setPointsToUseInput] = useState('');
  const [pointsToUse, setPointsToUse] = useState(0);
  const [pointsError, setPointsError] = useState('');
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.email) {
      const nameFromEmail = user.email.split('@')[0];
      setCustomerName(nameFromEmail);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAvailablePoints(0);
      setPointsToUse(0);
      setPointsToUseInput('');
      setPointsError('');
      return;
    }

    const fetchPoints = async () => {
      setIsLoadingPoints(true);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('points_balance')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profileData && typeof profileData.points_balance === 'number') {
        setAvailablePoints(Math.max(0, profileData.points_balance));
        setIsLoadingPoints(false);
        return;
      }

      const { data: ledgerData, error: ledgerError } = await supabase
        .from('points_ledger')
        .select('points_delta')
        .eq('user_id', user.id);

      if (ledgerError) {
        console.error('Failed to fetch points from ledger:', ledgerError.message);
        setAvailablePoints(0);
      } else {
        const balance = (ledgerData || []).reduce((sum, row: any) => sum + (row.points_delta || 0), 0);
        setAvailablePoints(Math.max(0, balance));
      }

      setIsLoadingPoints(false);
    };

    fetchPoints();
  }, [user, isCartOpen]);

  useEffect(() => {
    if (cart.length === 0) {
      setAppliedPromo(null);
      setDiscountAmount(0);
      setPromoCode('');
      setPointsToUse(0);
      setPointsToUseInput('');
      setPointsError('');
      return;
    }

    if (appliedPromo) {
      try {
        const discount = calculateDiscount(appliedPromo);
        setDiscountAmount(discount);
      } catch (e) {
        setAppliedPromo(null);
        setDiscountAmount(0);
        setPromoError((e as Error).message);
      }
    }

    const maxAllowedPoints = Math.max(0, Math.min(availablePoints, cartTotal - discountAmount));
    if (pointsToUse > maxAllowedPoints) {
      setPointsToUse(maxAllowedPoints);
      setPointsToUseInput(maxAllowedPoints ? String(maxAllowedPoints) : '');
    }
  }, [cart, cartTotal, cartCount, appliedPromo, availablePoints, discountAmount, pointsToUse]);

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setIsCartOpen(false);
  };

  const checkMinQuantity = (promo: any) => {
    if (!promo.min_quantity) return true;

    if (promo.scope === 'order' || promo.scope === 'global') {
      if (cartCount < promo.min_quantity) {
        throw new Error(`Minimum purchase of ${promo.min_quantity} items required.`);
      }
    } else if (promo.scope === 'category') {
      const targetCategory = promo.promotion_targets?.[0]?.target_category;
      if (targetCategory) {
        const catCount = cart
          .filter((i) => i.category === targetCategory)
          .reduce((sum, i) => sum + i.quantity, 0);

        if (catCount < promo.min_quantity) {
          throw new Error(`Add at least ${promo.min_quantity} items from ${targetCategory}.`);
        }
      }
    } else if (promo.scope === 'product') {
      const targetId = promo.promotion_targets?.[0]?.target_product_id;
      if (targetId) {
        const prodCount = cart
          .filter((i) => i.id === targetId)
          .reduce((sum, i) => sum + i.quantity, 0);

        if (prodCount < promo.min_quantity) {
          throw new Error(`Add at least ${promo.min_quantity} of the required product.`);
        }
      }
    }
    return true;
  };

  const calculateDiscount = (promo: any) => {
    let discount = 0;
    const now = new Date();

    if (!promo.is_active) throw new Error('Promotion is no longer active');
    if (new Date(promo.starts_at) > now) throw new Error('Promotion has not started yet');
    if (promo.ends_at && new Date(promo.ends_at) < now) throw new Error('Promotion has expired');

    if (promo.min_order_value && cartTotal < promo.min_order_value) {
      throw new Error(`Minimum order of Rp ${promo.min_order_value.toLocaleString()} required`);
    }
    checkMinQuantity(promo);

    let eligibleAmount = 0;

    if (promo.scope === 'order' || promo.scope === 'global') {
      eligibleAmount = cartTotal;
    } else if (promo.scope === 'category') {
      const targetCategory = promo.promotion_targets?.[0]?.target_category;
      if (!targetCategory) throw new Error('Invalid promotion configuration');

      const categoryItems = cart.filter((item) => item.category === targetCategory);
      if (categoryItems.length === 0) throw new Error(`Offer applies to ${targetCategory} items only`);

      eligibleAmount = categoryItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    } else if (promo.scope === 'product') {
      const targetProductId = promo.promotion_targets?.[0]?.target_product_id;
      if (!targetProductId) throw new Error('Invalid promotion configuration');

      const productItems = cart.filter((item) => item.id === targetProductId);
      if (productItems.length === 0) throw new Error('Required product not in cart');

      eligibleAmount = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    if (promo.type === 'percentage') {
      discount = eligibleAmount * (promo.value / 100);
    } else {
      discount = promo.value;
      if (discount > eligibleAmount) discount = eligibleAmount;
    }

    return Math.floor(discount);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setIsCheckingPromo(true);
    setPromoError('');
    setDiscountAmount(0);
    setAppliedPromo(null);

    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*, promotion_targets(*)')
        .eq('code', promoCode.toUpperCase())
        .single();

      if (error || !data) {
        setPromoError('Invalid promotion code');
        return;
      }

      try {
        const calculatedDiscount = calculateDiscount(data);
        setDiscountAmount(calculatedDiscount);
        setAppliedPromo(data);
      } catch (validationError: any) {
        setPromoError(validationError.message);
      }
    } catch {
      setPromoError('Error checking promotion');
    } finally {
      setIsCheckingPromo(false);
    }
  };

  const handleApplyPoints = () => {
    if (!user) return;

    const raw = Number(pointsToUseInput);
    const sanitized = Number.isFinite(raw) ? Math.floor(raw) : 0;

    if (sanitized <= 0) {
      setPointsError('Enter points greater than 0.');
      return;
    }

    if (sanitized > availablePoints) {
      setPointsError('You do not have that many points.');
      return;
    }

    const maxAllowedByTotal = Math.max(0, Math.floor(cartTotal - discountAmount));
    if (sanitized > maxAllowedByTotal) {
      setPointsError(`Maximum redeemable right now: ${maxAllowedByTotal} points.`);
      return;
    }

    setPointsToUse(sanitized);
    setPointsError('');
  };

  const clearPointsUsage = () => {
    setPointsToUse(0);
    setPointsToUseInput('');
    setPointsError('');
  };

  const generateOrderId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(100 + Math.random() * 900);

    return parseInt(`${yy}${mm}${dd}${random}`);
  };

  async function handleCheckout() {
    if (isSubmitting) return;

    if (!customerName.trim()) return alert('Please enter your name!');
    if (cart.length === 0) return alert('Cart is empty!');

    setIsSubmitting(true);

    const subtotal = cartTotal;
    const totalDiscount = discountAmount + pointsToUse;
    const finalTotal = Math.max(0, subtotal - totalDiscount);
    const pointsEarned = Math.floor(finalTotal * 0.01);

    const customOrderId = generateOrderId();

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            id: customOrderId,
            customer_name: customerName,
            subtotal,
            discount_total: totalDiscount,
            total_price: finalTotal,
            promo_code_used: appliedPromo ? appliedPromo.code : null,
            points_used: user ? pointsToUse : 0,
            status: 'pending',
            user_id: user ? user.id : null,
          },
        ])
        .select();

      if (orderError) throw orderError;

      const newOrderId = orderData[0].id;

      const orderItemsData = cart.map((item) => ({
        order_id: newOrderId,
        product_id: item.id,
        price_at_time: item.price,
        quantity: item.quantity,
        notes: item.modifiers?.notes || null,
        modifiers: item.modifiers?.selections || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
      if (itemsError) throw itemsError;

      const message = `Halo Kak, saya *${customerName}* mau konfirmasi untuk pesanan dengan nomor #${newOrderId} dengan total Rp ${finalTotal.toLocaleString()}. Terima Kasih!`;

      window.open(`https://wa.me/6287835209375?text=${encodeURIComponent(message)}`, '_blank');

      clearCart();
      setCustomerName('');
      setAppliedPromo(null);
      setDiscountAmount(0);
      setPromoCode('');
      clearPointsUsage();
      setAvailablePoints((prev) => Math.max(0, prev - pointsToUse + pointsEarned));
      setIsCartOpen(false);
    } catch (error: any) {
      alert('Checkout failed: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalDiscount = discountAmount + pointsToUse;
  const finalTotal = Math.max(0, cartTotal - totalDiscount);
  const potentialPoints = Math.floor(finalTotal * 0.01);

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] flex justify-end transition-all duration-500 ${
          isCartOpen ? 'pointer-events-auto visibility-visible' : 'pointer-events-none invisible delay-300'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            isCartOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsCartOpen(false)}
        />

        <div
          className={`relative w-full md:w-[450px] bg-[#141414] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out ${
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#141414]">
            <h2 className="text-xl font-serif text-white">Your Order</h2>
            <button onClick={() => setIsCartOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Coffee size={48} />
                <p className="mt-4 font-serif text-sm">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.cartId} className="flex gap-4 items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                    <img src={item.image_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-serif text-white text-sm truncate">{item.name}</h4>
                    {item.modifiers &&
                      item.modifiersData &&
                      item.modifiersData.map((group: any) => {
                        const selectedIds = item.modifiers?.selections?.[group.id] || [];

                        if (!selectedIds.length) return null;

                        const selectedOptions = group.options
                          .filter((opt: any) => selectedIds.includes(opt.id))
                          .map((opt: any) => opt.name)
                          .join(', ');

                        return (
                          <p key={group.id} className="text-[11px] text-gray-400 mt-1">
                            {group.name}: {selectedOptions}
                          </p>
                        );
                      })}

                    {item.modifiers?.notes && <p className="text-[10px] text-gray-500 italic mt-1">Note: {item.modifiers.notes}</p>}

                    <p className="text-[#C5A572] text-xs mt-0.5">Rp {(item.price * item.quantity).toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => removeFromCart(item.cartId)}
                        className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20 hover:bg-white/10 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-mono w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20 hover:bg-white/10 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button onClick={() => handleEditItem(item)} className="text-[10px] text-[#C5A572] hover:underline mt-2">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 border-t border-white/5 bg-[#1a1a1a] safe-area-bottom">
              <div className="mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="text"
                      placeholder="Promo Code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        setPromoError('');
                      }}
                      disabled={!!appliedPromo}
                      className={`w-full bg-[#141414] border ${promoError ? 'border-red-500/50' : 'border-white/10'} rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-[#C5A572] uppercase placeholder:normal-case`}
                    />
                  </div>
                  {appliedPromo ? (
                    <button
                      onClick={() => {
                        setAppliedPromo(null);
                        setDiscountAmount(0);
                        setPromoCode('');
                      }}
                      className="bg-white/10 hover:bg-white/20 text-gray-300 px-3 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleApplyPromo}
                      disabled={isCheckingPromo || !promoCode}
                      className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      {isCheckingPromo ? <Loader2 className="animate-spin" size={16} /> : 'Apply'}
                    </button>
                  )}
                </div>
                {promoError && <p className="text-red-400 text-xs mt-1.5 ml-1">{promoError}</p>}
                {appliedPromo && <p className="text-green-400 text-xs mt-1.5 ml-1">Promotion applied!</p>}
              </div>

              {user && (
                <div className="mb-5 rounded-lg border border-[#C5A572]/20 bg-[#141414] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs uppercase tracking-widest text-[#C5A572] flex items-center gap-1.5">
                      <Coins size={14} /> Use Points
                    </p>
                    <p className="text-xs text-gray-300">
                      Balance:{' '}
                      {isLoadingPoints ? <span className="text-gray-500">loading...</span> : <span className="font-semibold">{availablePoints}</span>}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="Points to redeem"
                      value={pointsToUseInput}
                      onChange={(e) => {
                        setPointsToUseInput(e.target.value);
                        setPointsError('');
                      }}
                      className={`w-full bg-[#1d1d1d] border ${pointsError ? 'border-red-500/50' : 'border-white/10'} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C5A572]`}
                    />
                    {pointsToUse > 0 ? (
                      <button onClick={clearPointsUsage} className="px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white transition-colors">
                        Reset
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyPoints}
                        className="px-3 rounded-lg bg-[#C5A572] hover:bg-[#d8b683] text-sm text-black font-semibold transition-colors"
                      >
                        Use
                      </button>
                    )}
                  </div>

                  {pointsError && <p className="text-red-400 text-xs mt-1.5">{pointsError}</p>}
                  {pointsToUse > 0 && !pointsError && (
                    <p className="text-green-400 text-xs mt-1.5">{pointsToUse} points applied (−Rp {pointsToUse.toLocaleString()}).</p>
                  )}
                </div>
              )}

              <input
                type="text"
                placeholder="Your Name..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 py-3 mb-6 focus:outline-none focus:border-[#C5A572] text-sm transition-colors text-white"
              />

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-gray-400 text-sm">
                  <span>Subtotal</span>
                  <span>Rp {cartTotal.toLocaleString()}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-green-400 text-sm">
                    <span>Promo discount</span>
                    <span>-Rp {discountAmount.toLocaleString()}</span>
                  </div>
                )}

                {pointsToUse > 0 && (
                  <div className="flex justify-between items-center text-green-400 text-sm">
                    <span>Points used</span>
                    <span>-Rp {pointsToUse.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-xs uppercase tracking-widest text-gray-500">Total</span>
                  <span className="text-xl font-serif text-[#C5A572]">Rp {finalTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                className={`w-full font-bold font-serif py-4 rounded-lg uppercase tracking-widest transition-colors flex justify-center items-center gap-2 mb-4 
                ${isSubmitting ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#C5A572] text-black hover:bg-[#b09366] active:scale-95'}`}
              >
                {isSubmitting ? (
                  <>
                    <span>Processing...</span>
                    <Loader2 size={18} className="animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Order</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="bg-[#141414] border border-[#C5A572]/20 rounded-lg p-3 flex items-center gap-3">
                <div className="bg-[#C5A572]/10 p-2 rounded-full text-[#C5A572]">
                  <Sparkles size={16} />
                </div>
                <div className="flex-1">
                  {user ? (
                    <p className="text-xs text-gray-300">
                      You will earn <span className="text-[#C5A572] font-bold">{potentialPoints} points</span> with this order.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Log in to get <span className="text-[#C5A572] font-bold">{potentialPoints} points</span>.
                      <button
                        onClick={() => {
                          setIsCartOpen(false);
                          navigate('/login');
                        }}
                        className="ml-1 text-white underline decoration-[#C5A572] decoration-1 underline-offset-2 hover:text-[#C5A572]"
                      >
                        Sign Up Now
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingItem && <ProductModal isOpen={true} product={editingItem} onClose={() => setEditingItem(null)} />}
    </>
  );
}