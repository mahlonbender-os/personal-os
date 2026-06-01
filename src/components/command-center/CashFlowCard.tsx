'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MonthData {
  month: string;
  income: number;
  essentials: number;
  discretionary: number;
  net: number;
}

function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function CashFlowCard() {
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/finance/cash-flow')
      .then((r) => r.json())
      .then((d) => {
        const now = new Date();
        const monthName = now.toLocaleString('default', { month: 'long' });
        const found = d.months?.find((m: MonthData) =>
          m.month?.toLowerCase().includes(monthName.toLowerCase())
        );
        setData(found || null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <Link href="/finance" className="block">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cash Flow</span>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleString('default', { month: 'long' })}
          </span>
        </div>

        {loading && (
          <div className="h-12 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-xs text-gray-400">Connect Google Sheets to see data</p>
        )}

        {!loading && !error && !data && (
          <p className="text-xs text-gray-400">No data for this month yet</p>
        )}

        {data && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Income</p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                {formatCurrency(data.income, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Spent</p>
              <p className="text-sm font-bold text-red-500 dark:text-red-400">
                {formatCurrency(data.essentials + data.discretionary, true)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Net</p>
              <p className={`text-sm font-bold ${data.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {formatCurrency(data.net, true)}
              </p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}