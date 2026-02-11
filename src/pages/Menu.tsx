import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import ProductCard from '../components/menu/ProductCard';
import ProductModal from '../components/menu/ProductModal'; // Import the new modal
import { useCart } from '../context/CartContext';

const CATEGORIES = ['All', 'Bundles', 'Signatures', 'Hot Coffee', 'Iced', 'Tea', 'Pastry'];

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState<boolean>(true);
  
  // New State for the Modifier Page
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const { cartCount, cartTotal, setIsCartOpen } = useCart();

  useEffect(() => {
    async function getProducts() {
      setLoading(true);
      // UPDATED QUERY: We must fetch product_bundles relations to show the "Strikethrough" price
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_bundles:product_bundles!parent_product_id (
            quantity,
            products:products!child_product_id (price)
          )
        `)
        .eq('is_available', true)
        .order('name');
        
      if (error) console.error("Error fetching products:", error);
      else setProducts(data as Product[]);
      setLoading(false);
    }
    getProducts();
  }, []);

  const filteredProducts = products.filter(item => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'Bundles') return item.is_bundle;
    return item.category === activeCategory;
  });

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      
      {/* MODIFIER MODAL */}
      <ProductModal 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        product={selectedProduct} 
      />

      <div className="h-20 shrink-0" />

      {/* Menu Header */}
      <div className="sticky top-[72px] md:top-[80px] z-30 bg-[#0f0f0f]/95 backdrop-blur-sm border-b border-white/5 px-4 md:px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-end mb-4">
             <div>
                <p className="text-[#C5A572] text-xs uppercase tracking-widest mb-1">Explore</p>
                <h2 className="text-3xl md:text-4xl font-serif text-white">Our Menu</h2>
             </div>
          </div>

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

      {/* Product Grid */}
      <div className="flex-1 px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <Loader2 className="animate-spin mb-4 text-[#C5A572]" size={32} />
              <p className="font-serif text-sm">Brewing...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
              {filteredProducts.map(item => (
                <ProductCard 
                  key={item.id} 
                  item={item} 
                  onClick={() => setSelectedProduct(item)} // Opens the modal
                />
              ))}

              {filteredProducts.length === 0 && (
                 <div className="col-span-full text-center py-20 text-gray-500">
                   <p>No items found in this category.</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cart Button */}
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