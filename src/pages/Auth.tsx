import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Loader2 } from 'lucide-react';
import { useFeedback } from '../context/FeedbackContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useFeedback();

  const getFriendlyError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'Wrong email or password. Please try again.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Your email is not verified yet. Please check your inbox.';
    }
    if (lower.includes('user already registered')) {
      return 'This email is already registered. Please sign in instead.';
    }
    return message;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const adminEmails = ['jarulun04@gmail.com', 'sbstn.stp@gmail.com'];
        const userEmail = data.user?.email;

        showToast('Signed in successfully.', 'success');
        if (userEmail && adminEmails.includes(userEmail)) {
          navigate('/admin');
        } else {
          navigate('/menu');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;

        if (!data.session) {
          showToast('Confirmation sent to your email. Please verify, then sign in.', 'success');
          setIsLogin(true);
          setPassword('');
          return;
        }

        showToast('Account created. You are now signed in.', 'success');
        navigate('/menu');
      }
    } catch (error: any) {
      showToast(getFriendlyError(error.message || 'Authentication failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-4 relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2000&auto=format&fit=crop"
          alt="Coffee bg"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/80 to-transparent" />
      </div>

      <div className="z-10 w-full max-w-md bg-[#141414]/90 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl">
        <h2 className="text-3xl font-serif text-white mb-2 text-center">{isLogin ? 'Welcome Back' : 'Join Us'}</h2>
        <p className="text-white/50 text-sm text-center mb-8">
          {isLogin ? 'Sign in to access your orders' : 'Create an account to start ordering'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#C5A572] focus:outline-none transition-colors"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[#C5A572] focus:outline-none transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C5A572] text-black font-bold py-3 rounded-lg mt-4 hover:bg-[#b09366] transition-all active:scale-95 flex justify-center items-center"
          >
            {loading ? <Loader2 className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-white/60 hover:text-[#C5A572] underline underline-offset-4"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}