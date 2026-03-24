import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { saveGuestOrderAccess } from '../utils/orderAccess';

export default function OrderRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const resolveOrderRedirect = async () => {
      const searchParams = new URLSearchParams(location.search);
      // Midtrans appends order_id to the query string
      const orderIdParam = searchParams.get('order_id') || searchParams.get('orderId');

      if (orderIdParam) {
        // Pro-tip: Split by '-' in case you later append timestamps to Midtrans IDs (explained below)
        const cleanOrderId = orderIdParam.split('-')[0];
        const parsedOrderId = Number(cleanOrderId);

        if (parsedOrderId) {
          const { data } = await supabase
            .from('orders')
            .select('id, customer_phone')
            .eq('id', parsedOrderId)
            .maybeSingle();

          if (data?.customer_phone) {
            saveGuestOrderAccess(data.id, data.customer_phone);
          }

          navigate(`/orders/${parsedOrderId}`, { replace: true });
          return;
        }
      }

      // Fallback if URL is invalid
      navigate('/menu', { replace: true });
    };

    resolveOrderRedirect();
  }, [location, navigate]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-12">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <h1 className="font-serif text-2xl text-slate-900 mb-2">Resolving your order...</h1>
        <p className="text-slate-500 text-sm">Please wait while we redirect you to your order details.</p>
      </div>
    </div>
  );
}