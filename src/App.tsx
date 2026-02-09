import { useEffect, useState, useMemo } from 'react';
import { 
  ShoppingBag, X, Plus, Minus, ArrowRight, 
  Coffee, Loader2, ChevronRight 
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- 1. TYPES ---
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  image_url?: string; 
}

interface CartItem extends Product {
  cartId: string;
  quantity: number;
}

// --- 2. UI COMPONENTS ---
const UlunLogo = ({ className = "h-8" }) => (
  <svg viewBox="0 0 200 80" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M25,10 Q35,0 35,15 T45,25" strokeWidth="3" className="opacity-80" />
    <path d="M40,5 Q50,-5 50,10 T60,20" strokeWidth="3" className="opacity-80" />
    <path d="M20,40 v20 a15,15 0 0 0 30,0 v-20" strokeWidth="10" />
    <path d="M70,10 v50 a10,10 0 0 0 15,0" strokeWidth="10" />
    <path d="M100,40 v20 a15,15 0 0 0 30,0 v-20" strokeWidth="10" />
    <path d="M150,60 v-20 a15,15 0 0 1 30,0 v20" strokeWidth="10" />
  </svg>
);

const CATEGORIES = ['All', 'Signatures', 'Hot Coffee', 'Iced', 'Tea', 'Pastry'];

