import { Heart, Plus, Sparkles, Package, SlidersHorizontal } from 'lucide-react';
import type { Product } from '../../types';

interface ProductCardProps {
  item: Product;
  onClick?: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isMostFavorited?: boolean;
  favoriteCount?: number;
}

export default function ProductCard({
  item,
  onClick,
  isFavorited = false,
  onToggleFavorite,
  isMostFavorited = false,
  favoriteCount = 0,
}: ProductCardProps) {
  const originalPrice =
    item.is_bundle && (item as any).product_bundles
      ? (item as any).product_bundles.reduce((acc: number, curr: any) => {
          return acc + (curr.products?.price || 0) * curr.quantity;
        }, 0)
      : 0;

  const hasDiscount = item.is_bundle && originalPrice > item.price;
  const hasModifiers = (item as any).modifiers && (item as any).modifiers.length > 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex md:flex-col h-full touch-manipulation group hover:border-[#C5A572]/60 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="relative w-28 sm:w-36 md:w-full shrink-0 md:aspect-[4/3] overflow-hidden">
        <img
          src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'}
          alt={item.name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="hidden md:flex absolute top-2 right-2 p-2 rounded-full bg-black/55 text-white hover:text-rose-300 border border-white/20"
            aria-label="Toggle favorite"
          >
            <Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} className={isFavorited ? 'text-rose-300' : ''} />
          </button>
        )}

        <div className="absolute bottom-2 left-2 md:left-3 flex flex-wrap gap-1.5 md:gap-2 max-w-[95%]">
          <span className="hidden md:inline-flex text-white text-[10px] font-semibold tracking-widest uppercase bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20">
            {item.category}
          </span>

          {item.is_bundle && (
            <span className="hidden md:inline-flex text-black text-[10px] font-bold tracking-widest uppercase bg-[#C5A572] px-2 py-1 rounded-full shadow-sm items-center gap-1">
              <Package size={10} /> Bundle
            </span>
          )}

          {item.is_recommended && (
            <span className="text-black text-[8px] md:text-[8px] font-bold tracking-widest uppercase bg-amber-200 px-1 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Sparkles size={10} /> Recommended
            </span>
          )}

          {isMostFavorited && (
            <span className="hidden md:inline-flex text-white text-[10px] font-semibold bg-rose-500/90 px-2 py-1 rounded-full shadow-sm items-center gap-1">
              <Heart size={10} fill="currentColor" /> Most loved {favoriteCount > 0 ? `(${favoriteCount})` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2 md:gap-3">
          <h3 className="font-serif text-base md:text-lg text-slate-900 leading-tight group-hover:text-[#9c7a4c] transition-colors line-clamp-2">
            {item.name}
          </h3>

          <div className="text-right flex flex-col items-end shrink-0">
            {hasDiscount && <span className="text-xs text-slate-400 line-through">Rp {originalPrice.toLocaleString()}</span>}
            <span className={`${hasDiscount ? 'text-[#9c7a4c] font-bold' : 'text-[#9c7a4c] font-semibold'} text-sm whitespace-nowrap`}>
              Rp {item.price.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-slate-500 text-xs mb-3 md:mb-4 font-light leading-relaxed line-clamp-2 md:line-clamp-2">
          {item.description || 'Premium ingredients, freshly prepared.'}
        </p>

        <div className="mt-auto">
          {hasModifiers && (
            <div className="mb-2 flex items-center gap-1.5 text-[#9c7a4c]/90">
              <SlidersHorizontal size={12} />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Customizable</span>
            </div>
          )}
          <button
            className={`w-full py-2.5 md:py-3 rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 text-[11px] md:text-xs uppercase tracking-widest active:scale-[0.98]
              border-[#C5A572]/40 bg-[#C5A572]/10 text-[#9c7a4c] group-hover:bg-[#C5A572] group-hover:text-black'
              }`}
          ><Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}