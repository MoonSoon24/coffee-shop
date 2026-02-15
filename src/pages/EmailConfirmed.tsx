import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

type VerificationStatus = 'checking' | 'success' | 'failed';

const allowedOtpTypes: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'email_change',
  'email',
  'recovery',
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return !!value && allowedOtpTypes.includes(value as EmailOtpType);
}

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus>('checking');

  const message = useMemo(() => {
    if (status === 'success') {
      return {
        title: 'Your email is confirmed',
        body: 'Your account has been verified successfully. Continue to login to access your account.',
      };
    }

    if (status === 'failed') {
      return {
        title: 'Verification link opened',
        body: 'We could not verify the link details on this page. Please go to login and try signing in.',
      };
    }

    return {
      title: 'Verifying your email…',
      body: 'Please wait while we confirm your email verification link.',
    };
  }, [status]);

  useEffect(() => {
    let active = true;

    const verifyEmail = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);

      const hasHashAccessToken = !!hashParams.get('access_token');
      const hashType = hashParams.get('type');

      const hasAuthError = !!(queryParams.get('error') || hashParams.get('error'));
      if (hasAuthError) {
        if (active) setStatus('failed');
        return;
      }

      if (hasHashAccessToken && hashType === 'signup') {
        if (active) setStatus('success');
        return;
      }

      const code = queryParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (active) setStatus(error ? 'failed' : 'success');
        return;
      }

      const tokenHash = queryParams.get('token_hash');
      const otpType = queryParams.get('type');
      if (tokenHash && isEmailOtpType(otpType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (active) setStatus(error ? 'failed' : 'success');
        return;
      }

      if (active) setStatus('failed');
    };

    verifyEmail();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141414]/90 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-serif text-white mb-3">{message.title}</h1>
        <p className="text-white/70 text-sm mb-6">{message.body}</p>

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