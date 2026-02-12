import { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Product } from '../types';
import ProductCard from '../components/menu/ProductCard';
import ProductModal from '../components/menu/ProductModal';
import { useCart } from '../context/CartContext';
import PageSkeleton from '../components/common/PageSkeleton';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

type SortOption = 'name-asc' | 'price-asc' | 'price-desc' | 'popular';

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favoriteCounts, setFavoriteCounts] = useState<Record<number, number>>({});
  const [myFavorites, setMyFavorites] = useState<number[]>([]);

  const { cartCount, cartTotal, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const getProductsAndFavorites = async () => {
    setLoading(true);
    const [{ data, error }, favRes] = await Promise.all([
      supabase
        .from('products')
        .select(`
          *,
          product_bundles:product_bundles!parent_product_id (
            quantity,
            products:products!child_product_id (price)
          )
        `)
        .eq('is_available', true)
        .order('name'),
      supabase.from('product_favorites').select('product_id, user_id'),
    ]);

    if (error) console.error('Error fetching products:', error);
    else setProducts(data as Product[]);

    if (!favRes.error) {
      const counts = (favRes.data || []).reduce((acc: Record<number, number>, row: any) => {
        acc[row.product_id] = (acc[row.product_id] || 0) + 1;
        return acc;
      }, {});
      setFavoriteCounts(counts);

      if (user) {
        const mine = (favRes.data || []).filter((r: any) => r.user_id === user.id).map((r: any) => r.product_id);
        setMyFavorites(mine);
      } else setMyFavorites([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    getProductsAndFavorites();
  }, [user]);

  const categories = useMemo(() => {
    const dynamicCategories = Array.from(
      new Set(products.map((item) => item.category).filter((category) => !!category && category !== 'Bundles'))
    ).sort((a, b) => a.localeCompare(b));

    if (products.some((item) => item.is_bundle)) {
      return ['All', 'Bundles', ...dynamicCategories];
    }

    return ['All', ...dynamicCategories];
  }, [products]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [categories, activeCategory]);

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

  const top3FavoriteIds = useMemo(
    () =>
      Object.entries(favoriteCounts)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 3)
        .map(([id]) => Number(id)),
    [favoriteCounts]
  );

  const toggleFavorite = async (productId: number) => {
    if (!user) {
      alert('Please login first to favorite a menu item.');
      navigate('/login');
      return;
    }

    const already = myFavorites.includes(productId);

    if (already) {
      await supabase.from('product_favorites').delete().eq('user_id', user.id).eq('product_id', productId);
    } else {
      await supabase.from('product_favorites').insert([{ user_id: user.id, product_id: productId }]);
    }

    await getProductsAndFavorites();
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] flex flex-col text-slate-900">
      <ProductModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        isFavorited={selectedProduct ? myFavorites.includes(selectedProduct.id) : false}
        onToggleFavorite={selectedProduct ? () => toggleFavorite(selectedProduct.id) : undefined}
        isMostFavorited={selectedProduct ? top3FavoriteIds.includes(selectedProduct.id) : false}
        favoriteCount={selectedProduct ? favoriteCounts[selectedProduct.id] || 0 : 0}
      />

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
            {categories.map((cat) => (
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
            <PageSkeleton rows={8} />
          ) : (
            <>
              <div className="md:hidden mb-4 text-xs text-slate-500">GoFood-style list: swipe categories, then tap a menu card to customize.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-3 md:gap-y-8">
                {filteredProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedProduct(item)}
                    isFavorited={myFavorites.includes(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id)}
                    isMostFavorited={top3FavoriteIds.includes(item.id)}
                    favoriteCount={favoriteCounts[item.id] || 0}
                  />
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