import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ArrowRight, Coffee, Tag, Loader2, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { cart, addToCart, removeFromCart, clearCart, cartTotal, cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState('');
  
  // Promotion States
  const [promoCode, setPromoCode] = useState('');
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Auto-fill name if logged in
  useEffect(() => {
    if (user && user.email) {
      const nameFromEmail = user.email.split('@')[0];
      setCustomerName(nameFromEmail);
    }
  }, [user]);

  // Re-validate promo when cart changes
  useEffect(() => {
    if (cart.length === 0) {
      setAppliedPromo(null);
      setDiscountAmount(0);
      setPromoCode('');
    } else if (appliedPromo) {
      try {
        const discount = calculateDiscount(appliedPromo);
        setDiscountAmount(discount);
      } catch (e) {
        setAppliedPromo(null);
        setDiscountAmount(0);
        setPromoError((e as Error).message);
      }
    }
  }, [cart, cartTotal, cartCount]);

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
          .filter(i => i.category === targetCategory)
          .reduce((sum, i) => sum + i.quantity, 0);
        
        if (catCount < promo.min_quantity) {
          throw new Error(`Add at least ${promo.min_quantity} items from ${targetCategory}.`);
        }
      }
    } else if (promo.scope === 'product') {
      const targetId = promo.promotion_targets?.[0]?.target_product_id;
      if (targetId) {
        const prodCount = cart
          .filter(i => i.id === targetId)
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

    if (!promo.is_active) throw new Error("Promotion is no longer active");
    if (new Date(promo.starts_at) > now) throw new Error("Promotion has not started yet");
    if (promo.ends_at && new Date(promo.ends_at) < now) throw new Error("Promotion has expired");

    if (promo.min_order_value && cartTotal < promo.min_order_value) {
      throw new Error(`Minimum order of Rp ${promo.min_order_value.toLocaleString()} required`);
    }
    checkMinQuantity(promo);

    let eligibleAmount = 0;

    if (promo.scope === 'order' || promo.scope === 'global') {
      eligibleAmount = cartTotal;
    } else if (promo.scope === 'category') {
      const targetCategory = promo.promotion_targets?.[0]?.target_category;
      if (!targetCategory) throw new Error("Invalid promotion configuration");
      
      const categoryItems = cart.filter(item => item.category === targetCategory);
      if (categoryItems.length === 0) throw new Error(`Offer applies to ${targetCategory} items only`);
      
      eligibleAmount = categoryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    } else if (promo.scope === 'product') {
      const targetProductId = promo.promotion_targets?.[0]?.target_product_id;
      if (!targetProductId) throw new Error("Invalid promotion configuration");

      const productItems = cart.filter(item => item.id === targetProductId);
      if (productItems.length === 0) throw new Error("Required product not in cart");

      eligibleAmount = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
        setPromoError("Invalid promotion code");
        return;
      }

      try {
        const calculatedDiscount = calculateDiscount(data);
        setDiscountAmount(calculatedDiscount);
        setAppliedPromo(data);
      } catch (validationError: any) {
        setPromoError(validationError.message);
      }

    } catch (err) {
      setPromoError("Error checking promotion");
    } finally {
      setIsCheckingPromo(false);
    }
  };

  const generateOrderId = () => {
    const now = new Date();
    // Format: YYMMDD
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    // Generate Random Component (3 digits: 100-999)
    const random = Math.floor(100 + Math.random() * 900); 
    
    return parseInt(`${yy}${mm}${dd}${random}`);
  };

  async function handleCheckout() {
    if (!customerName.trim()) return alert("Please enter your name!");
    if (cart.length === 0) return alert("Cart is empty!");

    const subtotal = cartTotal;
    const finalTotal = Math.max(0, subtotal - discountAmount);
    
    // Calculate points to insert
    const pointsEarned = Math.floor(finalTotal * 0.01);
    
    const customOrderId = generateOrderId();

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ 
          id: customOrderId,
          customer_name: customerName, 
          
          subtotal: subtotal,
          discount_total: discountAmount,
          total_price: finalTotal,
          promo_code_used: appliedPromo ? appliedPromo.code : null,
          points_earned: pointsEarned, // Insert points
          
          status: 'pending',
          user_id: user ? user.id : null
        }])
        .select();

      if (orderError) throw orderError;
      
      const newOrderId = orderData[0].id;

      const orderItemsData = cart.map(item => ({
        order_id: newOrderId,
        product_id: item.id,
        price_at_time: item.price,
        quantity: item.quantity 
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
      if (itemsError) throw itemsError;

      // WhatsApp Message - Updated to specific format
      // "saya mau konfirmasi untuk pesanan dengan nomor #(order id) dengan total ...... terima kasih."
      const message = `Halo Kak, saya *${customerName}* mau konfirmasi untuk pesanan dengan nomor #${newOrderId} dengan total Rp ${finalTotal.toLocaleString()}. Terima Kasih!`;
      
      window.open(`https://wa.me/6282325255305?text=${encodeURIComponent(message)}`, "_blank");

      clearCart();
      setCustomerName('');
      setAppliedPromo(null);
      setDiscountAmount(0);
      setPromoCode('');
      setIsCartOpen(false);

    } catch (error: any) {
      alert("Checkout failed: " + error.message);
    }
  }

  const potentialPoints = Math.floor(Math.max(0, cartTotal - discountAmount) * 0.01);

  return (
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
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 -mr-2 text-gray-400 hover:text-white transition-colors"
          >
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
            cart.map(item => (
              <div key={item.cartId} className="flex gap-4 items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <img src={item.image_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif text-white text-sm truncate">{item.name}</h4>
                  <p className="text-[#C5A572] text-xs mt-0.5">Rp {(item.price * item.quantity).toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20 hover:bg-white/10 transition-colors"><Minus size={12} /></button>
                    <span className="text-xs font-mono w-4 text-center">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20 hover:bg-white/10 transition-colors"><Plus size={12} /></button>
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
                    {isCheckingPromo ? <Loader2 className="animate-spin" size={16}/> : 'Apply'}
                  </button>
                )}
              </div>
              {promoError && <p className="text-red-400 text-xs mt-1.5 ml-1">{promoError}</p>}
              {appliedPromo && <p className="text-green-400 text-xs mt-1.5 ml-1">Promotion applied!</p>}
            </div>

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
                  <span>Discount</span>
                  <span>-Rp {discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-xs uppercase tracking-widest text-gray-500">Total</span>
                <span className="text-xl font-serif text-[#C5A572]">
                  Rp {(cartTotal - discountAmount).toLocaleString()}
                </span>
              </div>
            </div>

            <button 
              onClick={handleCheckout} 
              className="w-full bg-[#C5A572] text-black font-bold font-serif py-4 rounded-lg uppercase tracking-widest hover:bg-[#b09366] transition-colors flex justify-center items-center gap-2 active:scale-95 mb-4"
            >
              <span>Order</span>
              <ArrowRight size={18} />
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
  );
}