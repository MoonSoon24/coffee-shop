import { ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UlunLogo } from '../common/UlunLogo';
import { useCart } from '../../context/CartContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { cartCount, setIsCartOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#0f0f0f]/90 backdrop-blur-md border-white/5 py-3' : 'bg-transparent border-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-white active:opacity-70 transition-opacity">
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
  );
}