function App() {
  // --- 3. STATE ---
  const [view, setView] = useState<'landing' | 'menu'>('landing');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState<boolean>(true);
  const [scrolled, setScrolled] = useState(false);

  // --- 4. EFFECTS ---
  useEffect(() => {
    getProducts();
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function getProducts() {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*');
    if (error) console.error("Error fetching products:", error);
    else setProducts(data as Product[]);
    setLoading(false);
  }

  // --- 5. LOGIC ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, cartId: crypto.randomUUID(), quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.reduce((acc, item) => {
      if (item.id === productId) {
        return item.quantity > 1 ? [...acc, { ...item, quantity: item.quantity - 1 }] : acc;
      }
      return [...acc, item];
    }, [] as CartItem[]));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  async function handleCheckout() {
    if (!customerName.trim()) return alert("Please enter your name!");
    if (cart.length === 0) return alert("Cart is empty!");

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ customer_name: customerName, total_price: cartTotal, status: 'pending' }])
        .select();

      if (orderError) throw orderError;
      const newOrderId = orderData[0].id;

      const orderItemsData = cart.map(item => ({
        order_id: newOrderId,
        product_id: item.id,
        price_at_time: item.price,
        quantity: item.quantity 
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsData);
      if (itemsError) throw itemsError;

      let message = `Halo Kak, saya *${customerName}* mau pesan (Order #${newOrderId}):%0A%0A`;
      cart.forEach(item => {
        message += `- ${item.name} x${item.quantity} (Rp ${(item.price * item.quantity).toLocaleString()})%0A`;
      });
      message += `%0A*Total: Rp ${cartTotal.toLocaleString()}*%0A%0ATerima Kasih!`;
      
      window.open(`https://wa.me/6282325255305?text=${message}`, "_blank");

      setCart([]);
      setCustomerName('');
      setIsCartOpen(false);

    } catch (error: any) {
      alert("Checkout failed: " + error.message);
    }
  }

  // --- 6. RENDER HELPERS ---
  const ProductCard = ({ item }: { item: Product }) => {
    const cartItem = cart.find(c => c.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;

    return (
      <div className="bg-[#1a1a1a]/80 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden flex flex-col h-full touch-manipulation">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'} 
            alt={item.name} 
            className="object-cover w-full h-full opacity-90" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent opacity-90" />
          <div className="absolute bottom-2 left-3">
             <span className="text-[#C5A572] text-[10px] font-serif tracking-widest uppercase bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
               {item.category}
             </span>
          </div>
        </div>
        
        <div className="p-4 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-serif text-lg text-white leading-tight">{item.name}</h3>
            <span className="text-[#C5A572] font-medium text-sm whitespace-nowrap ml-2">
              Rp {item.price.toLocaleString()}
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-4 font-light leading-relaxed line-clamp-2">
            {item.description || "Premium ingredients, freshly prepared."}
          </p>

          <div className="mt-auto">
            {quantity === 0 ? (
              <button 
                onClick={() => addToCart(item)}
                className="w-full py-3 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-[#C5A572] hover:text-black hover:border-[#C5A572] transition-all duration-200 flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95"
              >
                <Plus size={14} /> Add
              </button>
            ) : (
              <div className="flex items-center justify-between bg-[#C5A572] text-black rounded-lg p-1 animate-in fade-in duration-200">
                <button onClick={() => removeFromCart(item.id)} className="p-2 active:bg-black/10 rounded transition-colors touch-manipulation">
                  <Minus size={16} />
                </button>
                <span className="font-bold font-serif text-sm">{quantity}</span>
                <button onClick={() => addToCart(item)} className="p-2 active:bg-black/10 rounded transition-colors touch-manipulation">
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-200 font-sans overflow-hidden">
      
      {/* --- NAVIGATION (Mobile Optimized) --- */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#0f0f0f]/90 backdrop-blur-md border-white/5 py-3' : 'bg-transparent border-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
          <button onClick={() => setView('landing')} className="text-white active:opacity-70 transition-opacity">
            <UlunLogo className="h-7 md:h-9 w-auto" />
          </button>

          <button onClick={() => setIsCartOpen(true)} className="relative p-2 active:scale-95 transition-transform">
            <ShoppingBag className="w-6 h-6 text-white" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-0 bg-[#C5A572] text-black text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-[#0f0f0f]">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* --- LANDING HERO (Full Screen Fixed) --- */}
      <main 
        className={`fixed inset-0 w-full h-full transition-all duration-700 z-10 
          ${view === 'landing' 
            ? 'opacity-100 scale-100 pointer-events-auto' 
            : 'opacity-0 scale-95 pointer-events-none blur-sm'
          }`}
      >
        <div className="relative w-full h-full flex flex-col justify-center items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
             <img 
              src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?q=80&w=2000&auto=format&fit=crop" 
              alt="Dark Roast" 
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f]/80 via-transparent to-[#0f0f0f]" />
          </div>

          <div className="relative z-10 text-center px-6 w-full max-w-md md:max-w-4xl">
            <p className="text-[#C5A572] text-[10px] md:text-xs uppercase tracking-[0.3em] mb-4 opacity-0 animate-fade-in-up" style={{animationDelay: '0.1s', animationFillMode: 'forwards'}}>
              Est. 2025 • Malinau
            </p>
            <h1 className="font-serif text-5xl md:text-8xl lg:text-9xl text-white mb-6 md:mb-8 tracking-tight drop-shadow-2xl opacity-0 animate-fade-in-up" style={{animationDelay: '0.2s', animationFillMode: 'forwards'}}>
              Savour the<br/> Moment.
            </h1>
            
            {/* Desktop Button */}
            <div className="hidden md:block opacity-0 animate-fade-in-up" style={{animationDelay: '0.4s', animationFillMode: 'forwards'}}>
              <button 
                onClick={() => setView('menu')}
                className="group relative px-10 py-4 rounded-full border border-white/20 transition-all hover:border-[#C5A572]/50 bg-black/20 backdrop-blur-sm"
              >
                <span className="relative flex items-center gap-4 text-white uppercase tracking-widest text-sm group-hover:text-[#C5A572]">
                  Explore Menu <ArrowRight size={16} />
                </span>
              </button>
            </div>
          </div>
          
          {/* Mobile Sticky Button (Bottom Fixed) */}
          <div className="md:hidden absolute bottom-8 left-0 w-full px-6 z-20">
             <button 
                onClick={() => setView('menu')}
                className="w-full bg-[#C5A572] text-black font-serif font-bold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(197,165,114,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-transform"
             >
               Order Now <ChevronRight size={20} />
             </button>
          </div>
        </div>
      </main>

      {/* --- MENU OVERLAY --- */}
      <div 
        className={`fixed inset-0 z-30 bg-[#0f0f0f] transition-transform duration-500 ease-in-out
          ${view === 'menu' ? 'translate-y-0' : 'translate-y-[100vh]'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header Section */}
          <div className="pt-20 pb-2 px-4 md:px-6 border-b border-white/5 bg-[#0f0f0f]/95 backdrop-blur-sm z-40">
            <div className="max-w-7xl mx-auto w-full">
              <div className="flex justify-between items-end mb-4">
                <div>
                   <h2 className="text-3xl md:text-4xl font-serif text-white">Menu</h2>
                </div>
                {/* Close Menu Button */}
                <button 
                  onClick={() => setView('landing')} 
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Categories */}
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar touch-pan-x">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`whitespace-nowrap pb-2 text-xs md:text-sm uppercase tracking-widest relative transition-colors ${
                      activeCategory === cat ? 'text-[#C5A572] font-medium' : 'text-gray-500'
                    }`}
                  >
                    {cat}
                    {activeCategory === cat && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#C5A572] rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable Grid */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-32">
            <div className="max-w-7xl mx-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <Loader2 className="animate-spin mb-4 text-[#C5A572]" size={32} />
                  <p className="font-serif text-sm">Brewing...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products
                    .filter(item => activeCategory === 'All' || item.category === activeCategory)
                    .map(item => <ProductCard key={item.id} item={item} />)
                  }
                  {/* Spacer for bottom padding on mobile */}
                  <div className="h-12 md:hidden"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Floating Cart Summary */}
        {cartCount > 0 && view === 'menu' && (
          <div className="absolute bottom-6 left-0 w-full px-4 md:hidden z-50">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#C5A572] text-black p-4 rounded-xl shadow-2xl flex justify-between items-center active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="bg-black text-[#C5A572] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {cartCount}
                </div>
                <span className="font-serif font-bold text-sm">View Cart</span>
              </div>
              <span className="font-bold font-serif text-sm">Rp {cartTotal.toLocaleString()}</span>
            </button>
          </div>
        )}
      </div>

      {/* --- CART DRAWER (Full Screen on Mobile) --- */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsCartOpen(false)}
          />
          
          {/* Drawer Content */}
          <div className="relative w-full md:w-[450px] bg-[#141414] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#141414]">
              <h2 className="text-xl font-serif text-white">Your Order</h2>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <Coffee size={48} />
                  <p className="mt-4 font-serif text-sm">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.cartId} className="flex gap-4 items-center animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                      <img src={item.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif text-white text-sm truncate">{item.name}</h4>
                      <p className="text-[#C5A572] text-xs mt-0.5">Rp {(item.price * item.quantity).toLocaleString()}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20"><Minus size={12} /></button>
                        <span className="text-xs font-mono w-4 text-center">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-white active:bg-white/20"><Plus size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-white/5 bg-[#1a1a1a] safe-area-bottom">
                <input 
                  type="text" 
                  placeholder="Enter Your Name..." 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-transparent border-b border-white/20 py-3 mb-6 focus:outline-none focus:border-[#C5A572] text-sm transition-colors"
                />
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs uppercase tracking-widest text-gray-500">Total</span>
                  <span className="text-xl font-serif text-[#C5A572]">Rp {cartTotal.toLocaleString()}</span>
                </div>
                <button 
                  onClick={handleCheckout} 
                  className="w-full bg-[#C5A572] text-black font-bold font-serif py-4 rounded-lg uppercase tracking-widest hover:bg-[#b09366] transition-colors flex justify-center items-center gap-2 active:scale-95"
                >
                  <span>Order via WhatsApp</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CSS UTILS --- */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation-name: fade-in-up;
          animation-duration: 0.8s;
          animation-timing-function: ease-out;
        }
      `}</style>
    </div>
  );
}

export default App;