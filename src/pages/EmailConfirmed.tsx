
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmailConfirmed() {
  const navigate = useNavigate();

  const isSuccess = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasAccessToken = !!hashParams.get('access_token');
    const authType = hashParams.get('type');
    return hasAccessToken && authType === 'signup';
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141414]/90 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-serif text-white mb-3">
          {isSuccess ? 'Your email is confirmed' : 'Verification link opened'}
        </h1>
        <p className="text-white/70 text-sm mb-6">
          {isSuccess
            ? 'Your account has been verified successfully. Continue to login to access your account.'
            : 'We could not verify the link details on this page. Please go to login and try signing in.'}
        </p>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full bg-[#C5A572] text-black font-bold py-3 rounded-lg hover:bg-[#b09366] transition-all active:scale-95"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}