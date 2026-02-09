import { useState } from 'react';
import { X, Minus, Plus, ArrowRight, Coffee } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../supabaseClient';

export default function CartDrawer() {
  const { cart, addToCart, removeFromCart, clearCart, cartTotal, isCartOpen, setIsCartOpen } = useCart();
  const [customerName, setCustomerName] = useState('');

  // Checkout logic...
  async function handleCheckout() {
    if (!customerName.trim()) return alert("Please enter your name!");
    if (cart.length === 0) return alert("Cart is empty!");

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ customer_name: customerName, total_price: cartTotal, status: 'pending' }])
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

      let message = `Halo Kak, saya *${customerName}* mau pesan (Order #${newOrderId}):%0A%0A`;
      cart.forEach(item => {
        message += `- ${item.name} x${item.quantity} (Rp ${(item.price * item.quantity).toLocaleString()})%0A`;
      });
      message += `%0A*Total: Rp ${cartTotal.toLocaleString()}*%0A%0ATerima Kasih!`;
      
      window.open(`https://wa.me/6282325255305?text=${message}`, "_blank");

      clearCart();
      setCustomerName('');
      setIsCartOpen(false);

    } catch (error: any) {
      alert("Checkout failed: " + error.message);
    }
  }

  return (
    <div 
      className={`fixed inset-0 z-[60] flex justify-end transition-all duration-500 ${
        isCartOpen ? 'pointer-events-auto visibility-visible' : 'pointer-events-none invisible delay-300'
      }`}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          isCartOpen ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Drawer Panel */}
      {/* CHANGED: 'w-full' to 'w-2/3' (covers 66% of screen on mobile) */}
      <div 
        className={`relative w-2/3 md:w-[450px] bg-[#141414] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out ${
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
                {/* Hide image on very small screens if width is too narrow, or keep it */}
                <div className="hidden sm:block w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                  <img src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'} className="w-full h-full object-cover" />
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
            <input 
              type="text" 
              placeholder="Your Name..." 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-transparent border-b border-white/20 py-3 mb-6 focus:outline-none focus:border-[#C5A572] text-sm transition-colors text-white"
            />
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs uppercase tracking-widest text-gray-500">Total</span>
              <span className="text-xl font-serif text-[#C5A572]">Rp {cartTotal.toLocaleString()}</span>
            </div>
            <button 
              onClick={handleCheckout} 
              className="w-full bg-[#C5A572] text-black font-bold font-serif py-4 rounded-lg uppercase tracking-widest hover:bg-[#b09366] transition-colors flex justify-center items-center gap-2 active:scale-95"
            >
              <span>Order</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}