import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, LogOut, RefreshCcw, Megaphone, Power, PowerOff, 
  Calendar, Tag, Percent, DollarSign, X, Edit2, Package, 
  MoreVertical, Settings,Star  
} from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import ModifierModal, { type ProductModifier } from '../components/common/ModifierModal'; // Ensure this path matches where you saved the previous file
import type { Product, Promotion } from '../types';
import OrderDetailModal from '../components/common/OrderDetailModal';
import PageSkeleton from '../components/common/PageSkeleton';
import { useFeedback } from '../context/FeedbackContext';

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast, showPrompt } = useFeedback();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'promotions'>('orders');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // --- PRODUCT FORM STATE ---
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [bundleDiscountPercent, setBundleDiscountPercent] = useState<string>('0');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null); 

  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [currentProductForModifiers, setCurrentProductForModifiers] = useState<Product | null>(null);

  const [newProduct, setNewProduct] = useState<{
    name: string;
    price: string;
    category: string;
    description: string;
    image_url: string;
    is_bundle: boolean;
    bundle_items: { child_product_id: number; quantity: number; name: string; price: number }[];
  }>({
    name: '', price: '', category: '', description: '', image_url: '', 
    is_bundle: false, bundle_items: [] 
  });

  // Search State for Bundle Items
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  
  // --- PROMOTION FORM STATE ---
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [newPromo, setNewPromo] = useState({
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    scope: 'order',
    min_order_value: '',
    min_quantity: '',
    starts_at: '',
    ends_at: '',
    target_category: '',
    target_product_id: ''
  });

  // Search State for Promotions
  const [promoSearchTerm, setPromoSearchTerm] = useState('');
  const [isPromoSearchOpen, setIsPromoSearchOpen] = useState(false);
  const promoSearchRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive: boolean;
    confirmText: string;
  } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
    fetchData();

    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .subscribe();

    // Close search dropdowns when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (promoSearchRef.current && !promoSearchRef.current.contains(event.target as Node)) {
        setIsPromoSearchOpen(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setIsProductSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      supabase.removeChannel(ordersChannel);
    };
  }, [user]);

  useEffect(() => {
    if (newProduct.is_bundle) {
        const totalOriginal = newProduct.bundle_items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const discount = parseFloat(bundleDiscountPercent) || 0;
        
        // Calculate discounted price: Total - (Total * (Discount/100))
        const finalPrice = Math.round(totalOriginal * (1 - (discount / 100)));
        
        // Update the price field automatically
        setNewProduct(prev => ({ ...prev, price: finalPrice.toString() }));
    }
  }, [newProduct.bundle_items, bundleDiscountPercent, newProduct.is_bundle]);

  const fetchData = async () => {
    setLoading(true);
    // Orders
    const { data: ord, error: ordError } = await supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false });
    if (ordError) console.error("Error fetching orders:", ordError);

    // Promotions
    const { data: promos, error: promoError } = await supabase.from('promotions').select('*, promotion_targets(*)').order('created_at', { ascending: false });
    if (promoError) console.error("Error fetching promotions:", promoError);

    // Products (with Bundles)
    const { data: prod, error: prodError } = await supabase
      .from('products')
      .select(`
        *,
        product_bundles:product_bundles!parent_product_id (
          quantity,
          child_product_id,
          products:products!child_product_id (name, price)
        )
      `)
      .order('name');

    if (prodError) {
      console.error("Error fetching products:", prodError);
      showToast(`Error fetching products: ${prodError.message}`, 'error');
    }
    
    if (ord) setOrders(ord);
    if (promos) setPromotions(promos as Promotion[]);
    if (prod) {
      // @ts-ignore
      setProducts(prod);
      const uniqueCats = Array.from(new Set(prod.map((p: any) => p.category))).filter(Boolean) as string[];
      setCategories(uniqueCats.sort());
    }
    setLoading(false);
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

  const handleEditProduct = (product: any) => {
  setEditingProductId(product.id);
  
  const existingItems = product.product_bundles?.map((pb: any) => ({
    child_product_id: pb.child_product_id,
    quantity: pb.quantity,
    name: pb.products?.name || 'Unknown Item',
    price: pb.products?.price || 0
  })) || [];

  setNewProduct({
    name: product.name,
    price: product.price.toString(),
    category: product.category || '',
    description: product.description || '',
    image_url: product.image_url || '',
    is_bundle: product.is_bundle || false,
    bundle_items: existingItems
  });
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  const resetProductForm = () => {
    setEditingProductId(null);
    setNewProduct({ name: '', price: '', category: '', description: '', image_url: '', is_bundle: false, bundle_items: [] });
    setProductSearchTerm('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    if (!newProduct.is_bundle && !newProduct.category) return; // Category required for normal products

    const productPayload = {
      name: newProduct.name,
      price: parseInt(newProduct.price),
      category: newProduct.is_bundle ? 'Bundles' : newProduct.category,
      description: newProduct.description,
      image_url: newProduct.image_url,
      is_bundle: newProduct.is_bundle,
      is_available: true
    };

    let productId = editingProductId;
    let error;

    // 1. Upsert Parent Product
    if (editingProductId) {
      const { error: updateError } = await supabase.from('products').update(productPayload).eq('id', editingProductId);
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase.from('products').insert([productPayload]).select();
      if (data) productId = data[0].id;
      error = insertError;
    }

    if (error) {
      showToast('Error saving product: ' + error.message, 'error');
      return;
    }

    // 2. Handle Bundle Items (If it is a bundle)
    if (newProduct.is_bundle && productId) {
      // A. Delete existing links (simplest way to handle updates without diffing)
      await supabase.from('product_bundles').delete().eq('parent_product_id', productId);

      // B. Insert new links
      if (newProduct.bundle_items.length > 0) {
        const bundleData = newProduct.bundle_items.map(item => ({
          parent_product_id: productId,
          child_product_id: item.child_product_id,
          quantity: item.quantity
        }));
        
        const { error: bundleError } = await supabase.from('product_bundles').insert(bundleData);
        if (bundleError) console.error("Error saving bundle items:", bundleError);
      }
    }

    resetProductForm();
    fetchData();
  };

  const toggleProductAvailability = async (id: number, currentStatus: boolean | undefined) => {
    const { error } = await supabase.from('products').update({ is_available: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const toggleRecommended = async (id: number, currentStatus: boolean | undefined) => {
    const { error } = await supabase.from('products').update({ is_recommended: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  // --- MODIFIER ACTIONS ---
  const openModifierModal = (product: Product) => {
    setCurrentProductForModifiers(product);
    setIsModifierModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveModifiers = async (productId: number, modifiers: ProductModifier[]) => {
    const { error } = await supabase
      .from('products')
      .update({ modifiers: modifiers })
      .eq('id', productId);

    if (error) throw error;
    fetchData(); // Refresh to update UI
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
    setEditingPromoId(promo.id);
    
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
    if (promo.scope === 'category') setPromoSearchTerm(tCat);
    if (promo.scope === 'product' && tPid) {
      const prod = products.find(p => p.id === parseInt(tPid));
      if (prod) setPromoSearchTerm(prod.name);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetPromoForm = () => {
    setEditingPromoId(null);
    setNewPromo({
      code: '', description: '', type: 'percentage', value: '', scope: 'order',
      min_order_value: '', min_quantity: '', starts_at: '', ends_at: '',
      target_category: '', target_product_id: ''
    });
    setPromoSearchTerm('');
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.value) return;

    // Validation
    if (newPromo.scope === 'category' && !newPromo.target_category) {
      showToast('Please select a category.', 'error'); return;
    }
    if (newPromo.scope === 'product' && !newPromo.target_product_id) {
      showToast('Please select a product.', 'error'); return;
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

    let promoId = editingPromoId;
    let error;

    if (editingPromoId) {
      const { error: updateError } = await supabase.from('promotions').update(promoPayload).eq('id', editingPromoId);
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase.from('promotions').insert([promoPayload]).select();
      if (data) promoId = data[0].id;
      error = insertError;
    }

    if (error) {
      showToast('Error saving promotion: ' + error.message, 'error');
      return;
    }

    if (promoId) {
      await supabase.from('promotion_targets').delete().eq('promotion_id', promoId);
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
    else showToast(error.message, 'error');
  };

  const togglePromoStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('promotions').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) fetchData();
  };

  const updateOrderStatus = async (id: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    fetchData();
  };

  const assignCourierToOrder = async (order: any) => {
    const courierPhone = await showPrompt({
      title: 'Assign Courier',
      message: 'Enter courier WhatsApp number (e.g. 62812...)',
      placeholder: '62812...',
      confirmText: 'Assign',
    });
    if (!courierPhone) return;

    const { error } = await supabase
      .from('orders')
      .update({ courier_phone: courierPhone, status: 'assigned' })
      .eq('id', order.id);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    const courierMessage = `Halo, ada pengantaran order #${order.id}\nNama pelanggan: ${order.customer_name}\nNo pelanggan: ${order.customer_phone || '-'}\nAlamat: ${order.address || '-'}\nMaps: ${order.maps_link || '-'}\nTotal: Rp ${Number(order.total_price || 0).toLocaleString()}\nNotes: ${order.notes || '-'}\nMohon konfirmasi penerimaan tugas.`;
    window.open(`https://wa.me/${courierPhone}?text=${encodeURIComponent(courierMessage)}`, '_blank');
    showToast('Courier assigned successfully.', 'success');
    fetchData();
  };

  // Helper Wrappers
  const getScopeLabel = (p: Promotion) => {
    if (p.scope === 'order') return 'Entire Order';
    if (p.scope === 'category') return `Category: ${p.promotion_targets?.[0]?.target_category || 'Unknown'}`;
    if (p.scope === 'product') {
      const pid = p.promotion_targets?.[0]?.target_product_id;
      const prod = products.find(pr => pr.id === pid);
      return `Product: ${prod?.name || 'Unknown'}`;
    }
    return p.scope;
  };

  const getFilteredBundleItems = () => {
    const term = productSearchTerm.toLowerCase();
    return products.filter(p => !p.is_bundle && (p.name || '').toLowerCase().includes(term));
  };

  const getFilteredPromoItems = () => {
    const term = promoSearchTerm.toLowerCase();
    if (newPromo.scope === 'category') return categories.filter(c => c.toLowerCase().includes(term));
    if (newPromo.scope === 'product') return products.filter(p => (p.name || '').toLowerCase().includes(term));
    return [];
  };

   const filteredOrders = orders.filter((order) => {
    const term = orderSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      String(order.id).includes(term) ||
      String(order.customer_name || '').toLowerCase().includes(term) ||
      (order.order_items || []).some((item: any) => String(item.products?.name || '').toLowerCase().includes(term))
    );
  });

  // --- HELPER FOR SIDEBAR PREVIEW ---
  const calculateSidebarBundleTotal = () => {
    return newProduct.bundle_items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
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

       {isModifierModalOpen && currentProductForModifiers && (
          <ModifierModal 
            isOpen={isModifierModalOpen}
            onClose={() => setIsModifierModalOpen(false)}
            product={currentProductForModifiers}
            onSave={handleSaveModifiers}
          />
       )}

       <OrderDetailModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        isAdmin
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
            <div className="mb-3">
              <input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search by order ID, customer name, or item..."
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              />
            </div>

            {loading ? (
              <PageSkeleton rows={5} />
            ) : filteredOrders.length === 0 ? (
               <p className="text-gray-500 text-center py-10">No orders found.</p>
            ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="admin-card cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <div>
                    <h3 className="text-white font-bold">{order.customer_name} <span className="text-xs font-normal text-gray-500">#{order.id}</span></h3>
                    <p className="text-sm text-gray-400 mb-1">Type: <span className="text-white/90 uppercase">{order.type || 'takeaway'}</span></p>
                    <p className="text-sm text-gray-400 mb-1">Total: <span className="text-[#C5A572]">Rp {order.total_price.toLocaleString()}</span></p>
                    {order.type === 'delivery' && (
                      <div className="text-xs text-gray-500 mb-2">
                        <p className="truncate">Address: {order.address || '-'}</p>
                        {order.maps_link && <a href={order.maps_link} target="_blank" onClick={(e) => e.stopPropagation()} className="text-[#C5A572] hover:underline" rel="noreferrer">View map</a>}
                      </div>
                    )}
                    <ul className="text-sm text-gray-500 space-y-1">
                      {order.order_items.map((item: any) => (
                        <li key={item.id}>- {item.products?.name} (x{item.quantity})</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[120px]">
                    {order.type === 'delivery' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); assignCourierToOrder(order); }}
                        className="text-xs rounded-md border border-[#C5A572]/50 text-[#C5A572] px-2 py-1 hover:bg-[#C5A572]/10"
                      >
                        Assign Courier
                      </button>
                    )}
                    <select 
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="admin-select"
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div className="admin-grid-dashboard">
            <div className="admin-sidebar">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2">
                {editingProductId ? <Edit2 size={18} className="text-[#C5A572]"/> : <Plus size={18}/>} 
                {editingProductId ? 'Edit Product' : 'Add Product'}
              </h3>
              
              <div className="flex bg-black/40 p-1 rounded-lg mb-4 border border-white/10">
                <button type="button" onClick={() => setNewProduct({...newProduct, is_bundle: false, bundle_items: []})} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${!newProduct.is_bundle ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}>Single Item</button>
                <button type="button" onClick={() => setNewProduct({...newProduct, is_bundle: true, category: 'Bundles'})} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${newProduct.is_bundle ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}>Bundle</button>
              </div>

              <form onSubmit={handleSaveProduct} className="admin-form">
                <input required placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="admin-input" />
                
                {newProduct.is_bundle && (
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold flex items-center gap-2">
                      <Package size={12}/> Bundle Contents
                    </p>
                    
                    <div className="relative" ref={productSearchRef}>
                        <input type="text" placeholder="Search item to add..." value={productSearchTerm} onFocus={() => setIsProductSearchOpen(true)} onChange={e => { setProductSearchTerm(e.target.value); setIsProductSearchOpen(true); }} className="admin-input pl-9 text-xs" />
                        {isProductSearchOpen && (
                          <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                            {getFilteredBundleItems().length > 0 ? (
                              getFilteredBundleItems().map(p => (
                                <div key={p.id} onClick={() => {
                                    const current = newProduct.bundle_items;
                                    if(!current.find(i => i.child_product_id === p.id)) {
                                      setNewProduct({ ...newProduct, bundle_items: [...current, { child_product_id: p.id, quantity: 1, name: p.name, price: p.price }] });
                                    }
                                    setProductSearchTerm('');
                                    setIsProductSearchOpen(false);
                                  }} className="px-3 py-2 text-xs hover:bg-white/10 cursor-pointer text-gray-300">
                                  {p.name}
                                </div>
                              ))
                            ) : <div className="px-3 py-2 text-xs text-gray-500">No matching products found</div>}
                          </div>
                        )}
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {newProduct.bundle_items.map((item, idx) => (
                        <div key={item.child_product_id} className="flex items-center gap-2 bg-black/40 p-2 rounded border border-white/5">
                          <div className="flex-1 text-xs text-white truncate">{item.name}</div>
                          <div className="text-xs text-[#C5A572] font-mono">
                             Rp {(item.price * item.quantity).toLocaleString()}
                          </div>
                          <input type="number" min="1" value={item.quantity} onChange={(e) => {
                              const newItems = [...newProduct.bundle_items];
                              newItems[idx].quantity = parseInt(e.target.value);
                              setNewProduct({...newProduct, bundle_items: newItems});
                            }} className="w-10 bg-transparent border-b border-white/20 focus:border-[#C5A572] outline-none text-xs text-center text-white" />
                          <button type="button" onClick={() => {
                              const newItems = newProduct.bundle_items.filter((_, i) => i !== idx);
                              setNewProduct({...newProduct, bundle_items: newItems});
                            }} className="text-red-400 hover:text-red-300 p-1">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {newProduct.is_bundle ? (
                    <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold uppercase">Pricing Strategy</span>
                            <span className="text-xs text-gray-400">Total Value: <span className="line-through">Rp {calculateSidebarBundleTotal().toLocaleString()}</span></span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-[#C5A572] font-bold ml-1 flex items-center gap-1"><Percent size={10} /> Discount %</label>
                                <input type="number" placeholder="0" min="0" max="100" value={bundleDiscountPercent} onChange={e => setBundleDiscountPercent(e.target.value)} className="admin-input text-center text-[#C5A572] font-bold border-[#C5A572]/50 focus:border-[#C5A572]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">Final Price</label>
                                <div className="admin-input flex items-center justify-center bg-black/40 text-gray-300 cursor-not-allowed">Rp {parseInt(newProduct.price || '0').toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 ml-1">Price</label>
                        <input required placeholder="Price" type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="admin-input" />
                    </div>
                )}

                {!newProduct.is_bundle && (
                  <div>
                    <input list="category-options" placeholder="Category" required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="admin-input" />
                    <datalist id="category-options">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
                  </div>
                )}

                <textarea placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="admin-input min-h-[80px]" />
                <input placeholder="Image URL" value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} className="admin-input" />
                
                <div className="flex gap-2 mt-2">
                  {editingProductId && <button type="button" onClick={resetProductForm} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm">Cancel</button>}
                  <button type="submit" className="admin-btn-primary flex-1">{editingProductId ? 'Update' : 'Create'} {newProduct.is_bundle ? 'Bundle' : 'Product'}</button>
                </div>
              </form>
            </div>

            <div className="admin-main-content">
              {products.map(product => {
                const originalSum = product.is_bundle 
                  ? (product as any).product_bundles?.reduce((sum: number, pb: any) => sum + ((pb.products?.price || 0) * pb.quantity), 0)
                  : 0;

                return (
                  <div key={product.id} className={`admin-item-card relative ${!product.is_available ? 'inactive' : ''} ${product.is_bundle ? 'border-[#C5A572]/40 bg-[#C5A572]/5' : ''}`}>
                    
                    {/* --- 3-DOT MENU TRIGGER --- */}
                    <div className="absolute top-2 right-2 z-5 product-menu-trigger">
                       <button onClick={() => setActiveMenuId(activeMenuId === product.id ? null : product.id)} className="p-1.5 rounded text-gray-300 hover:text-white transition-colors">
                         <MoreVertical size={16} />
                       </button>
                       {activeMenuId === product.id && (
                         <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1 z-20">
                            <button onClick={() => handleEditProduct(product)} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                              <Edit2 size={12} /> Edit Details
                            </button>
                            <button onClick={() => openModifierModal(product)} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                              <Settings size={12} /> Manage Add-ons
                            </button>
                            <button onClick={() => { toggleRecommended(product.id, (product as any).is_recommended); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                              <Star size={12} /> {(product as any).is_recommended ? 'Remove Recommended' : 'Mark Recommended'}
                            </button>
                            <div className="h-px bg-white/10 my-1" />
                            <button onClick={() => { openConfirm(product.is_available ? "Archive" : "Restore", "Are you sure?", async () => toggleProductAvailability(product.id, product.is_available), true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                              {product.is_available ? <Trash2 size={12} /> : <RefreshCcw size={12} />} {product.is_available ? 'Archive' : 'Restore'}
                            </button>
                         </div>
                       )}
                    </div>

                    <div className="w-20 h-20 bg-gray-800 rounded overflow-hidden shrink-0 relative">
                      <img src={product.image_url || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                      {product.is_bundle && <div className="absolute top-0 left-0 bg-[#C5A572] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-br shadow-sm">BUNDLE</div>}
                      {!product.is_available && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="admin-badge-archived">Archived</span></div>}
                    </div>
                    
                    <div className="flex-1 pr-6"> {/* Added padding-right to avoid overlap with menu */}
                      <h4 className="text-white font-medium flex items-center gap-2">{product.name}{(product as any).is_recommended && <span className="text-[10px] bg-amber-200 text-black px-1.5 py-0.5 rounded-full">Recommended</span>}</h4>
                      <div className="flex items-center gap-2">
                        <p className="admin-price">Rp {product.price.toLocaleString()}</p>
                        {product.is_bundle && originalSum > product.price && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 line-through decoration-gray-600">Rp {originalSum.toLocaleString()}</span>
                            <span className="text-[10px] text-green-400 bg-green-900/20 px-1 rounded">-{Math.round((1 - (product.price / originalSum)) * 100)}%</span>
                          </div>
                        )}
                      </div>
                      
                      {product.is_bundle ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(product as any).product_bundles?.map((pb: any, idx: number) => (
                              <span key={idx} className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1"><span className="text-[#C5A572] font-bold">{pb.quantity}x</span> {pb.products?.name}</span>
                          ))}
                        </div>
                      ) : <p className="admin-category-tag">{product.category}</p>}

                      {/* --- INDICATOR IF MODIFIERS EXIST --- */}
                      {(product as any).modifiers && (product as any).modifiers.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
                              <Settings size={10} />
                              <span>{(product as any).modifiers.length} Customizations Active</span>
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- PROMOTIONS TAB --- */}
        {activeTab === 'promotions' && (
          <div className="admin-grid-dashboard">
            {/* Add/Edit Promotion Form */}
            <div className="admin-sidebar">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2">
                {editingPromoId ? <Edit2 size={18} className="text-[#C5A572]"/> : <Megaphone size={18}/>} 
                {editingPromoId ? 'Edit Promotion' : 'New Promotion'}
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
                      setPromoSearchTerm('');
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
                   <div className="relative" ref={promoSearchRef}>
                     <div className="relative">
                       <input 
                         type="text"
                         placeholder={newPromo.scope === 'category' ? "Search Category..." : "Search Product..."}
                         value={promoSearchTerm}
                         onFocus={() => setIsPromoSearchOpen(true)}
                         onChange={e => {
                           setPromoSearchTerm(e.target.value);
                           setIsPromoSearchOpen(true);
                           if (newPromo.scope === 'category') setNewPromo({...newPromo, target_category: ''});
                           if (newPromo.scope === 'product') setNewPromo({...newPromo, target_product_id: ''});
                         }}
                         className={`admin-input pl-9 ${(!newPromo.target_category && !newPromo.target_product_id) ? 'border-[#C5A572]' : ''}`}
                       />
                     </div>
                     
                     {isPromoSearchOpen && (
                       <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                         {getFilteredPromoItems().length > 0 ? (
                           getFilteredPromoItems().map((item: any) => {
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
                                      setPromoSearchTerm(item);
                                    } else {
                                      setNewPromo({...newPromo, target_product_id: item.id});
                                      setPromoSearchTerm(item.name);
                                    }
                                    setIsPromoSearchOpen(false);
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
                  {editingPromoId && (
                    <button 
                      type="button" 
                      onClick={resetPromoForm}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="admin-btn-primary flex-1">
                    {editingPromoId ? 'Update Promotion' : 'Create Promotion'}
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