import { ArrowRight, ChevronRight, User, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <main className="fixed inset-0 w-full h-full transition-all duration-700 z-10">
      <div className="relative w-full h-full flex flex-col justify-center items-center overflow-hidden">

        <div className="absolute inset-0 z-0">
           <img 
            src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?q=80&w=2000&auto=format&fit=crop" 
            alt="Dark Roast" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f]/80 via-transparent to-[#0f0f0f]" />
        </div>

        <div className="relative z-10 text-center px-6 w-full max-w-md md:max-w-4xl flex flex-col items-center">
          
          <p className="text-[#C5A572] text-[10px] md:text-xs uppercase tracking-[0.3em] mb-4 opacity-0 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
            Est. 2025 • Malinau
          </p>
          
          <h1 className="font-serif text-5xl md:text-8xl lg:text-9xl text-white mb-8 tracking-tight drop-shadow-2xl opacity-0 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            Savour the<br/> Moment.
          </h1>
          
          <div className="hidden md:flex flex-col gap-4 opacity-0 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            <button 
              onClick={() => navigate('/menu')}
              className="group relative px-10 py-4 rounded-full border border-white/20 transition-all hover:border-[#C5A572]/50 bg-black/20 backdrop-blur-sm min-w-[200px]"
            >
              <span className="relative flex items-center justify-center gap-4 text-white uppercase tracking-widest text-sm group-hover:text-[#C5A572]">
                Explore Menu <ArrowRight size={16} />
              </span>
            </button>
            
            <button 
              onClick={() => navigate('/login')}
              className="text-white/60 hover:text-white text-xs uppercase tracking-widest transition-colors py-2"
            >
              Login / Sign Up
            </button>
          </div>

          {/* --- MOBILE BUTTONS (Visible only on Mobile) --- */}
          <div className="grid grid-cols-2 gap-4 w-full md:hidden opacity-0 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
             <button 
                onClick={() => navigate('/menu')}
                className="bg-[#C5A572] text-black rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
             >
               <Coffee size={24} strokeWidth={1.5} />
               <span className="font-serif font-bold text-sm uppercase tracking-wide">Quick Order</span>
             </button>

             <button 
                onClick={() => navigate('/login')}
                className="bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
             >
               <User size={24} strokeWidth={1.5} />
               <span className="font-serif font-bold text-sm uppercase tracking-wide">Login</span>
             </button>
          </div>

        </div>
        
      </div>
    </main>
  );
}