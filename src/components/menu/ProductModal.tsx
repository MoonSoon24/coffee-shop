import { useState, useEffect } from 'react';
import { X, Minus, Plus, Check, ShoppingBag, Package } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import type { Product } from '../../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export default function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const { addToCart, removeFromCart } = useCart();


  // Reset state when product opens
  useEffect(() => {
  if (isOpen && product) {
    setQuantity((product as any).quantity || 1);

    // If editing from cart
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


  // Dynamic Price Calculation
  useEffect(() => {
    if (!product) return;
    
    let addonsTotal = 0;
    const modifierGroups =
        (product as any).modifiersData ||
        (product as any).modifiers ||
        [];

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

  const modifierGroups =
  (product as any).modifiersData ||
  (product as any).modifiers ||
  [];


  // Toggle Logic (Radio vs Checkbox)
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

      // If optional radio → allow deselect
      if (!isRequired && alreadySelected) {
        return { ...prev, [modId]: [] };
      }

      // Otherwise behave like normal radio
      return { ...prev, [modId]: [optId] };
    }

    // Checkbox behavior
    const exists = current.includes(optId);
    const newSelection = exists
      ? current.filter(id => id !== optId)
      : [...current, optId];

    return { ...prev, [modId]: newSelection };
  });
};


  // Validate Required Fields
  const isValid = modifierGroups.every((mod: any) => {
    if (!mod.isRequired) return true;
    const selected = selections[mod.id] || [];
    return selected.length > 0;
  });

  const handleAddToCart = () => {
    if (!isValid) return;

    const finalItem = {
    ...product,
    price: (totalPrice / quantity),
    basePrice: (product as any).basePrice || product.price,
    quantity,
    modifiers: { selections, notes },
    modifiersData: modifierGroups
    };


    if ((product as any).cartId) {
  // Editing existing item
  removeFromCart((product as any).cartId);
}

addToCart(finalItem, quantity);

    onClose();
  };

  return (
  <>
    {/* BACKDROP */}
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    />

    {/* MODAL CONTAINER */}
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
      <div className="bg-[#141414] w-full md:w-[480px] md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-300 border border-white/10">
        {/* Header Image */}
        <div className="relative h-48 md:h-56 shrink-0">
          <img src={product.image_url || 'https://via.placeholder.com/400'} className="w-full h-full object-cover rounded-t-2xl mask-image-b" />
          <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-md hover:bg-black/80 transition-colors">
            <X size={20} />
          </button>
          {product.is_bundle && (
             <div className="absolute bottom-4 left-4 bg-[#C5A572] text-black px-3 py-1 text-xs font-bold uppercase tracking-wider rounded shadow-lg flex items-center gap-1">
               <Package size={12}/> Bundle Deal
             </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-serif text-white">{product.name}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{product.description}</p>
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Modifiers List */}
          {modifierGroups.map((mod: any) => (
            <div key={mod.id} className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{mod.name}</h3>
                {mod.isRequired && <span className="text-[10px] bg-[#C5A572]/20 text-[#C5A572] px-2 py-0.5 rounded border border-[#C5A572]/30">Required</span>}
              </div>

              <div className="grid gap-2">
                {mod.options.map((opt: any) => {
                  const isSelected = (selections[mod.id] || []).includes(opt.id);
                  return (
                    <div 
                      key={opt.id}
                      onClick={() =>toggleSelection(mod.id, opt.id, mod.type === 'single', mod.isRequired )}
                      className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all active:scale-[0.98] ${
                        isSelected ? 'bg-[#C5A572]/10 border-[#C5A572] text-white' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#C5A572] bg-[#C5A572]' : 'border-gray-500'}`}>
                          {isSelected && <Check size={10} className="text-black" />}
                        </div>
                        <span className="text-sm font-medium">{opt.name}</span>
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
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Special Instructions</h3>
            <textarea 
              placeholder="E.g. Extra hot, separate sauce..." 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#C5A572] min-h-[80px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#141414] border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4 bg-white/5 rounded-lg p-1">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded"><Minus size={16}/></button>
                <span className="font-mono text-white w-4 text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/10 rounded"><Plus size={16}/></button>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-lg font-bold text-[#C5A572] font-serif">Rp {totalPrice.toLocaleString()}</p>
             </div>
          </div>

          <button 
            onClick={handleAddToCart}
            disabled={!isValid}
            className={`w-full py-3 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all ${
              isValid ? 'bg-[#C5A572] hover:bg-[#b09366] active:scale-95' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ShoppingBag size={18} />
            {isValid ? 'Add to Cart' : 'Select Required Options'}
          </button>
        </div>
            </div>
    </div>
  </>
);
}