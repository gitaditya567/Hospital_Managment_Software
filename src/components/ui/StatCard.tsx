import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-2xl border border-slate-100/90 shadow-[0_4px_18px_-4px_rgba(0,0,0,0.02)] flex items-center justify-between transition-all duration-350 ease-out hover:-translate-y-1 hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.05)]",
      className
    )}>
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none">{value}</h3>
        {trend && (
          <div className="pt-1">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border",
              trendUp 
                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                : "bg-rose-50 text-rose-700 border-rose-100"
            )}>
              <span>{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </span>
          </div>
        )}
      </div>
      <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 text-blue-600 flex items-center justify-center border border-blue-100/30 shadow-[0_2px_8px_-2px_rgba(37,99,235,0.08)] shrink-0">
        {icon}
      </div>
    </div>
  );
}
