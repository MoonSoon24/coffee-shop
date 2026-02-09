import { Plus, Minus } from 'lucide-react';
import type { Product } from '../../types';
import { useCart } from '../../context/CartContext';

export default function ProductCard({ item }: { item: Product }) {
  const { cart, addToCart, removeFromCart } = useCart();
  const cartItem = cart.find(c => c.id === item.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  return (
    <div className="bg-[#1a1a1a]/80 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden flex flex-col h-full touch-manipulation">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'} 
          alt={item.name} 
          className="object-cover w-full h-full opacity-90" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent opacity-90" />
        <div className="absolute bottom-2 left-3">
           <span className="text-[#C5A572] text-[10px] font-serif tracking-widest uppercase bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
             {item.category}
           </span>
        </div>
      </div>
      
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-serif text-lg text-white leading-tight">{item.name}</h3>
          <span className="text-[#C5A572] font-medium text-sm whitespace-nowrap ml-2">
            Rp {item.price.toLocaleString()}
          </span>
        </div>
        <p className="text-gray-500 text-xs mb-4 font-light leading-relaxed line-clamp-2">
          {item.description || "Premium ingredients, freshly prepared."}
        </p>

        <div className="mt-auto">
          {quantity === 0 ? (
            <button 
              onClick={() => addToCart(item)}
              className="w-full py-3 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-[#C5A572] hover:text-black hover:border-[#C5A572] transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95"
            >
              <Plus size={14} /> Add
            </button>
          ) : (
            <div className="flex items-center justify-between bg-[#C5A572] text-black rounded-lg p-1 animate-in fade-in duration-200">
              <button onClick={() => removeFromCart(item.id)} className="p-2 active:bg-black/10 rounded transition-colors touch-manipulation">
                <Minus size={16} />
              </button>
              <span className="font-bold font-serif text-sm">{quantity}</span>
              <button onClick={() => addToCart(item)} className="p-2 active:bg-black/10 rounded transition-colors touch-manipulation">
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}