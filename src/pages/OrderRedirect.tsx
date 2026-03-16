import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { saveGuestOrderAccess } from '../utils/orderAccess';

const extractOrderIdFromHash = (hash: string) => {
  if (!hash) return '';
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);
  return hashParams.get('order_id') || hashParams.get('orderId') || '';
};

export default function OrderRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  const orderId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);

    return (
      searchParams.get('order_id') ||
      searchParams.get('orderId') ||
      extractOrderIdFromHash(location.hash) ||
      ''
    );
  }, [location.search, location.hash]);

  useEffect(() => {
    if (!orderId) return;
    const continueToOrderDetail = async () => {
      const parsedOrderId = Number(orderId);
      if (!parsedOrderId) {
        navigate('/menu', { replace: true });
        return;
      }

      const { data } = await supabase
        .from('orders')
        .select('id, user_id, customer_phone')
        .eq('id', parsedOrderId)
        .maybeSingle();

      if (data && !data.user_id) {
        saveGuestOrderAccess(data.id, data.customer_phone || '');
      }

      navigate(`/orders/${parsedOrderId}`, { replace: true });
    };

    continueToOrderDetail();
  }, [navigate, orderId]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-12">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <h1 className="font-serif text-2xl text-slate-900 mb-2">Resolving your order</h1>
        {orderId ? (
          <p className="text-slate-500 text-sm">Redirecting to your order detail page...</p>
        ) : (
          <p className="text-slate-500 text-sm">Missing order ID in URL. Please check your payment redirect settings or recover manually with your order ID and phone number.</p>
        )}
      </div>
    </div>
  );
}