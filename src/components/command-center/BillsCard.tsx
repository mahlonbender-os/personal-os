'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: string | null;
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BillsCard() {
  const [todayBills, setTodayBills] = useState<Bill[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finance/bills')
      .then((r) => r.json())
      .then((d) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(today.getDate() + 7);

        const soon: Bill[] = (d.bills || []).filter((b: Bill) => {
          if (!b.due_date) return false;
          const due = new Date(b.due_date + 'T00:00:00');
          return due <= in7Days;
        });

        const todayList = soon.filter((b) => b.due_date && isToday(b.due_date));
        const upcomingList = soon.filter((b) => !b.due_date || !isToday(b.due_date));
        const grandTotal = soon.reduce((s, b) => s + Math.abs(b.amount), 0);

        setTodayBills(todayList);
        setUpcomingBills(upcomingList);
        setTotal(grandTotal);
        setCount(soon.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Link href="/finance" className="block h-full">
      <div className="h-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm active:scale-[0.98] transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Bills Due Soon
          </span>
          <span className="text-xs text-gray-400">7 days</span>
        </div>

        {loading && (
          <div className="h-20 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && count === 0 && (
          <p className="text-xs text-gray-400">No bills due in the next 7 days</p>
        )}

        {!loading && count > 0 && (
          <>
            {/* Summary */}
            <div className="mb-3">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {formatAmount(total)}
              </p>
              <p className="text-xs text-gray-400">{count} bill{count !== 1 ? 's' : ''}</p>
            </div>

            {/* Scrollable bill list */}
            <div className="overflow-y-auto max-h-36 space-y-1.5 -mx-1 px-1">
              {/* Today's bills — expanded */}
              {todayBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 truncate">
                      {bill.name}
                    </p>
                    <p className="text-xs text-orange-500">Due today</p>
                  </div>
                  <p className="text-xs font-bold text-orange-700 dark:text-orange-400 flex-shrink-0">
                    {formatAmount(bill.amount)}
                  </p>
                </div>
              ))}

              {/* Upcoming bills — compact */}
              {upcomingBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-2 px-1"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {bill.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {bill.due_date ? formatDate(bill.due_date) : ''}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {formatAmount(bill.amount)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}