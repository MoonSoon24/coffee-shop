import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, LogOut, RefreshCcw, Megaphone, Power, PowerOff, Calendar, Tag, Percent, DollarSign, Search, X, Edit2 } from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import type { Product, Promotion } from '../types';

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'promotions'>('orders');
  
  // Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Forms State
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', description: '', image_url: '' });
  
  // Promotion Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState({
    code: '',
    description: '',
    type: 'percentage', // 'percentage' | 'fixed_amount'
    value: '',
    scope: 'order', // 'order' | 'category' | 'product'
    min_order_value: '',
    min_quantity: '',
    starts_at: '',
    ends_at: '',
    // Target selections
    target_category: '',
    target_product_id: ''
  });

  // Search State for Promotions
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive: boolean;
    confirmText: string;
  } | null>(null);

  useEffect(() => {
    if (!user) navigate('/login');
    fetchData();

    // Close search dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [user]);

  const fetchData = async () => {
    const { data: ord } = await supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false });
    const { data: prod } = await supabase.from('products').select('*').order('name');
    
    // Fetch promotions with their targets
    const { data: promos } = await supabase
      .from('promotions')
      .select('*, promotion_targets(*)')
      .order('created_at', { ascending: false });
    
    if (ord) setOrders(ord);
    if (promos) setPromotions(promos as Promotion[]);
    if (prod) {
      setProducts(prod);
      const uniqueCats = Array.from(new Set(prod.map((p: any) => p.category))).filter(Boolean) as string[];
      setCategories(uniqueCats.sort());
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // --- GENERIC CONFIRMATION HANDLER ---
  const openConfirm = (title: string, message: string, action: () => Promise<void>, isDestructive = false, confirmText = "Confirm") => {
    setModalConfig({ title, message, action, isDestructive, confirmText });
    setIsModalOpen(true);
  };

  const executeModalAction = async () => {
    if (modalConfig) {
      await modalConfig.action();
      setModalConfig(null);
    }
  };

  // --- PRODUCT ACTIONS ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category) return;

    const { error } = await supabase.from('products').insert([{
      name: newProduct.name,
      price: parseInt(newProduct.price),
      category: newProduct.category,
      description: newProduct.description,
      image_url: newProduct.image_url,
      is_available: true
    }]);

    if (error) alert('Error: ' + error.message);
    else {
      setNewProduct({ name: '', price: '', category: '', description: '', image_url: '' });
      fetchData();
    }
  };

  const toggleProductAvailability = async (id: number, currentStatus: boolean | undefined) => {
    const { error } = await supabase.from('products').update({ is_available: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  // --- PROMOTION ACTIONS ---

  // Helper to format DB date (UTC) to Input datetime-local
  const formatForInput = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const handleEditPromo = (promo: Promotion) => {
    setEditingId(promo.id);
    
    // Extract target info
    let tCat = '';
    let tPid = '';
    if (promo.promotion_targets && promo.promotion_targets.length > 0) {
      if (promo.scope === 'category') tCat = promo.promotion_targets[0].target_category || '';
      if (promo.scope === 'product') tPid = promo.promotion_targets[0].target_product_id?.toString() || '';
    }

    setNewPromo({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value.toString(),
      scope: promo.scope,
      min_order_value: promo.min_order_value?.toString() || '',
      min_quantity: promo.min_quantity?.toString() || '',
      starts_at: formatForInput(promo.starts_at),
      ends_at: formatForInput(promo.ends_at),
      target_category: tCat,
      target_product_id: tPid
    });

    // Populate search term if applicable
    if (promo.scope === 'category') setSearchTerm(tCat);
    if (promo.scope === 'product' && tPid) {
      const prod = products.find(p => p.id === parseInt(tPid));
      if (prod) setSearchTerm(prod.name);
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetPromoForm = () => {
    setEditingId(null);
    setNewPromo({
      code: '', description: '', type: 'percentage', value: '', scope: 'order',
      min_order_value: '', min_quantity: '', starts_at: '', ends_at: '',
      target_category: '', target_product_id: ''
    });
    setSearchTerm('');
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.value) return;

    // Validation
    if (newPromo.scope === 'category' && !newPromo.target_category) {
      alert("Please select a category."); return;
    }
    if (newPromo.scope === 'product' && !newPromo.target_product_id) {
      alert("Please select a product."); return;
    }

    const startDate = newPromo.starts_at ? new Date(newPromo.starts_at).toISOString() : new Date().toISOString();
    const endDate = newPromo.ends_at ? new Date(newPromo.ends_at).toISOString() : null;

    const promoPayload = {
      code: newPromo.code.toUpperCase(),
      description: newPromo.description,
      type: newPromo.type,
      value: parseFloat(newPromo.value),
      scope: newPromo.scope,
      min_order_value: newPromo.min_order_value ? parseFloat(newPromo.min_order_value) : null,
      min_quantity: newPromo.min_quantity ? parseInt(newPromo.min_quantity) : null,
      starts_at: startDate,
      ends_at: endDate,
      is_active: true
    };

    let promoId = editingId;
    let error;

    if (editingId) {
      // UPDATE EXISTING
      const { error: updateError } = await supabase
        .from('promotions')
        .update(promoPayload)
        .eq('id', editingId);
      error = updateError;
    } else {
      // CREATE NEW
      const { data, error: insertError } = await supabase
        .from('promotions')
        .insert([promoPayload])
        .select();
      if (data) promoId = data[0].id;
      error = insertError;
    }

    if (error) {
      alert('Error saving promotion: ' + error.message);
      return;
    }

    // HANDLE TARGETS (Delete old, Insert new)
    if (promoId) {
      // 1. Delete existing targets for this promo
      await supabase.from('promotion_targets').delete().eq('promotion_id', promoId);

      // 2. Insert new targets if scope requires
      if (newPromo.scope !== 'order') {
        const targetData: any = { promotion_id: promoId };
        if (newPromo.scope === 'category') targetData.target_category = newPromo.target_category;
        if (newPromo.scope === 'product') targetData.target_product_id = parseInt(newPromo.target_product_id);
        
        await supabase.from('promotion_targets').insert([targetData]);
      }
    }

    resetPromoForm();
    fetchData();
  };

  const deletePromo = async (id: string) => {
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (!error) fetchData();
    else alert(error.message);
  };

  const togglePromoStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('promotions').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const updateOrderStatus = async (id: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    fetchData();
  };

  // Helper to get formatted Scope Label
  const getScopeLabel = (p: Promotion) => {
    if (p.scope === 'order') return 'Entire Order';
    if (p.scope === 'category') {
      const cat = p.promotion_targets?.[0]?.target_category;
      return cat ? `Category: ${cat}` : 'Specific Category';
    }
    if (p.scope === 'product') {
      const pid = p.promotion_targets?.[0]?.target_product_id;
      const prod = products.find(pr => pr.id === pid);
      return prod ? `Product: ${prod.name}` : 'Specific Product';
    }
    return p.scope;
  };

  // Helper for Filtering Search
  const getFilteredItems = () => {
    if (newPromo.scope === 'category') {
      return categories.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (newPromo.scope === 'product') {
      return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return [];
  };

  return (
    <div className="admin-page">
      <ConfirmModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={executeModalAction}
        title={modalConfig?.title || ''}
        message={modalConfig?.message || ''}
        confirmText={modalConfig?.confirmText}
        isDestructive={modalConfig?.isDestructive}
      />

      <div className="admin-container">
        {/* HEADER */}
        <div className="admin-header">
          <h1 className="admin-title">Admin Dashboard</h1>
          
          <div className="admin-controls">
            <div className="admin-tab-group">
              {[
                { id: 'orders', label: 'Orders' },
                { id: 'products', label: 'Products' },
                { id: 'promotions', label: 'Promotions' }
              ].map((tab) => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button onClick={handleLogout} className="admin-logout-btn">
              <LogOut size={16} />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* --- ORDERS TAB --- */}
        {activeTab === 'orders' && (
          <div className="admin-grid-orders">
            {orders.length === 0 ? (
               <p className="text-gray-500 text-center py-10">No orders found.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="admin-card">
                  <div>
                    <h3 className="text-white font-bold">{order.customer_name} <span className="text-xs font-normal text-gray-500">#{order.id}</span></h3>
                    <p className="text-sm text-gray-400 mb-2">Total: <span className="text-[#C5A572]">Rp {order.total_price.toLocaleString()}</span></p>
                    <ul className="text-sm text-gray-500 space-y-1">
                      {order.order_items.map((item: any) => (
                        <li key={item.id}>- {item.products?.name} (x{item.quantity})</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[120px]">
                    <select 
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="admin-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- PRODUCTS TAB --- */}
        {activeTab === 'products' && (
          <div className="admin-grid-dashboard">
            <div className="admin-sidebar">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2"><Plus size={18}/> Add Product</h3>
              <form onSubmit={handleAddProduct} className="admin-form">
                <input required placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="admin-input" />
                <input required placeholder="Price" type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="admin-input" />
                <div>
                  <input list="category-options" placeholder="Category" required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="admin-input" />
                  <datalist id="category-options">
                    {categories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <textarea placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="admin-input min-h-[80px]" />
                <input placeholder="Image URL" value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} className="admin-input" />
                <button type="submit" className="admin-btn-primary">Add Product</button>
              </form>
            </div>

            <div className="admin-main-content">
              {products.map(product => (
                <div key={product.id} className={`admin-item-card ${!product.is_available ? 'inactive' : ''}`}>
                  <div className="w-20 h-20 bg-gray-800 rounded overflow-hidden shrink-0 relative">
                    <img src={product.image_url || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                    {!product.is_available && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="admin-badge-archived">Archived</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{product.name}</h4>
                    <p className="admin-price">Rp {product.price.toLocaleString()}</p>
                    <p className="admin-category-tag">{product.category}</p>
                  </div>
                  <div className="admin-card-actions">
                    <button 
                      onClick={() => openConfirm(
                        product.is_available ? "Archive Product" : "Restore Product",
                        `Are you sure you want to ${product.is_available ? 'archive' : 'restore'} this product?`,
                        async () => toggleProductAvailability(product.id, product.is_available),
                        product.is_available
                      )}
                      className="action-btn"
                    >
                      {product.is_available ? <Trash2 size={16} /> : <RefreshCcw size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- PROMOTIONS TAB --- */}
        {activeTab === 'promotions' && (
          <div className="admin-grid-dashboard">
            {/* Add/Edit Promotion Form */}
            <div className="admin-sidebar">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2">
                {editingId ? <Edit2 size={18} className="text-[#C5A572]"/> : <Megaphone size={18}/>} 
                {editingId ? 'Edit Promotion' : 'New Promotion'}
              </h3>
              
              <form onSubmit={handleSavePromo} className="admin-form">
                
                {/* Code & Value */}
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    required 
                    placeholder="CODE (e.g. SAVE20)" 
                    value={newPromo.code} 
                    onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} 
                    className="admin-input font-mono uppercase" 
                  />
                  <input 
                    required 
                    type="number"
                    placeholder="Value" 
                    value={newPromo.value} 
                    onChange={e => setNewPromo({...newPromo, value: e.target.value})} 
                    className="admin-input" 
                  />
                </div>

                {/* Type & Scope */}
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={newPromo.type} 
                    onChange={e => setNewPromo({...newPromo, type: e.target.value as any})}
                    className="admin-select"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (Rp)</option>
                  </select>
                  <select 
                    value={newPromo.scope} 
                    onChange={e => {
                      setNewPromo({...newPromo, scope: e.target.value as any, target_category: '', target_product_id: ''});
                      setSearchTerm('');
                    }}
                    className="admin-select"
                  >
                    <option value="order">Entire Order</option>
                    <option value="category">Category</option>
                    <option value="product">Specific Product</option>
                  </select>
                </div>

                {/* DYNAMIC SEARCHABLE TARGET INPUT */}
                {(newPromo.scope === 'category' || newPromo.scope === 'product') && (
                   <div className="relative" ref={searchContainerRef}>
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                       <input 
                         type="text"
                         placeholder={newPromo.scope === 'category' ? "Search Category..." : "Search Product..."}
                         value={searchTerm}
                         onFocus={() => setIsSearchOpen(true)}
                         onChange={e => {
                            setSearchTerm(e.target.value);
                            setIsSearchOpen(true);
                            // Clear selection when typing to ensure valid selection
                            if (newPromo.scope === 'category') setNewPromo({...newPromo, target_category: ''});
                            if (newPromo.scope === 'product') setNewPromo({...newPromo, target_product_id: ''});
                         }}
                         className={`admin-input pl-9 ${(!newPromo.target_category && !newPromo.target_product_id) ? 'border-[#C5A572]' : ''}`}
                       />
                     </div>
                     
                     {/* DROPDOWN RESULTS */}
                     {isSearchOpen && (
                       <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                         {getFilteredItems().length > 0 ? (
                           getFilteredItems().map((item: any) => {
                              const label = newPromo.scope === 'category' ? item : item.name;
                              const isActive = newPromo.scope === 'category' 
                                ? newPromo.target_category === item
                                : newPromo.target_product_id === item.id;

                              return (
                                <div 
                                  key={newPromo.scope === 'category' ? item : item.id}
                                  onClick={() => {
                                    if (newPromo.scope === 'category') {
                                      setNewPromo({...newPromo, target_category: item});
                                      setSearchTerm(item);
                                    } else {
                                      setNewPromo({...newPromo, target_product_id: item.id});
                                      setSearchTerm(item.name);
                                    }
                                    setIsSearchOpen(false);
                                  }}
                                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-white/5 transition-colors ${isActive ? 'bg-[#C5A572]/20 text-[#C5A572]' : 'text-gray-300'}`}
                                >
                                  {label}
                                </div>
                              );
                           })
                         ) : (
                           <div className="px-4 py-2 text-sm text-gray-500">No results found.</div>
                         )}
                       </div>
                     )}
                   </div>
                )}

                <textarea 
                  placeholder="Description" 
                  value={newPromo.description} 
                  onChange={e => setNewPromo({...newPromo, description: e.target.value})} 
                  className="admin-input min-h-[60px]" 
                />

                {/* Dates */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 ml-1">Valid From (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={newPromo.starts_at} 
                    onChange={e => setNewPromo({...newPromo, starts_at: e.target.value})} 
                    className="admin-input text-gray-300" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 ml-1">Valid Until (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="datetime-local" 
                      value={newPromo.ends_at} 
                      onChange={e => setNewPromo({...newPromo, ends_at: e.target.value})} 
                      className="admin-input text-gray-300 flex-1" 
                    />
                    {newPromo.ends_at && (
                      <button 
                        type="button"
                        onClick={() => setNewPromo({...newPromo, ends_at: ''})}
                        className="bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 p-2 rounded-lg transition-colors"
                        title="Clear Expiry Date"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Min Requirements */}
                <div className="grid grid-cols-2 gap-2">
                   <input 
                    type="number"
                    placeholder="Min Order (Rp)" 
                    value={newPromo.min_order_value} 
                    onChange={e => setNewPromo({...newPromo, min_order_value: e.target.value})} 
                    className="admin-input text-xs" 
                  />
                   <input 
                    type="number"
                    placeholder="Min Qty" 
                    value={newPromo.min_quantity} 
                    onChange={e => setNewPromo({...newPromo, min_quantity: e.target.value})} 
                    className="admin-input text-xs" 
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={resetPromoForm}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="admin-btn-primary flex-1">
                    {editingId ? 'Update Promotion' : 'Create Promotion'}
                  </button>
                </div>
              </form>
            </div>

            {/* Promotions List */}
            <div className="admin-main-content">
              {promotions.length === 0 ? <p className="text-gray-500">No promotions active.</p> : null}
              {promotions.map(promo => (
                <div key={promo.id} className={`admin-item-card flex-col ${!promo.is_active ? 'inactive' : ''}`}>
                  
                  {/* Top Row: Code & Toggle */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#C5A572]/20 border border-[#C5A572]/30 text-[#C5A572] p-2 rounded-lg">
                        <Tag size={20} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-wide font-mono">{promo.code}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{getScopeLabel(promo)}</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => togglePromoStatus(promo.id, promo.is_active)}
                      className={`p-2 rounded-full transition-colors ${promo.is_active ? 'text-green-400 hover:bg-green-900/20' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                      title={promo.is_active ? "Deactivate" : "Activate"}
                    >
                      {promo.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                    </button>
                  </div>

                  {/* Middle Row: Details */}
                  <div className="mt-4 grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      {promo.type === 'percentage' ? <Percent size={16} className="text-gray-400"/> : <DollarSign size={16} className="text-gray-400"/>}
                      <span className="text-white font-medium">
                        {promo.type === 'percentage' ? `${promo.value}% OFF` : `Rp ${promo.value.toLocaleString()} OFF`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400"/>
                      <span className="text-xs text-gray-300">
                        {new Date(promo.starts_at).toLocaleDateString()} 
                        {promo.ends_at ? ` - ${new Date(promo.ends_at).toLocaleDateString()}` : ' (No Expiry)'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Desc & Actions */}
                  <div className="flex justify-between items-end mt-2">
                    <p className="text-gray-400 text-sm leading-relaxed max-w-[70%]">{promo.description}</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditPromo(promo)}
                        className="text-gray-500 hover:text-[#C5A572] p-1.5 rounded hover:bg-white/5 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => openConfirm(
                          "Delete Promotion", 
                          "This will permanently delete this promotion code.", 
                          async () => deletePromo(promo.id), 
                          true,
                          "Delete"
                        )}
                        className="text-gray-500 hover:text-red-500 p-1.5 rounded hover:bg-white/5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}