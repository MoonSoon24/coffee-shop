import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import ProductCard from '../components/menu/ProductCard';
import { useCart } from '../context/CartContext';

const CATEGORIES = ['All', 'Signatures', 'Hot Coffee', 'Iced', 'Tea', 'Pastry'];

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Get cart data to show the mobile floating button
  const { cartCount, cartTotal, setIsCartOpen } = useCart();

  useEffect(() => {
    async function getProducts() {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*');
      if (error) console.error("Error fetching products:", error);
      else setProducts(data as Product[]);
      setLoading(false);
    }
    getProducts();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      
      {/* 1. Spacer for the Main Fixed Navbar (approx 80px) */}
      <div className="h-20 shrink-0" />

      {/* 2. Menu Header & Categories (Sticky) */}
      {/* top-20 ensures it sticks right below the main Navbar */}
      <div className="sticky top-[72px] md:top-[80px] z-30 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/5 px-4 md:px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-end mb-4">
             <div>
                <p className="text-[#C5A572] text-xs uppercase tracking-widest mb-1">Explore</p>
                <h2 className="text-3xl md:text-4xl font-serif text-white">Our Menu</h2>
             </div>
          </div>

          {/* Horizontal Scrollable Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs md:text-sm uppercase tracking-wider transition-all border ${
                  activeCategory === cat 
                    ? 'bg-[#C5A572] text-black border-[#C5A572] font-bold' 
                    : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Product Grid Area */}
      <div className="flex-1 px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto pb-32"> {/* pb-32 adds space for the mobile cart button */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <Loader2 className="animate-spin mb-4 text-[#C5A572]" size={32} />
              <p className="font-serif text-sm">Brewing...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {products
                .filter(item => activeCategory === 'All' || item.category === activeCategory)
                .map(item => <ProductCard key={item.id} item={item} />)
              }

              {/* Empty State */}
              {products.filter(item => activeCategory === 'All' || item.category === activeCategory).length === 0 && (
                 <div className="col-span-full text-center py-20 text-gray-500">
                   <p>No items found in this category.</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Mobile Floating Cart Summary */}
      {/* Only shows if cart has items. Fixed to bottom. */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 w-full px-4 md:hidden z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-[#C5A572] text-black p-4 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex justify-between items-center active:scale-95 transition-transform border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="bg-black text-[#C5A572] text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">
                {cartCount}
              </div>
              <span className="font-serif font-bold text-sm tracking-wide">View Order</span>
            </div>
            <span className="font-bold font-serif text-sm">Rp {cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}
    </div>
  );
}