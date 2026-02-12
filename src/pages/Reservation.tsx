import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../supabaseClient';

export default function Reservation() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    event_date: '',
    start_time: '',
    end_time: '',
    guest_count: '1',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const submitReservation = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.from('space_reservations').insert([
      {
        customer_name: form.name,
        phone: form.phone,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        guest_count: Number(form.guest_count),
        notes: form.notes,
        status: 'pending',
      },
    ]);

    if (error) setMessage(error.message);
    else {
      setMessage('Reservation submitted. Our team will contact you soon.');
      setForm({ name: '', phone: '', event_date: '', start_time: '', end_time: '', guest_count: '1', notes: '' });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] pt-24 px-4 pb-16">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-[#C5A572] mb-2">Ulun Coffee Space</p>
        <h1 className="text-3xl font-serif text-slate-900">Reservation</h1>
        <p className="text-slate-500 text-sm mt-2 mb-6">
          Rent Ulun Coffee space for meetings, workshops, and private gatherings.
        </p>

        <form onSubmit={submitReservation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input required placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input required type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input required type="number" min="1" placeholder="Guests" value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-2.5" />
          <textarea placeholder="Special requests" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-2 min-h-28 rounded-xl border border-slate-200 px-4 py-2.5" />
          <button disabled={loading} className="md:col-span-2 rounded-xl bg-[#C5A572] text-black font-semibold py-3 hover:bg-[#b18f60]">
            {loading ? 'Submitting...' : 'Submit Reservation'}
          </button>
        </form>

        {!!message && <p className="text-sm mt-4 text-slate-600">{message}</p>}
      </div>
    </div>
  );
}