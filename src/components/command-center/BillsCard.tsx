'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: string | null;
  payment_account: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BillsCard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finance/bills')
      .then((r) => r.json())
      .then((d) => {
        // Only show bills due within 7 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(today.getDate() + 7);

        const soon = (d.bills || []).filter((b: Bill) => {
          if (!b.due_date) return false;
          const due = new Date(b.due_date + 'T00:00:00');
          return due <= in7Days;
        });

        setBills(soon);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Link href="/finance?tab=bills" className="block">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bills Due Soon</span>
          <span className="text-xs text-gray-400">Next 7 days</span>
        </div>

        {loading && (
          <div className="h-10 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && bills.length === 0 && (
          <p className="text-xs text-gray-400">No bills due in the next 7 days</p>
        )}

        {!loading && bills.length > 0 && (
          <div className="space-y-2">
            {bills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{bill.name}</p>
                  <p className="text-xs text-gray-400">{bill.due_date ? formatDate(bill.due_date) : ''}</p>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">
                  {formatCurrency(bill.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}