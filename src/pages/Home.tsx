import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0f0f0f]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2000&auto=format&fit=crop" 
          alt="Coffee Background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f]/80 via-[#0f0f0f]/50 to-[#0f0f0f]" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        
        {/* 1. Subheading (Est. 2025) */}
        <h2 
          className="text-[#C5A572] text-sm md:text-base tracking-[0.2em] uppercase font-sans mb-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.1s' }}
        >
          Est. 2025 • Malinau
        </h2>

        {/* 2. Main Heading (Savour the Moment) */}
        <h1 
          className="text-5xl md:text-8xl font-serif text-white mb-6 leading-tight opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          Savour the <br/>
          <span className="italic text-white/90">Moment.</span>
        </h1>

        {/* 3. Paragraph Description */}
        <p 
          className="text-gray-400 text-sm md:text-lg max-w-xl mx-auto mb-10 font-light leading-relaxed opacity-0 animate-fade-in-up"
          style={{ animationDelay: '0.3s' }}
        >
          Experience the finest artisanal coffee, crafted with passion and precision. 
          Join us for a journey of taste and tranquility.
        </p>

        {/* 4. Action Buttons */}
        <div 
          className="flex flex-col gap-4 opacity-0 animate-fade-in-up" 
          style={{ animationDelay: '0.4s' }}
        >
          <button 
            onClick={() => navigate('/menu')}
            className="group relative px-8 py-4 rounded-full border border-white/20 transition-all hover:border-[#C5A572]/50 bg-black/20 backdrop-blur-sm w-fit mx-auto"
          >
            <span className="relative flex items-center justify-center gap-4 text-white uppercase tracking-widest text-sm group-hover:text-[#C5A572]">
              Explore Menu <ArrowRight size={16} />
            </span>
          </button>
          
          {!user && (
            <button 
              onClick={() => navigate('/login')}
              className="text-white/60 hover:text-white text-xs uppercase tracking-widest transition-colors py-2 w-fit mx-auto"
            >
              Login / Sign Up
            </button>
          )}
        </div>

      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-white/20">
        <div className="w-6 h-10 border-2 border-current rounded-full flex justify-center p-1">
          <div className="w-1 h-2 bg-current rounded-full" />
        </div>
      </div>
    </div>
  );
}