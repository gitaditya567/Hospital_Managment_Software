import React from 'react';
import { cn } from '../../lib/utils';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
}

export function DataTable<T>({ columns, data, className }: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-auto rounded-2xl border border-slate-100/90 shadow-[0_4px_18px_-4px_rgba(0,0,0,0.02)] bg-white", className)}>
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
          <tr>
            {columns.map((col, index) => (
              <th key={String(col.key) + index} className="px-6 py-4 font-extrabold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/60">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-50/60 transition-colors duration-150">
              {columns.map((col, colIndex) => (
                <td key={String(col.key) + colIndex} className="px-6 py-4 text-slate-600 font-medium text-xs">
                  {col.render ? col.render(row) : String(row[col.key as keyof T])}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                No data records available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
