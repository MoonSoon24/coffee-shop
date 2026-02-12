import { Heart, Plus, Settings, Sparkles, Package } from 'lucide-react';
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
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-full touch-manipulation group hover:border-[#C5A572]/60 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
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
            className="absolute top-2 right-2 p-2 rounded-full bg-black/55 text-white hover:text-rose-300 border border-white/20"
            aria-label="Toggle favorite"
          >
            <Heart size={14} fill={isFavorited ? 'currentColor' : 'none'} className={isFavorited ? 'text-rose-300' : ''} />
          </button>
        )}

        <div className="absolute bottom-2 left-3 flex flex-wrap gap-2">
          <span className="text-white text-[10px] font-semibold tracking-widest uppercase bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20">
            {item.category}
          </span>

          {item.is_bundle && (
            <span className="text-black text-[10px] font-bold tracking-widest uppercase bg-[#C5A572] px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Package size={10} /> Bundle
            </span>
          )}

          {item.is_recommended && (
            <span className="text-black text-[10px] font-bold tracking-widest uppercase bg-amber-200 px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Sparkles size={10} /> Recommended
            </span>
          )}

          {isMostFavorited && (
            <span className="text-white text-[10px] font-semibold bg-rose-500/90 px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Heart size={10} fill="currentColor" /> Most loved {favoriteCount > 0 ? `(${favoriteCount})` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 gap-3">
          <h3 className="font-serif text-lg text-slate-900 leading-tight group-hover:text-[#9c7a4c] transition-colors line-clamp-2">
            {item.name}
          </h3>

          <div className="text-right flex flex-col items-end shrink-0">
            {hasDiscount && <span className="text-xs text-slate-400 line-through">Rp {originalPrice.toLocaleString()}</span>}
            <span className={`${hasDiscount ? 'text-[#9c7a4c] font-bold' : 'text-[#9c7a4c] font-semibold'} text-sm whitespace-nowrap`}>
              Rp {item.price.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-slate-500 text-xs mb-4 font-light leading-relaxed line-clamp-2">
          {item.description || 'Premium ingredients, freshly prepared.'}
        </p>

        <div className="mt-auto">
          <button
            className={`w-full py-3 rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98]
              ${
                hasModifiers
                  ? 'border-[#C5A572]/40 bg-[#C5A572]/10 text-[#9c7a4c] group-hover:bg-[#C5A572] group-hover:text-black'
                  : 'border-slate-200 bg-slate-50 text-slate-700 group-hover:bg-[#C5A572] group-hover:text-black group-hover:border-[#C5A572]'
              }`}
          >
            {hasModifiers ? <Settings size={14} /> : <Plus size={14} />}
            {hasModifiers ? 'Customize' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}