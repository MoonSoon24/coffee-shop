import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Circle, CheckSquare } from 'lucide-react';
import type { Product } from '../../types';
import { useFeedback } from '../../context/FeedbackContext';

export type ModifierOption = {
  id: string;
  name: string;
  price: number;
};

export type ProductModifier = {
  id: string;
  name: string;
  isRequired: boolean;
  type: 'single' | 'multi';
  options: ModifierOption[];
};

interface ModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSave: (productId: number, modifiers: ProductModifier[]) => Promise<void>;
}

export default function ModifierModal({ isOpen, onClose, product, onSave }: ModifierModalProps) {
  const [modifiersList, setModifiersList] = useState<ProductModifier[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useFeedback();

  // Load initial modifiers when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setModifiersList((product as any).modifiers || []);
    }
  }, [isOpen, product]);

  const addModifierCategory = () => {
    const newCategory: ProductModifier = {
      id: Date.now().toString(),
      name: 'New Category (e.g. Sugar)',
      isRequired: true,
      type: 'single',
      options: []
    };
    setModifiersList([...modifiersList, newCategory]);
  };

  const updateModifierCategory = (id: string, field: keyof ProductModifier, value: any) => {
    setModifiersList(modifiersList.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addOptionToCategory = (categoryId: string) => {
    setModifiersList(modifiersList.map(m => {
      if (m.id === categoryId) {
        return {
          ...m,
          options: [...m.options, { id: Date.now().toString(), name: 'Option Name', price: 0 }]
        };
      }
      return m;
    }));
  };

  const updateOption = (categoryId: string, optionId: string, field: keyof ModifierOption, value: any) => {
    setModifiersList(modifiersList.map(m => {
      if (m.id === categoryId) {
        const newOptions = m.options.map(opt => opt.id === optionId ? { ...opt, [field]: value } : opt);
        return { ...m, options: newOptions };
      }
      return m;
    }));
  };

  const removeOption = (categoryId: string, optionId: string) => {
    setModifiersList(modifiersList.map(m => {
      if (m.id === categoryId) {
        return { ...m, options: m.options.filter(o => o.id !== optionId) };
      }
      return m;
    }));
  };

  const removeCategory = (categoryId: string) => {
    setModifiersList(modifiersList.filter(m => m.id !== categoryId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await onSave(product.id, modifiersList);
        onClose();
    } catch (error) {
        console.error(error);
        showToast("Failed to save modifiers", "error");
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 force-dark-overlay backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#141414] rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings size={20} className="text-[#C5A572]" />
              Manage Add-ons
            </h2>
            <p className="text-sm text-gray-400">Configuring for: <span className="text-[#C5A572]">{product.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Modal Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {modifiersList.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-xl">
              <p className="text-gray-500 mb-4">No modifiers configured for this product.</p>
              <button onClick={addModifierCategory} className="bg-[#C5A572]/20 text-[#C5A572] px-4 py-2 rounded-lg hover:bg-[#C5A572]/30 font-medium transition-colors">
                + Add First Category
              </button>
            </div>
          ) : (
            modifiersList.map((category) => (
              <div key={category.id} className="bg-black/20 border border-white/10 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                
                {/* Category Header Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-4 pb-4 border-b border-white/5">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">Category Name</label>
                    <input 
                      value={category.name}
                      onChange={(e) => updateModifierCategory(category.id, 'name', e.target.value)}
                      className="w-full bg-transparent border-b border-white/20 focus:border-[#C5A572] outline-none text-white font-medium py-1"
                      placeholder="e.g. Sugar Level"
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 cursor-pointer"
                         onClick={() => updateModifierCategory(category.id, 'isRequired', !category.isRequired)}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${category.isRequired ? 'bg-[#C5A572] border-[#C5A572]' : 'border-gray-500'}`}>
                        {category.isRequired && <X size={10} className="text-black rotate-45" />} 
                      </div>
                      <span className={`text-sm ${category.isRequired ? 'text-white' : 'text-gray-500'}`}>Required</span>
                    </div>

                    <div className="flex bg-black p-1 rounded-lg border border-white/10">
                      <button 
                        onClick={() => updateModifierCategory(category.id, 'type', 'single')}
                        className={`px-3 py-1 rounded text-xs transition-colors ${category.type === 'single' ? 'bg-[#C5A572] text-black font-bold' : 'text-gray-400 hover:text-white'}`}
                      >
                        Single (Radio)
                      </button>
                      <button 
                        onClick={() => updateModifierCategory(category.id, 'type', 'multi')}
                        className={`px-3 py-1 rounded text-xs transition-colors ${category.type === 'multi' ? 'bg-[#C5A572] text-black font-bold' : 'text-gray-400 hover:text-white'}`}
                      >
                        Multi (Check)
                      </button>
                    </div>
                    
                    <button onClick={() => removeCategory(category.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Options List */}
                <div className="space-y-2 pl-4 border-l-2 border-white/5">
                  {category.options.map((option) => (
                    <div key={option.id} className="flex items-center gap-3 group">
                      {category.type === 'single' ? <Circle size={14} className="text-gray-600"/> : <CheckSquare size={14} className="text-gray-600"/>}
                      
                      <input 
                        value={option.name}
                        onChange={(e) => updateOption(category.id, option.id, 'name', e.target.value)}
                        className="flex-1 bg-transparent border-b border-transparent group-hover:border-white/20 focus:border-[#C5A572] outline-none text-sm text-gray-300 focus:text-white py-1 transition-colors"
                        placeholder="Option Name"
                      />
                      
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">+Rp</span>
                        <input 
                          type="number"
                          value={option.price}
                          onChange={(e) => updateOption(category.id, option.id, 'price', parseInt(e.target.value))}
                          className="w-20 bg-transparent border-b border-transparent group-hover:border-white/20 focus:border-[#C5A572] outline-none text-sm text-[#C5A572] text-right py-1 transition-colors"
                        />
                      </div>

                      <button onClick={() => removeOption(category.id, option.id)} className="text-gray-600 hover:text-red-500 transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => addOptionToCategory(category.id)}
                    className="text-xs text-gray-500 hover:text-[#C5A572] flex items-center gap-1 mt-2 py-1"
                  >
                    <Plus size={12} /> Add Option
                  </button>
                </div>

              </div>
            ))
          )}
          
          {modifiersList.length > 0 && (
             <button onClick={addModifierCategory} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-[#C5A572]/50 hover:bg-[#C5A572]/5 transition-all flex items-center justify-center gap-2">
               <Plus size={16} /> Add Another Category
             </button>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#141414] rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-[#C5A572] text-black text-sm font-bold hover:bg-[#b09366] transition-colors shadow-lg shadow-[#C5A572]/20 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}