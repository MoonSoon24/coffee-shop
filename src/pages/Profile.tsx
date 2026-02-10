import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(*, products(*))`)
        .eq('user_id', user!.id) // <--- THIS LINE IS CRITICAL (Filters by User ID)
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      else setOrders(data || []);
      setLoading(false);
    }
    fetchOrders();
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] pt-24 px-6 pb-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-serif text-white">My Profile</h1>
            <p className="text-gray-400 text-sm mt-1">{user?.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 px-4 py-2 rounded"
          >
            Log Out
          </button>
        </div>

        <h2 className="text-[#C5A572] text-xs uppercase tracking-widest mb-6">Order History</h2>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#C5A572]" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border border-white/5 rounded-xl">
            <Package className="mx-auto mb-3 opacity-50" size={32} />
            <p>No orders found yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-[#141414] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                      order.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {order.status}
                    </span>
                    <p className="text-gray-500 text-xs mt-2">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-serif text-[#C5A572]">Rp {order.total_price.toLocaleString()}</span>
                </div>
                
                <div className="space-y-2 border-t border-white/5 pt-3">
                  {order.order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-300">
                      <span>{item.products?.name} <span className="text-gray-600">x{item.quantity}</span></span>
                      {/* Using price_at_time so history is accurate even if prices change */}
                      <span>Rp {(item.price_at_time || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}