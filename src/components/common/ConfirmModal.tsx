import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 force-dark-overlay backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative bg-[#141414] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          {isDestructive && (
            <div className="bg-red-900/20 p-2 rounded-full text-red-500 shrink-0">
              <AlertTriangle size={24} />
            </div>
          )}
          
          <div className="flex-1">
            <h3 className="text-xl font-serif text-white mb-2 leading-none mt-1">{title}</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{message}</p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => { onConfirm(); onClose(); }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 ${
                  isDestructive 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-[#C5A572] text-black hover:bg-[#b09366]'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}