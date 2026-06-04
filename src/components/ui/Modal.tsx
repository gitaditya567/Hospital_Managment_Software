import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div 
        className={cn(
          "bg-white rounded-2xl shadow-2xl border border-slate-100/80 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 cubic-bezier(0.34, 1.56, 0.64, 1) duration-300",
          className
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/60 bg-slate-50/20">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all duration-200 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
