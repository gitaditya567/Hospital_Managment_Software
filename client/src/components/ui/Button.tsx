import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/10',
      secondary: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-500/10',
      outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
      ghost: 'bg-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-950',
      destructive: 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 shadow-md shadow-rose-500/10',
    };

    const sizes = {
      sm: 'h-9 px-3.5 text-xs',
      md: 'h-10.5 px-5 text-sm',
      lg: 'h-12 px-8 text-base',
      icon: 'h-10.5 w-10.5 flex items-center justify-center p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold tracking-wide transition-all duration-200 hover:-translate-y-[1.5px] hover:scale-[1.01] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
