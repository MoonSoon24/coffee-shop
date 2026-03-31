import { useState, useEffect } from 'react';
import { X, Minus, Plus, Check, ShoppingBag, Package, Heart, Sparkles } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Product } from '../../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isMostFavorited?: boolean;
  favoriteCount?: number;
}

export default function ProductModal({
  isOpen,
  onClose,
  product,
  isFavorited = false,
  onToggleFavorite,
  isMostFavorited = false,
  favoriteCount = 0,
}: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [isAddAnimating, setIsAddAnimating] = useState(false);
  const [flyToCart, setFlyToCart] = useState(false);
  
  // Animation coordinate states
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [cartPos, setCartPos] = useState({ x: 0, y: 0 });
  
  const { addToCart, removeFromCart } = useCart();
  const { t } = useLanguage();

  const getModifierGroups = (value: unknown) => {
    if (!Array.isArray(value)) return [] as any[];
    return value.filter((group: any) => group && typeof group === 'object' && Array.isArray(group.options));
  };

  useEffect(() => {
    if (isOpen && product) {
      setQuantity((product as any).quantity || 1);
      setIsAddAnimating(false);
      setFlyToCart(false);

      if ((product as any).cartId) {
        setSelections((product as any).modifiers?.selections || {});
        setNotes((product as any).modifiers?.notes || '');
      } else {
        setSelections({});
        setNotes('');
      }

      setTotalPrice(((product as any).basePrice ?? product.price));
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (!product) return;

    let addonsTotal = 0;
    const modifierGroups = getModifierGroups((product as any).modifiersData || (product as any).modifiers);

    modifierGroups.forEach((mod: any) => {
      const selectedIds = selections[mod.id] || [];
      selectedIds.forEach(optId => {
        const option = mod.options.find((o: any) => o.id === optId);
        if (option) addonsTotal += option.price;
      });
    });

    const basePrice = (product as any).basePrice ?? product.price;
    setTotalPrice((basePrice + addonsTotal) * quantity);
  }, [selections, quantity, product]);

  if (!isOpen || !product) return null;

  const modifierGroups = getModifierGroups((product as any).modifiersData || (product as any).modifiers);

  const toggleSelection = (
    modId: string,
    optId: string,
    isSingle: boolean,
    isRequired: boolean
  ) => {
    setSelections(prev => {
      const current = prev[modId] || [];

      if (isSingle) {
        const alreadySelected = current.includes(optId);
        if (!isRequired && alreadySelected) {
          return { ...prev, [modId]: [] };
        }
        return { ...prev, [modId]: [optId] };
      }

      const exists = current.includes(optId);
      const newSelection = exists
        ? current.filter(id => id !== optId)
        : [...current, optId];

      return { ...prev, [modId]: newSelection };
    });
  };

  const isValid = modifierGroups.every((mod: any) => {
    if (!mod.isRequired) return true;
    const selected = selections[mod.id] || [];
    return selected.length > 0;
  });

  const handleAddToCart = () => {
    if (!isValid || isAddAnimating) return;

    const finalItem = {
      ...product,
      price: (totalPrice / quantity),
      basePrice: (product as any).basePrice || product.price,
      quantity,
      modifiers: { selections, notes },
      modifiersData: modifierGroups
    };

    // Calculate Modal Start Coordinates
    const modalEl = document.getElementById('product-modal-content');
    if (modalEl) {
      const rect = modalEl.getBoundingClientRect();
      setStartPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setStartPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }

    // Calculate Cart Badge Destination Coordinates
    const cartIcon = document.getElementById('cart-nav-badge') || document.getElementById('cart-nav-icon');
    if (cartIcon) {
      const rect = cartIcon.getBoundingClientRect();
      setCartPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setCartPos({ x: window.innerWidth - 40, y: 30 }); // Safe Fallback
    }

    setIsAddAnimating(true);
    
    // Step 1: Wait 350ms while Modal Shrinks into Dot
    setTimeout(() => setFlyToCart(true), 350); 
    
    // Step 2: Animate flying for 500ms, then finalize context values
    setTimeout(() => {
      if ((product as any).cartId) {
        removeFromCart((product as any).cartId);
      }
      addToCart(finalItem, quantity, { openCart: false });
      setIsAddAnimating(false);
      setFlyToCart(false);
      onClose();
    }, 850);
  };

  return (
    <>
      {/* BACKDROP */}
      <div
        className={`fixed inset-0 z-[80] bg-black/80 force-dark-overlay backdrop-blur-sm transition-opacity duration-300 ${
          isAddAnimating ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={isAddAnimating ? undefined : onClose}
      />

      {/* MODAL CONTAINER */}
      <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center pointer-events-none">
        <div
          id="product-modal-content"
          className={`pointer-events-auto bg-[#141414] w-full md:w-[480px] md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] border border-white/10 transition-all duration-500 origin-center ${
            isAddAnimating ? 'scale-[0.05] opacity-0 rounded-full' : 'animate-in slide-in-from-bottom-10 duration-300 scale-100 opacity-100'
          }`}
        >
          {/* Header Image */}
          <div className="relative h-48 md:h-56 shrink-0">
            <img src={product.image_url || 'https://via.placeholder.com/400'} className="w-full h-full object-cover rounded-t-2xl mask-image-b" />
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className="md:hidden bg-black/50 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                  aria-label="Toggle favorite"
                >
                  <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} className={isFavorited ? 'text-rose-300' : ''} />
                </button>
              )}
              <button onClick={onClose} className="bg-black/50 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/80 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-serif text-white">{product.name}</h2>
              <div className="md:hidden mt-3 flex flex-wrap gap-2">
                {product.is_recommended && (
                  <span className="text-black text-[10px] font-bold tracking-widest uppercase bg-amber-200 px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Sparkles size={10} /> Recommended
                  </span>
                )}
                {product.is_bundle && (
                  <span className="text-black text-[10px] font-bold tracking-widest uppercase bg-[#C5A572] px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Package size={10} /> Bundle
                  </span>
                )}
                {product.category && (
                  <span className="text-white text-[10px] font-semibold tracking-widest uppercase bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20">
                    {product.category}
                  </span>
                )}
                {isMostFavorited && (
                  <span className="text-white text-[10px] font-semibold bg-rose-500/90 px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Heart size={10} fill="currentColor" /> Most loved {favoriteCount > 0 ? `(${favoriteCount})` : ''}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">{product.description}</p>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Modifiers List */}
            {modifierGroups.map((mod: any) => (
              <div key={mod.id} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{mod.name}</h3>
                  {mod.isRequired && <span className="text-[10px] bg-[#C5A572]/20 text-black px-2 py-0.5 rounded border border-[#C5A572]/30">{t('product_modal_required')}</span>}
                </div>

                <div className="grid gap-2">
                  {mod.options.map((opt: any) => {
                    const isSelected = (selections[mod.id] || []).includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => toggleSelection(mod.id, opt.id, mod.type === 'single', mod.isRequired)}
                        className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all active:scale-[0.98] ${
                          isSelected ? 'bg-[#C5A572]/10 border-[#C5A572] text-white' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#C5A572] bg-[#C5A572]' : 'border-gray-500'}`}>
                            {isSelected && <Check size={10} className="text-black" />}
                          </div>
                          <span className="text-sm font-medium text-black">{opt.name}</span>
                        </div>
                        {opt.price > 0 && <span className="text-xs text-[#C5A572] font-mono">+Rp {opt.price.toLocaleString()}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Notes */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('menu_product_note')}</h3>
              <textarea
                placeholder={t('menu_product_note_ph')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-sm text-black focus:outline-none focus:border-[#C5A572] min-h-[80px]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#141414] border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 bg-white/5 rounded-lg p-1">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded"><Minus size={16} /></button>
                <span className="font-mono text-white w-4 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded"><Plus size={16} /></button>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-lg font-bold text-[#C5A572] font-serif">Rp {totalPrice.toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!isValid || isAddAnimating}
              className={`w-full py-3 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all ${
                isValid ? 'bg-[#C5A572] hover:bg-[#b09366] active:scale-95' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ShoppingBag size={18} />
              {isValid ? t('product_modal_add_to_cart') : t('product_modal_required_options')}
            </button>
          </div>
        </div>
      </div>

      {isAddAnimating && (
        <div
          style={{
            top: flyToCart ? `${cartPos.y}px` : `${startPos.y}px`,
            left: flyToCart ? `${cartPos.x}px` : `${startPos.x}px`,
            transform: `translate(-50%, -50%) scale(${flyToCart ? 0.33 : 1})`,
          }}
          className={`fixed z-[120] flex items-center justify-center w-12 h-12 rounded-full bg-[#C5A572] text-black font-bold text-sm shadow-[0_0_30px_rgba(197,165,114,0.6)] pointer-events-none transition-all ease-in-out ${
            flyToCart ? 'duration-500' : 'duration-300 animate-in fade-in zoom-in-50'
          }`}
        >
          +{quantity}
        </div>
      )}
    </>
  );
}