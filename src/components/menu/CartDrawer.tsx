import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ArrowRight, Coffee } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import ProductModal from '../menu/ProductModal';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { cart, addToCart, removeFromCart, cartTotal, isCartOpen, setIsCartOpen } = useCart();
  const [editingItem, setEditingItem] = useState<any>(null);

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setIsCartOpen(false);
  };

  const goToCheckout = () => {
    if (cart.length === 0) return;
    setIsCartOpen(false);
    navigate('/checkout');
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] flex justify-end transition-all duration-500 ${
          isCartOpen ? 'pointer-events-auto visibility-visible' : 'pointer-events-none invisible delay-300'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 force-dark-overlay backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
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
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-white">
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
                      <span className="text-xs font-mono w-4 text-center text-white">{item.quantity}</span>
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
            <div className="p-6 border-t border-white/5 bg-[#1a1a1a]">
              <div className="flex justify-between items-center pt-2 mb-4">
                <span className="text-xs uppercase tracking-widest text-gray-500">Subtotal</span>
                <span className="text-xl font-serif text-[#C5A572]">Rp {cartTotal.toLocaleString()}</span>
              </div>

              <button
                onClick={goToCheckout}
                className="w-full font-bold font-serif py-4 rounded-lg uppercase tracking-widest transition-colors flex justify-center items-center gap-2 mb-1 bg-[#C5A572] text-black hover:bg-[#b09366] active:scale-95"
              >
                <span>Checkout</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {editingItem && <ProductModal isOpen={true} product={editingItem} onClose={() => setEditingItem(null)} />}
    </>
  );
}