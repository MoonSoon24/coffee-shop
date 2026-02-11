import { Plus, Settings, Package } from 'lucide-react';
import type { Product } from '../../types';

interface ProductCardProps {
  item: Product;
  onClick?: () => void;
}

export default function ProductCard({ item, onClick }: ProductCardProps) {
  // Calculate original price for bundles to show savings
  // Note: This relies on the fetch query in Menu.tsx including the relations
  const originalPrice = item.is_bundle && (item as any).product_bundles
    ? (item as any).product_bundles.reduce((acc: number, curr: any) => {
        return acc + ((curr.products?.price || 0) * curr.quantity);
      }, 0)
    : 0;

  const hasDiscount = item.is_bundle && originalPrice > item.price;
  const hasModifiers = (item as any).modifiers && (item as any).modifiers.length > 0;
  

  return (
    <div 
      onClick={onClick}
      className="bg-[#1a1a1a]/80 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden flex flex-col h-full touch-manipulation group hover:border-[#C5A572]/50 transition-all duration-300 cursor-pointer"
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img 
          src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'} 
          alt={item.name} 
          className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition-transform duration-500" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent opacity-90" />
        
        {/* Badges */}
        <div className="absolute bottom-2 left-3 flex flex-wrap gap-2">
           <span className="text-[#C5A572] text-[10px] font-serif tracking-widest uppercase bg-black/60 backdrop-blur-sm px-2 py-1 rounded border border-[#C5A572]/20">
             {item.category}
           </span>
           
           {item.is_bundle && (
             <span className="text-black text-[10px] font-bold tracking-widest uppercase bg-[#C5A572] px-2 py-1 rounded shadow-lg flex items-center gap-1">
               <Package size={10} /> Bundle
             </span>
           )}
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-serif text-lg text-white leading-tight group-hover:text-[#C5A572] transition-colors">
            {item.name}
          </h3>
          
          {/* Price Block */}
          <div className="text-right flex flex-col items-end">
            {hasDiscount && (
              <span className="text-xs text-gray-500 line-through decoration-red-500/50 decoration-2">
                Rp {originalPrice.toLocaleString()}
              </span>
            )}
            <span className={`${hasDiscount ? 'text-[#C5A572] font-bold' : 'text-[#C5A572] font-medium'} text-sm whitespace-nowrap`}>
              Rp {item.price.toLocaleString()}
            </span>
          </div>
        </div>
        
        <p className="text-gray-500 text-xs mb-4 font-light leading-relaxed line-clamp-2">
          {item.description || "Premium ingredients, freshly prepared."}
        </p>

        {/* Action Button */}
        <div className="mt-auto">
          <button 
            className={`w-full py-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95
              ${hasModifiers 
                ? 'border-[#C5A572]/30 bg-[#C5A572]/10 text-[#C5A572] group-hover:bg-[#C5A572] group-hover:text-black' 
                : 'border-white/10 bg-white/5 text-white group-hover:bg-[#C5A572] group-hover:text-black group-hover:border-[#C5A572]'
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