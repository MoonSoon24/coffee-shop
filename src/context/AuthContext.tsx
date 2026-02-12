import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Helper to consolidate state updates
    const handleSession = (currentSession: Session | null) => {
      if (!mounted) return;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      checkAdmin(currentSession?.user ?? null);
      setLoading(false);
    };

    // 1. Check active session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Listen for changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAdmin = (currentUser: User | null) => {
    // Safety check: ensure user exists and has an email
    if (!currentUser || !currentUser.email) {
      setIsAdmin(false);
      return;
    }

    const adminEmails = ['admin@ulun.com', 'sbstn.stp@gmail.com'];
    
    // Check if the user's email is in the allowed list
    setIsAdmin(adminEmails.includes(currentUser.email));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, isAdmin }}>
      {loading ? (
        // Loading State UX
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', // Full viewport height for centering
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Simple CSS Spinner */}
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3b82f6', // Blue color
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <span>Loading application...</span>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};