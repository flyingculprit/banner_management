'use client';

import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onClose: () => void;
}

export default function StatusModal({
  isOpen,
  type,
  title,
  message,
  confirmText = 'Got it',
  cancelText,
  onConfirm,
  onClose,
}: StatusModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-8 h-8 text-amber-400" />;
      default:
        return <Info className="w-8 h-8 text-cyan-400" />;
    }
  };

  const getBadgeStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-2xl border ${getBadgeStyle()}`}>
            {getIcon()}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{message}</p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          {cancelText && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-xs font-semibold text-white transition shadow-lg ${
              type === 'error'
                ? 'bg-rose-600 hover:bg-rose-500'
                : type === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}