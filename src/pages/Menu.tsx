import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import ProductCard from '../components/menu/ProductCard';
import ProductModal from '../components/menu/ProductModal';
import { useCart } from '../context/CartContext';

const CATEGORIES = ['All', 'Bundles', 'Signatures', 'Hot Coffee', 'Iced', 'Tea', 'Pastry'];

type SortOption = 'name-asc' | 'price-asc' | 'price-desc' | 'popular';

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { cartCount, cartTotal, setIsCartOpen } = useCart();

  useEffect(() => {
    async function getProducts() {
      setLoading(true);
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

      if (error) console.error('Error fetching products:', error);
      else setProducts(data as Product[]);
      setLoading(false);
    }
    getProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchQuery.trim().toLowerCase();

    const categoryFiltered = products.filter((item) => {
      if (activeCategory === 'All') return true;
      if (activeCategory === 'Bundles') return !!item.is_bundle;
      return item.category === activeCategory;
    });

    const searchFiltered = categoryFiltered.filter((item) => {
      if (!lowerSearch) return true;
      const inName = item.name.toLowerCase().includes(lowerSearch);
      const inDesc = (item.description || '').toLowerCase().includes(lowerSearch);
      const inCategory = (item.category || '').toLowerCase().includes(lowerSearch);
      return inName || inDesc || inCategory;
    });

    const sorted = [...searchFiltered];
    if (sortBy === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') sorted.sort((a, b) => b.price - a.price);

    return sorted;
  }, [products, activeCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] flex flex-col text-slate-900">
      <ProductModal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} product={selectedProduct} />

      <div className="h-20 shrink-0" />

      <div className="sticky top-[72px] md:top-[80px] z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[#C5A572] text-xs uppercase tracking-widest mb-1">Explore</p>
              <h2 className="text-2xl md:text-4xl font-serif text-slate-900">Our Menu</h2>
            </div>
            <p className="text-xs text-slate-500">{filteredProducts.length} items</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drink, pastry, category..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#C5A572]"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none w-full md:w-56 pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#C5A572]"
              >
                <option value="popular">Recommended</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs md:text-sm uppercase tracking-wider transition-all border ${
                  activeCategory === cat
                    ? 'bg-[#C5A572] text-black border-[#C5A572] font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-60 text-slate-600">
              <Loader2 className="animate-spin mb-4 text-[#C5A572]" size={32} />
              <p className="font-serif text-sm">Brewing your menu...</p>
            </div>
          ) : (
            <>
              <div className="md:hidden mb-4 text-xs text-slate-500">Tip: tap a card to quickly customize or add.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-6 md:gap-y-8">
                {filteredProducts.map((item) => (
                  <ProductCard key={item.id} item={item} onClick={() => setSelectedProduct(item)} />
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-xl bg-white">
                    <p className="font-medium mb-1">No items found.</p>
                    <p className="text-xs">Try another category, clear search, or change sorting.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-4 left-0 w-full px-4 md:hidden z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-[#C5A572] text-black p-4 rounded-2xl shadow-[0_8px_24px_rgba(17,24,39,0.18)] flex justify-between items-center active:scale-95 transition-transform border border-[#b58e59]"
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