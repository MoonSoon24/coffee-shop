import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, LogOut } from 'lucide-react';

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  
  // Data State
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]); // Store unique categories
  
  // Form State
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', description: '', image_url: '' });

  useEffect(() => {
    if (!user) navigate('/login');
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const { data: ord } = await supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false });
    const { data: prod } = await supabase.from('products').select('*').order('name');
    
    if (ord) setOrders(ord);
    if (prod) {
      setProducts(prod);
      // Extract unique categories from existing products for the dropdown
      const uniqueCats = Array.from(new Set(prod.map((p: any) => p.category))).filter(Boolean) as string[];
      setCategories(uniqueCats.sort());
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category) return;

    const { error } = await supabase.from('products').insert([{
      name: newProduct.name,
      price: parseInt(newProduct.price),
      category: newProduct.category,
      description: newProduct.description,
      image_url: newProduct.image_url
    }]);

    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      setNewProduct({ name: '', price: '', category: '', description: '', image_url: '' });
      fetchData(); // Refresh list and categories
    }
  };

  const handleDeleteProduct = async (id: number) => {
  if (!confirm('Are you sure you want to archive this product?')) return;

  const { error } = await supabase
    .from('products')
    .update({ is_available: false })
    .eq('id', id);

  if (error) alert(error.message);
  else fetchData();
};

  const updateOrderStatus = async (id: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-24 px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-serif text-white">Admin Dashboard</h1>
          
          <div className="flex items-center gap-3">
            <div className="flex gap-2 bg-[#141414] p-1 rounded-lg border border-white/10">
              <button 
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded text-sm transition-colors ${activeTab === 'orders' ? 'bg-[#C5A572] text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Orders
              </button>
              <button 
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded text-sm transition-colors ${activeTab === 'products' ? 'bg-[#C5A572] text-black font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Products
              </button>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 border border-red-500/30 px-4 py-2 rounded-lg text-sm transition-all"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>

        {activeTab === 'orders' ? (
          <div className="grid gap-4">
            {orders.length === 0 ? (
               <p className="text-gray-500 text-center py-10">No orders found.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-[#141414] border border-white/5 p-6 rounded-xl flex flex-col md:flex-row justify-between gap-4">
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
                      className="bg-black/30 text-white border border-white/10 rounded p-2 text-sm focus:border-[#C5A572] outline-none"
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
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {/* ADD PRODUCT FORM */}
            <div className="md:col-span-1 bg-[#141414] border border-white/5 p-6 rounded-xl h-fit sticky top-24">
              <h3 className="text-white font-serif mb-4 flex items-center gap-2"><Plus size={18}/> Add Product</h3>
              <form onSubmit={handleAddProduct} className="space-y-3">
                <input 
                  required 
                  placeholder="Product Name" 
                  value={newProduct.name} 
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                  className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-[#C5A572] outline-none" 
                />
                
                <input 
                  required 
                  placeholder="Price" 
                  type="number" 
                  value={newProduct.price} 
                  onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
                  className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-[#C5A572] outline-none" 
                />
                
                {/* NEW: Flexible Category Input */}
                <div>
                  <input 
                    list="category-options" 
                    placeholder="Category (Select or Type New)" 
                    required
                    value={newProduct.category} 
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                    className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-[#C5A572] outline-none" 
                  />
                  <datalist id="category-options">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                    {!categories.includes('Hot Coffee') && <option value="Hot Coffee" />}
                    {!categories.includes('Iced') && <option value="Iced" />}
                    {!categories.includes('Non-Coffee') && <option value="Non-Coffee" />}
                    {!categories.includes('Food') && <option value="Food" />}
                  </datalist>
                </div>

                <textarea 
                  placeholder="Description" 
                  value={newProduct.description} 
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})} 
                  className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-[#C5A572] outline-none min-h-[80px]" 
                />
                
                <input 
                  placeholder="Image URL" 
                  value={newProduct.image_url} 
                  onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} 
                  className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-[#C5A572] outline-none" 
                />
                
                <button type="submit" className="w-full bg-[#C5A572] text-black font-bold py-2 rounded hover:bg-[#b09366] transition-colors">
                  Add Product
                </button>
              </form>
            </div>

            {/* PRODUCT LIST */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map(product => (
                <div key={product.id} className="bg-[#141414] border border-white/5 rounded-lg p-4 flex gap-3 relative group">
                  <div className="w-20 h-20 bg-gray-800 rounded overflow-hidden shrink-0">
                    <img src={product.image_url || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-white font-medium">{product.name}</h4>
                      <p className="text-[#C5A572] text-sm font-serif">Rp {product.price.toLocaleString()}</p>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 inline-block bg-white/5 px-1.5 py-0.5 rounded">{product.category}</p>
                    
                    {/* Added Description Display */}
                    {product.description && (
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="absolute top-2 right-2 p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}