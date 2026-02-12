import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  MapPin,
  Star,
  ChevronRight,
  Clock,
  Coffee,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

type WeeklyHighlight = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?q=80&w=800&auto=format&fit=crop';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [weeklyHighlights, setWeeklyHighlights] = useState<WeeklyHighlight[]>([]);

  useEffect(() => {
    const elements = document.querySelectorAll('.reveal-on-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
        });
      },
      { threshold: 0.15 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchWeeklyHighlights = async () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const diffFromMonday = (dayOfWeek + 6) % 7;
      startOfWeek.setDate(now.getDate() - diffFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const [{ data: weeklyItems, error: weeklyError }, { data: allProducts, error: productsError }] = await Promise.all([
        supabase
          .from('order_items')
          .select('quantity, products(id, name, price, image_url), orders!inner(status, created_at)')
          .eq('orders.status', 'completed')
          .gte('orders.created_at', startOfWeek.toISOString()),
        supabase.from('products').select('id, name, price, image_url, is_available'),
      ]);

      if (weeklyError) console.error('Error fetching weekly order items:', weeklyError);
      if (productsError) console.error('Error fetching products for fallback:', productsError);

      const purchasedMap = new Map<number, WeeklyHighlight>();

      (weeklyItems || []).forEach((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        if (!product?.id) return;

        const current = purchasedMap.get(product.id);
        const quantity = Number(item.quantity || 0);

        if (current) {
          current.quantity += quantity;
          return;
        }

        purchasedMap.set(product.id, {
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          image: product.image_url || FALLBACK_IMAGE,
          quantity,
        });
      });

      const topByCompletedOrders = [...purchasedMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 3);

      const selectedIds = new Set(topByCompletedOrders.map((item) => item.id));
      const randomFillers = (allProducts || [])
        .filter((product: any) => (product.is_available ?? true) && !selectedIds.has(product.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, topByCompletedOrders.length === 1 ? 2 : Math.max(0, 3 - topByCompletedOrders.length))
        .map((product: any) => ({
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          image: product.image_url || FALLBACK_IMAGE,
          quantity: 0,
        }));

      setWeeklyHighlights([...topByCompletedOrders, ...randomFillers].slice(0, 3));
    };

    fetchWeeklyHighlights();
  }, []);

  const displayedHighlights = weeklyHighlights;

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900 overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative h-screen flex items-center justify-center">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2000&auto=format&fit=crop"
            alt="Coffee Background"
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/80 to-[#f6f7fb]" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-[-5vh]">
          <h2 className="text-[#C5A572] text-sm md:text-base tracking-[0.3em] uppercase font-sans mb-4 animate-fade-in-up">
            Est. 2025 • Malinau
          </h2>
          <h1 className="text-5xl md:text-8xl font-serif text-slate-900 mb-6 leading-tight animate-fade-in-up delay-100">
            Savour the <br />
            <span className="italic text-[#C5A572]">Moment.</span>
          </h1>
          <p className="text-slate-600 text-sm md:text-lg max-w-xl mx-auto mb-10 font-light leading-relaxed animate-fade-in-up delay-200">
            Experience the finest artisanal coffee, crafted with passion and precision. Join us for a journey of taste
            and tranquility.
          </p>

          <div className="flex flex-col gap-4 animate-fade-in-up delay-300 items-center">
            <button
              onClick={() => navigate('/menu')}
              className="group relative px-8 py-4 rounded-full border border-slate-300 transition-all hover:border-[#C5A572] hover:bg-[#C5A572]/10 bg-white/80 backdrop-blur-md shadow-sm"
            >
              <span className="relative flex items-center justify-center gap-3 text-slate-900 uppercase tracking-widest text-xs md:text-sm group-hover:text-[#9c7a4c] transition-colors">
                Order Now <ArrowRight size={16} />
              </span>
            </button>

            {!user && (
              <button
                onClick={() => navigate('/login')}
                className="text-slate-500 hover:text-slate-900 text-xs uppercase tracking-widest transition-colors py-2"
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </div>

        {/* Scroll Hint */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-slate-400 hidden md:block">
          <div className="w-6 h-10 border-2 border-current rounded-full flex justify-center p-1">
            <div className="w-1 h-2 bg-current rounded-full" />
          </div>

        </div>
      </section>

      {/* --- BESTSELLERS PREVIEW --- */}
      <section className="py-24 px-6 relative overflow-hidden bg-[#f6f7fb] reveal-on-scroll">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#C5A572] rounded-full blur-[120px] opacity-10 pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-[#C5A572] text-xs tracking-widest uppercase mb-2">Customer Favorites</h2>
              <h3 className="text-4xl font-serif text-slate-900">Weekly Highlights</h3>
            </div>
            <button
              onClick={() => navigate('/menu')}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#9c7a4c] transition-colors"
            >
              View Full Menu <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex md:grid md:grid-cols-3 gap-0 md:gap-8 overflow-x-auto md:overflow-visible pb-2 no-scrollbar snap-x snap-mandatory">
            {displayedHighlights.map((item) => (
              <div
                key={item.id}
                className="group cursor-pointer shrink-0 w-full min-w-full md:min-w-0 md:w-auto snap-start"
                onClick={() => navigate('/menu')}
              >
                <div className="overflow-hidden rounded-2xl mb-4 aspect-[4/5] relative shadow-sm border border-slate-200 bg-white">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10" />
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-medium text-slate-900 group-hover:text-[#9c7a4c] transition-colors">{item.name}</h4>
                    <div className="flex gap-1 text-[#C5A572] text-xs mt-1">
                      <Star size={12} fill="currentColor" />
                      <Star size={12} fill="currentColor" />
                      <Star size={12} fill="currentColor" />
                      <Star size={12} fill="currentColor" />
                      <Star size={12} fill="currentColor" />
                    </div>
                  </div>
                  <span className="text-lg font-serif text-slate-700">Rp {item.price.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden mt-3 flex justify-center gap-1.5">
            {displayedHighlights.map((item) => (
              <span key={`dot-${item.id}`} className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            ))}
          </div>
        </div>
      </section>

      {/* --- ABOUT / STORY --- */}
      <section className="py-24 px-6 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="w-full md:w-1/2 relative">
            <div className="aspect-square rounded-full overflow-hidden border border-slate-200 relative z-10 shadow-md">
              <img
                src="https://images.unsplash.com/photo-1442512595331-e89e7385a861?q=80&w=800&auto=format&fit=crop"
                alt="Pouring Coffee"
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 w-full h-full rounded-full border border-[#C5A572]/30 -z-0 hidden md:block" />
          </div>

          <div className="w-full md:w-1/2 text-center md:text-left">
            <h2 className="text-[#C5A572] text-xs tracking-widest uppercase mb-4">Our Story</h2>
            <h3 className="text-4xl md:text-5xl font-serif text-slate-900 mb-6">Born in Malinau.</h3>
            <p className="text-slate-600 leading-relaxed mb-8 font-light text-lg">
              What started as a small passion project in the heart of Malinau has grown into a sanctuary for coffee
              lovers. We believe that a cup of coffee is more than just caffeine—it&apos;s a moment of pause in a busy world.
            </p>
            <div className="flex flex-col md:flex-row gap-8 justify-center md:justify-start">
              <div>
                <span className="block text-3xl font-serif text-slate-900">5k+</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Happy Customers</span>
              </div>
              <div>
                <span className="block text-3xl font-serif text-slate-900">12+</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Signature Blends</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- MAP SECTION --- */}
      <section className="py-24 px-6 bg-[#f6f7fb] reveal-on-scroll">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[#C5A572] text-sm tracking-[0.2em] uppercase font-sans mb-3">Visit Us</h2>
            <h3 className="text-4xl font-serif text-slate-900">Find your way home.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 order-2 md:order-1">
              <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-[#C5A572]/15 rounded-full text-[#9c7a4c]">
                    <Clock size={24} />
                  </div>
                  <h4 className="text-xl font-serif text-slate-900">Opening Hours</h4>
                </div>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex justify-between border-b border-slate-200 pb-2">
                    <span>Sun - Fri</span>
                    <span className="text-slate-900">10:00 - 23:00</span>
                  </li>
                  <li className="flex justify-between pt-2">
                    <span>Sat - Sun</span>
                    <span className="text-slate-900">11:00 - 23:00</span>
                  </li>
                </ul>
              </div>

              <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-[#C5A572]/15 rounded-full text-[#9c7a4c]">
                    <MapPin size={24} />
                  </div>
                  <h4 className="text-xl font-serif text-slate-900">Address</h4>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Jl. Raja Pandhita, Malinau Kota,
                  <br />
                  North Kalimantan, Indonesia
                </p>
              </div>
            </div>

            <div className="h-[450px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xl order-1 md:order-2 group">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1321.8903094462487!2d116.60767454497886!3d3.5758756630566526!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3216dd003e3ae147%3A0xe54ecb66edfb168b!2sULUN%20Cafe!5e0!3m2!1sen!2sid!4v1770829385787!5m2!1sen!2sid"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 opacity-80 group-hover:opacity-100"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-white pt-24 pb-12 px-6 border-t border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <h4 className="text-2xl font-serif text-slate-900 mb-6">Ulun Coffee</h4>
            <p className="text-slate-500 text-sm leading-relaxed">
              Crafting moments, one cup at a time. Visit our main house in Malinau for the full experience.
            </p>
          </div>

          <div>
            <h5 className="text-slate-900 font-medium mb-6">Explore</h5>
            <ul className="space-y-4 text-sm text-slate-500">
              <li>
                <button onClick={() => navigate('/menu')} className="hover:text-[#9c7a4c] transition-colors">
                  Our Menu
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/profile')} className="hover:text-[#9c7a4c] transition-colors">
                  My Account
                </button>
              </li>
              <li>
                <span className="cursor-pointer hover:text-[#9c7a4c] transition-colors">Careers</span>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-slate-900 font-medium mb-6">Contact</h5>
            <div className="space-y-4 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <Coffee className="w-5 h-5 text-[#9c7a4c] shrink-0" />
                <span>jarulun04@gmail.com</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#9c7a4c] shrink-0" />
                <span>Malinau Kota, North Kalimantan</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-slate-900 font-medium mb-6">Stay Connected</h5>
            <p className="text-slate-500 text-sm mb-4">Follow us for the latest brews and news.</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>&copy; 2025 Ulun Coffee. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-700 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-700 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
}