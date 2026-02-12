import { ShoppingBag, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UlunLogo } from '../common/UlunLogo';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { cartCount, setIsCartOpen } = useCart();
  const { user, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHome = location.pathname === '/';
  const showQuickLinks = !isHome || scrolled;

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#0f0f0f]/90 backdrop-blur-md border-white/5 py-3' : 'bg-transparent border-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
        <button onClick={() => navigate('/')} className="text-white active:opacity-70 transition-opacity">
          <UlunLogo className="h-7 md:h-9 w-auto" />
        </button>

        <div className="hidden md:flex items-center gap-5 mr-auto ml-6">
          {showQuickLinks && (
            <>
              <button onClick={() => navigate('/menu')} className="text-xs uppercase tracking-[0.2em] text-white/80 hover:text-[#C5A572]">Menu</button>
              <button onClick={() => navigate('/reservation')} className="text-xs uppercase tracking-[0.2em] text-white/80 hover:text-[#C5A572]">Reserve</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(user ? (isAdmin ? '/admin' : '/profile') : '/login')}
            className="text-white hover:text-[#C5A572] transition-colors"
          >
            <User className="w-6 h-6" strokeWidth={1.5} />
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
      </div>
    </nav>
  );
}