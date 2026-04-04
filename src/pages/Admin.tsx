import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { 
  Plus, Trash2, LogOut, RefreshCcw, Megaphone, Power, PowerOff, 
  Calendar, Tag, Percent, DollarSign, X, Edit2, Package, 
  MoreVertical, Settings,Star  
} from 'lucide-react';
import ConfirmModal from '../components/common/ConfirmModal';
import ModifierModal, { type ProductModifier } from '../components/common/ModifierModal';
import type { Product, Promotion } from '../types';
import OrderDetailModal from '../components/common/OrderDetailModal';
import PageSkeleton from '../components/common/PageSkeleton';
import { useFeedback } from '../context/FeedbackContext';

export default function Admin() {
  const [isOnlineActive, setIsOnlineActive]= useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useFeedback();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'promotions'>('orders');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [bundleDiscountPercent, setBundleDiscountPercent] = useState<string>('0');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null); 

  const [activeTickets, setActiveTickets] = useState<any[]>([]);
  const [orderView, setOrderView] = useState<'tickets' | 'history'>('tickets');

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

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  
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

  const [promoSearchTerm, setPromoSearchTerm] = useState('');
  const [isPromoSearchOpen, setIsPromoSearchOpen] = useState(false);
  const promoSearchRef = useRef<HTMLDivElement>(null);

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
  const [productListSearch, setProductListSearch] = useState('');

  useEffect(() => {
    supabase.from('store_settings').select('is_online_active').eq('id', 1).single()
      .then(({ data }) => {
        if (data) setIsOnlineActive(data.is_online_active);
      });
  }, []);

  useEffect(() => {
    const sendHeartbeat = async () => {
      await supabase
        .from('store_settings')
        .update({ cashier_last_seen: new Date().toISOString() })
        .eq('id', 1);
    };

    sendHeartbeat(); 
    const interval = setInterval(sendHeartbeat, 60000);

    return () => clearInterval(interval); 
  }, []);

  const handleToggle = async () => {
    const newState = !isOnlineActive;
    setIsOnlineActive(newState);
    await supabase
      .from('store_settings')
      .update({ is_online_active: newState })
      .eq('id', 1);
  };

  const fetchActiveTickets = async () => {
  // Fetch items that are paid but haven't been completed/served yet
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      quantity,
      price_at_time,
      modifiers,
      notes,
      batch_id,
      payment_status,
      created_at,
      product:products ( name ),
      order:orders ( id, customer_name, type, table_number, session_status )
    `)
    .eq('payment_status', 'paid')
    // You might need an 'item_status' (e.g., 'preparing', 'served') 
    // to filter out items they already made.
    .order('created_at', { ascending: true });

  if (!error && data) {
    // Group the items by batch_id so the UI shows 1 Card per Batch
    const groupedBatches = data.reduce((acc: any, item: any) => {
       const key = item.batch_id || `legacy-${item.order?.id}-${item.created_at}`;
      if (!acc[key]) {
        acc[key] = {
          batchId: key,
          orderInfo: item.order,
          time: item.created_at,
          items: []
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {});
    
    return Object.values(groupedBatches);
  }

  if (error) {
    console.error('Error fetching active tickets:', error);
  }

  return [];
}

const closeTableSession = async (orderId: number, tableNumber: string) => {
  const confirm = window.confirm(`Close session for Table ${tableNumber}?`);
  if (!confirm) return;

  const { error } = await supabase
    .from('orders')
    .update({ 
      session_status: 'closed',
      status: 'completed' // Or whatever your final status is
    })
    .eq('id', orderId);

  if (!error) {
    showToast(`Table ${tableNumber} is now closed and ready for the next customer.`, 'success');
    fetchData();
  }
};


  useEffect(() => {
    if (!user) navigate('/login');
    fetchData();

    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .subscribe();

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;

      if (promoSearchRef.current && !promoSearchRef.current.contains(target)) {
        setIsPromoSearchOpen(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(target)) {
        setIsProductSearchOpen(false);
      }

      if (target instanceof Element && !target.closest('.product-menu-trigger')) {
        setActiveMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside); 

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
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
    
    const tickets = await fetchActiveTickets();
    if (tickets) setActiveTickets(tickets);

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
  const openConfirm = (title: string, message: string, action: () => Promise<void>, isDestructive = false, confirmText = t('admin_btn_update')) => {
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
    name: pb.products?.name || t('admin_unknown'),
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

  const deleteProduct = async (id: number) => {
    await supabase.from('product_bundles').delete().or(`parent_product_id.eq.${id},child_product_id.eq.${id}`);
    await supabase.from('product_favorites').delete().eq('product_id', id);

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) {
      showToast('Product deleted.', 'success');
      fetchData();
      return;
    }

    showToast(`Unable to delete product: ${error.message}. Try archiving it instead.`, 'error');
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

  // Helper Wrappers
  const getScopeLabel = (p: Promotion) => {
    if (p.scope === 'order') return t('admin_promo_scope_order');
    if (p.scope === 'category') return `${t('admin_promo_scope_category')}: ${p.promotion_targets?.[0]?.target_category || t('admin_unknown')}`;
    if (p.scope === 'product') {
      const pid = p.promotion_targets?.[0]?.target_product_id;
      const prod = products.find(pr => pr.id === pid);
      return `${t('admin_promo_scope_product')}: ${prod?.name || t('admin_unknown')}`;
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

  const filteredProducts = products.filter((product) => {
    const term = productListSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      String(product.name || '').toLowerCase().includes(term) ||
      String(product.category || '').toLowerCase().includes(term) ||
      String(product.description || '').toLowerCase().includes(term)
    );
  });

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
            availableProducts={products}
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
          <h1 className="admin-title">{t('admin_dashboard')}</h1>
          
          <div className="admin-controls">
            
            <button 
              onClick={handleToggle}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                isOnlineActive 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
              }`}
              title="Toggle Online Orders"
            >
              {isOnlineActive ? <Power size={16} /> : <PowerOff size={16} />}
              <span className="hidden md:inline">
                {isOnlineActive ? 'Online Orders: OPEN' : 'Online Orders: PAUSED'}
              </span>
            </button>

            <div className="admin-tab-group">
              {[
                { id: 'orders', label: t('admin_tab_orders') },
                { id: 'products', label: t('admin_tab_products') },
                { id: 'promotions', label: t('admin_tab_promotions') }
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
              <span className="hidden md:inline">{t('admin_logout')}</span>
            </button>
          </div>
        </div>

        {/* --- ORDERS TAB --- */}
        {activeTab === 'orders' && (
          <div className="admin-grid-orders">
            
            {/* View Toggle & Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
              <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 w-full md:w-auto">
                <button 
                  onClick={() => setOrderView('tickets')} 
                  className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded transition-colors ${orderView === 'tickets' ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Kitchen Tickets
                </button>
                <button 
                  onClick={() => setOrderView('history')} 
                  className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded transition-colors ${orderView === 'history' ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  All Orders History
                </button>
              </div>

              {orderView === 'history' && (
                <input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder={t('admin_orders_search')}
                  className="w-full md:w-64 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-[#C5A572] outline-none"
                />
              )}
            </div>

            {loading ? (
              <PageSkeleton rows={5} />
            ) : orderView === 'tickets' ? (
              
              /* --- KITCHEN TICKETS VIEW --- */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeTickets.length === 0 ? (
                  <p className="text-gray-500 text-center py-10 col-span-full">No active tickets to prepare.</p>
                ) : (
                  activeTickets.map(ticket => (
                    <div key={ticket.batchId} className="bg-[#1a1a1a] border border-[#C5A572]/30 rounded-xl p-4 shadow-lg flex flex-col h-full">
                      <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                        <div>
                          {ticket.orderInfo?.type === 'dine_in' ? (
                            <div className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold border border-amber-500/30 inline-block mb-1">
                              DINE IN - TABLE {ticket.orderInfo.table_number}
                            </div>
                          ) : (
                            <div className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-bold border border-blue-500/30 inline-block mb-1 uppercase">
                              {ticket.orderInfo?.type || 'Takeaway'}
                            </div>
                          )}
                          <h3 className="text-white font-medium text-lg mt-1">{ticket.orderInfo?.customer_name}</h3>
                          <p className="text-xs text-gray-400">Time: {new Date(ticket.time).toLocaleTimeString()}</p>
                        </div>
                      </div>

                      <div className="flex-1">
                        <ul className="space-y-3">
                          {ticket.items.map((item: any) => (
                            <li key={item.id} className="text-gray-300 text-sm">
                              <span className="text-[#C5A572] font-bold mr-2">{item.quantity}x</span> 
                              <span className="font-medium text-white">{item.product?.name}</span>
                              
                              {/* Display Modifiers if any */}
                              {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                                <div className="text-xs text-gray-500 pl-6 mt-1 italic">
                                  + Customizations attached
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-xs text-amber-500/80 pl-6 mt-1 bg-amber-500/10 p-1 rounded">
                                  Note: {item.notes}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                        {ticket.orderInfo?.type === 'dine_in' && ticket.orderInfo?.session_status === 'open' && (
                          <button 
                            onClick={() => closeTableSession(ticket.orderInfo.id, ticket.orderInfo.table_number)}
                            className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            Close Table
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
            ) : (
              
              /* --- ALL ORDERS HISTORY VIEW (Your original view) --- */
              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <p className="text-gray-500 text-center py-10">{t('admin_orders_empty')}</p>
                ) : (
                  filteredOrders.map(order => (
                    <div key={order.id} className="admin-card cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <div>
                        <h3 className="text-white font-bold">{order.customer_name} <span className="text-xs font-normal text-gray-500">#{order.id}</span></h3>
                        <p className="text-sm text-gray-400 mb-1">
                          {t('admin_orders_type')} <span className="text-white/90 uppercase">{order.type || 'takeaway'}</span>
                          {order.type === 'dine_in' && <span className="ml-2 text-amber-400">(Table {order.table_number})</span>}
                        </p>
                        <p className="text-sm text-gray-400 mb-1">{t('admin_orders_total')} <span className="text-[#C5A572]">Rp {order.total_price.toLocaleString()}</span></p>
                        <ul className="text-sm text-gray-500 space-y-1 mt-2">
                          {order.order_items.map((item: any) => (
                            <li key={item.id}>- {item.products?.name} (x{item.quantity})</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        <select 
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="admin-select"
                        >
                          <option value="pending">{t('admin_status_pending')}</option>
                          <option value="paid">Paid</option>
                          <option value="assigned">{t('admin_status_assigned')}</option>
                          <option value="completed">{t('admin_status_completed')}</option>
                          <option value="cancelled">{t('admin_status_cancelled')}</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* --- PRODUCTS TAB --- */}
        {activeTab === 'products' && (
          <div className="admin-grid-dashboard">
            <div className="admin-sidebar">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2">
                {editingProductId ? <Edit2 size={18} className="text-[#C5A572]"/> : <Plus size={18}/>} 
                {editingProductId ? t('admin_prod_edit') : t('admin_prod_add')}
              </h3>
              
              <div className="flex bg-black/40 p-1 rounded-lg mb-4 border border-white/10">
                <button type="button" onClick={() => setNewProduct({...newProduct, is_bundle: false, bundle_items: []})} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${!newProduct.is_bundle ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}>{t('admin_prod_single')}</button>
                <button type="button" onClick={() => setNewProduct({...newProduct, is_bundle: true, category: 'Bundles'})} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${newProduct.is_bundle ? 'bg-[#C5A572] text-black' : 'text-gray-400 hover:text-white'}`}>{t('admin_prod_bundle')}</button>
              </div>

              <form onSubmit={handleSaveProduct} className="admin-form">
                <input required placeholder={t('admin_prod_name')} value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="admin-input" />
                
                {newProduct.is_bundle && (
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-bold flex items-center gap-2">
                      <Package size={12}/> {t('admin_prod_bundle_contents')}
                    </p>
                    
                    <div className="relative" ref={productSearchRef}>
                        <input type="text" placeholder={t('admin_prod_search_add')} value={productSearchTerm} onFocus={() => setIsProductSearchOpen(true)} onChange={e => { setProductSearchTerm(e.target.value); setIsProductSearchOpen(true); }} className="admin-input pl-9 text-xs" />
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
                            ) : <div className="px-3 py-2 text-xs text-gray-500">{t('admin_prod_no_match')}</div>}
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
                            <span className="text-xs text-gray-500 font-bold uppercase">{t('admin_prod_pricing_strategy')}</span>
                            <span className="text-xs text-gray-400">{t('admin_prod_total_value')} <span className="line-through">Rp {calculateSidebarBundleTotal().toLocaleString()}</span></span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs text-[#C5A572] font-bold ml-1 flex items-center gap-1"><Percent size={10} /> {t('admin_prod_discount_pct')}</label>
                                <input type="number" placeholder="0" min="0" max="100" value={bundleDiscountPercent} onChange={e => setBundleDiscountPercent(e.target.value)} className="admin-input text-center text-[#C5A572] font-bold border-[#C5A572]/50 focus:border-[#C5A572]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">{t('admin_prod_final_price')}</label>
                                <div className="admin-input flex items-center justify-center bg-black/40 text-gray-300 cursor-not-allowed">Rp {parseInt(newProduct.price || '0').toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 ml-1">{t('admin_prod_price')}</label>
                        <input required placeholder={t('admin_prod_price')} type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="admin-input" />
                    </div>
                )}

                {!newProduct.is_bundle && (
                  <div>
                    <input list="category-options" placeholder={t('admin_prod_category')} required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="admin-input" />
                    <datalist id="category-options">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
                  </div>
                )}

                <textarea placeholder={t('admin_prod_desc')} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="admin-input min-h-[80px]" />
                <input placeholder={t('admin_prod_image_url')} value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} className="admin-input" />
                
                <div className="flex gap-2 mt-2">
                  {editingProductId && <button type="button" onClick={resetProductForm} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm">{t('admin_btn_cancel')}</button>}
                  <button type="submit" className="admin-btn-primary flex-1">{editingProductId ? t('admin_btn_update') : t('admin_btn_create')} {newProduct.is_bundle ? t('admin_prod_bundle') : t('admin_tab_products')}</button>
                </div>
              </form>
            </div>

            <div className="admin-main-content">
              <div className="mb-3 admin-main-content-search">
                <input
                  value={productListSearch}
                  onChange={(e) => setProductListSearch(e.target.value)}
                  placeholder={t('admin_prod_search')}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              </div>

              {filteredProducts.length === 0 ? (
                <p className="text-gray-500 text-center py-10">{t('admin_prod_empty')}</p>
              ) : filteredProducts.map((product, index) => {
                const originalSum = product.is_bundle 
                  ? (product as any).product_bundles?.reduce((sum: number, pb: any) => sum + ((pb.products?.price || 0) * pb.quantity), 0)
                  : 0;

                  const isMenuOpen = activeMenuId === product.id;
                  const isNearBottom = index >= filteredProducts.length - 3;

                  return (
                    <div 
                      key={product.id} 
                      className={`admin-item-card relative 
                        ${(!product.is_available && !isMenuOpen) ? 'inactive' : ''} 
                        ${product.is_bundle ? 'border-[#C5A572]/40 bg-[#C5A572]/5' : ''} 
                        ${isMenuOpen ? 'z-[100] !opacity-100 !filter-none' : 'z-0'}`}
                    >
                      
                          <div className="absolute top-2 right-2 z-10 product-menu-trigger">
                            <button 
                              onClick={() => setActiveMenuId(isMenuOpen ? null : product.id)} 
                              className="p-1.5 rounded text-gray-300 hover:text-white transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {isMenuOpen && (
                              <div className={`absolute right-0 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl py-1 z-[110] ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                <button onClick={() => handleEditProduct(product)} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                  <Edit2 size={12} /> {t('admin_action_edit_details')}
                                </button>
                                <button onClick={() => openModifierModal(product)} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                  <Settings size={12} /> {t('admin_action_manage_addons')}
                                </button>
                                <button onClick={() => { toggleRecommended(product.id, (product as any).is_recommended); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                  <Star size={12} /> {(product as any).is_recommended ? t('admin_action_remove_rec') : t('admin_action_mark_rec')}
                                </button>
                                <div className="h-px bg-white/10 my-1" />
                                <button onClick={() => { openConfirm(product.is_available ? t('admin_action_archive') : t('admin_action_restore'), t('admin_confirm_are_you_sure'), async () => toggleProductAvailability(product.id, product.is_available), true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2">
                                  {product.is_available ? <Trash2 size={12} /> : <RefreshCcw size={12} />} {product.is_available ? t('admin_action_archive') : t('admin_action_restore')}
                                </button>
                                <button onClick={() => { openConfirm(t('admin_confirm_delete_prod_title'), t('admin_confirm_delete_prod_msg'), async () => deleteProduct(product.id), true, "Delete"); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200 flex items-center gap-2">
                                  <Trash2 size={12} /> {t('admin_action_delete_perm')}
                                </button>
                              </div>
                            )}
                          </div>
                                  <div className="w-20 h-20 bg-gray-800 rounded overflow-hidden shrink-0 relative">
                                    <img src={product.image_url || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                                    
                                    {!product.is_available && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-0">
                                        <span className="admin-badge-archived">{t('admin_badge_archived')}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 pr-6">
                                    <h4 className="text-white font-medium flex items-center gap-2">{product.name}{(product as any).is_recommended && <span className="text-[10px] bg-amber-200 text-black px-1.5 py-0.5 rounded-full">{t('admin_badge_recommended')}</span>}</h4>
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

                                    {(product as any).modifiers && (product as any).modifiers.length > 0 && (
                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
                                            <Settings size={10} />
                                            <span>{(product as any).modifiers.length} {t('admin_customizations_active')}</span>
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
                {editingPromoId ? t('admin_promo_edit') : t('admin_promo_new')}
              </h3>
              
              <form onSubmit={handleSavePromo} className="admin-form">
                
                {/* Code & Value */}
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    required 
                    placeholder={t('admin_promo_code')} 
                    value={newPromo.code} 
                    onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} 
                    className="admin-input font-mono uppercase" 
                  />
                  <input 
                    required 
                    type="number"
                    placeholder={t('admin_promo_value')} 
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
                    <option value="percentage">{t('admin_promo_type_pct')}</option>
                    <option value="fixed_amount">{t('admin_promo_type_fixed')}</option>
                  </select>
                  <select 
                    value={newPromo.scope} 
                    onChange={e => {
                      setNewPromo({...newPromo, scope: e.target.value as any, target_category: '', target_product_id: ''});
                      setPromoSearchTerm('');
                    }}
                    className="admin-select"
                  >
                    <option value="order">{t('admin_promo_scope_order')}</option>
                    <option value="category">{t('admin_promo_scope_category')}</option>
                    <option value="product">{t('admin_promo_scope_product')}</option>
                  </select>
                </div>

                {/* DYNAMIC SEARCHABLE TARGET INPUT */}
                {(newPromo.scope === 'category' || newPromo.scope === 'product') && (
                   <div className="relative" ref={promoSearchRef}>
                     <div className="relative">
                       <input 
                         type="text"
                         placeholder={newPromo.scope === 'category' ? t('admin_promo_search_cat') : t('admin_promo_search_prod')}
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
                           <div className="px-4 py-2 text-sm text-gray-500">{t('admin_promo_no_results')}</div>
                         )}
                       </div>
                     )}
                   </div>
                )}

                <textarea 
                  placeholder={t('admin_prod_desc')} 
                  value={newPromo.description} 
                  onChange={e => setNewPromo({...newPromo, description: e.target.value})} 
                  className="admin-input min-h-[60px]" 
                />

                {/* Dates */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 ml-1">{t('admin_promo_valid_from')}</label>
                  <input 
                    type="datetime-local" 
                    value={newPromo.starts_at} 
                    onChange={e => setNewPromo({...newPromo, starts_at: e.target.value})} 
                    className="admin-input text-gray-300" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 ml-1">{t('admin_promo_valid_until')}</label>
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
                        title={t('admin_promo_clear_expiry')}
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
                    placeholder={t('admin_promo_min_order')} 
                    value={newPromo.min_order_value} 
                    onChange={e => setNewPromo({...newPromo, min_order_value: e.target.value})} 
                    className="admin-input text-xs" 
                  />
                   <input 
                    type="number"
                    placeholder={t('admin_promo_min_qty')} 
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
                      {t('admin_btn_cancel')}
                    </button>
                  )}
                  <button type="submit" className="admin-btn-primary flex-1">
                    {editingPromoId ? t('admin_promo_btn_update') : t('admin_promo_btn_create')}
                  </button>
                </div>
              </form>
            </div>

            {/* Promotions List */}
            <div className="admin-main-content">
              {promotions.length === 0 ? <p className="text-gray-500">{t('admin_promo_empty')}</p> : null}
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
                      title={promo.is_active ? t('admin_promo_deactivate') : t('admin_promo_activate')}
                    >
                      {promo.is_active ? <Power size={18} /> : <PowerOff size={18} />}
                    </button>
                  </div>

                  {/* Middle Row: Details */}
                  <div className="mt-4 grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      {promo.type === 'percentage' ? <Percent size={16} className="text-gray-400"/> : <DollarSign size={16} className="text-gray-400"/>}
                      <span className="text-white font-medium">
                        {promo.type === 'percentage' ? `${promo.value}% ${t('admin_promo_off')}` : `Rp ${promo.value.toLocaleString()} ${t('admin_promo_off')}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400"/>
                      <span className="text-xs text-gray-300">
                        {new Date(promo.starts_at).toLocaleDateString()} 
                        {promo.ends_at ? ` - ${new Date(promo.ends_at).toLocaleDateString()}` : ` ${t('admin_promo_no_expiry')}`}
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
                        title={t('admin_action_edit')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => openConfirm(
                          t('admin_confirm_delete_promo_title'), 
                          t('admin_confirm_delete_promo_msg'), 
                          async () => deletePromo(promo.id), 
                          true,
                          t('admin_action_delete')
                        )}
                        className="text-gray-500 hover:text-red-500 p-1.5 rounded hover:bg-white/5 transition-colors"
                        title={t('admin_action_delete')}
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