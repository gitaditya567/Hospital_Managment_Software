import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full group">
        {label && (
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 group-focus-within:text-blue-600 transition-colors">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.01)]",
            error && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-rose-600 font-medium mt-0.5">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
