import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type PromptOptions = {
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
};

type FeedbackContextType = {
  showToast: (message: string, type?: ToastType) => void;
  showPrompt: (options: PromptOptions) => Promise<string | null>;
};

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [promptState, setPromptState] = useState<{
    options: PromptOptions;
    value: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const showPrompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({
        options,
        value: options.initialValue || '',
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ showToast, showPrompt }), [showToast, showPrompt]);

  const closePrompt = () => {
    if (!promptState) return;
    promptState.resolve(null);
    setPromptState(null);
  };

  const submitPrompt = () => {
    if (!promptState) return;
    promptState.resolve(promptState.value.trim() || null);
    setPromptState(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="fixed top-5 right-5 z-[140] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-md ${
              toast.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                : toast.type === 'error'
                  ? 'border-red-400/40 bg-red-500/20 text-red-100'
                  : 'border-slate-400/40 bg-slate-900/80 text-slate-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {toast.type === 'success' && <CheckCircle2 size={16} className="mt-[1px] shrink-0" />}
              {toast.type === 'error' && <AlertTriangle size={16} className="mt-[1px] shrink-0" />}
              {toast.type === 'info' && <Info size={16} className="mt-[1px] shrink-0" />}
              <p className="leading-relaxed">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {promptState && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closePrompt} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl">
            <button className="absolute right-4 top-4 text-gray-400 hover:text-white" onClick={closePrompt}>
              <X size={18} />
            </button>
            <h3 className="text-xl font-serif text-white">{promptState.options.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{promptState.options.message}</p>
            <input
              className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 p-3 text-white outline-none focus:border-[#C5A572]"
              placeholder={promptState.options.placeholder || 'Type here...'}
              value={promptState.value}
              onChange={(e) => setPromptState((prev) => (prev ? { ...prev, value: e.target.value } : null))}
            />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closePrompt} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">
                {promptState.options.cancelText || 'Cancel'}
              </button>
              <button onClick={submitPrompt} className="rounded-lg bg-[#C5A572] px-4 py-2 text-sm font-semibold text-black hover:bg-[#b09366]">
                {promptState.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
};