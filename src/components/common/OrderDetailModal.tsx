import { CalendarDays, CircleDollarSign, ReceiptText, UserRound, X } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  isAdmin?: boolean;
};

const renderModifierText = (item: any) => {
  const selected = item.modifiers || {};
  const groups = item.products?.modifiers || [];

  return Object.entries(selected)
    .map(([groupId, selectedOptionIds]) => {
      const group = groups.find((g: any) => g.id === groupId);
      if (!group) return null;

      const labels = (selectedOptionIds as string[])
        .map((optId) => group.options?.find((opt: any) => opt.id === optId)?.name)
        .filter(Boolean);

      if (labels.length === 0) return null;
      return `${group.name}: ${labels.join(', ')}`;
    })
    .filter(Boolean);
};

export default function OrderDetailModal({ isOpen, onClose, order, isAdmin = false }: Props) {
  if (!isOpen || !order) return null;

  const statusTone =
    order.status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : order.status === 'cancelled'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-amber-100 text-amber-700';

  return (
    <div className="fixed inset-0 z-[80] bg-black/55 force-dark-overlay backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 p-4 md:p-5 flex justify-between items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#C5A572]">Order detail</p>
            <h3 className="font-serif text-xl text-slate-900 mt-1">Order #{order.id}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><CalendarDays size={14} /> Created</p>
              <p className="text-slate-800 font-medium">{new Date(order.created_at).toLocaleString()}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><CircleDollarSign size={14} /> Total</p>
              <p className="text-[#9c7a4c] font-serif text-lg">Rp {Number(order.total_price || 0).toLocaleString()}</p>
            </div>

            {isAdmin && (
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 sm:col-span-2 space-y-1">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><UserRound size={14} /> Customer</p>
                <p className="text-slate-800 font-medium">{order.customer_name || 'Guest Customer'}</p>
                <p className="text-xs text-slate-500">Phone: {order.customer_phone || '-'}</p>
                <p className="text-xs text-slate-500">Type: {(order.type || 'takeaway').toUpperCase()}</p>
                {order.type === 'delivery' && <p className="text-xs text-slate-500">Address: {order.address || '-'} </p>}
                {order.type === 'delivery' && order.maps_link && (
                  <a
                    href={order.maps_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#9c7a4c] hover:underline w-fit"
                  >
                    View map
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <span className={`text-[11px] px-2.5 py-1 rounded-full uppercase font-bold ${statusTone}`}>{order.status}</span>
            {!!order.points_used && (
              <p className="text-xs text-slate-500">
                Points used: <span className="font-semibold text-rose-600">-{order.points_used}</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <ReceiptText size={14} /> Items
            </p>
            <div className="space-y-2">
              {(order.order_items || []).map((item: any) => {
                const modifiers = renderModifierText(item);

                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.products?.name || 'Item'}</p>
                      <p className="text-xs text-slate-500 mt-1">Quantity: {item.quantity}</p>
                      {modifiers.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {modifiers.map((line, idx) => (
                            <p key={idx} className="text-[11px] text-slate-500">• {line}</p>
                          ))}
                        </div>
                      )}
                      {item.notes && <p className="text-[11px] italic text-slate-500 mt-1">Note: {item.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-700 shrink-0">Rp {Number(item.price_at_time || 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}