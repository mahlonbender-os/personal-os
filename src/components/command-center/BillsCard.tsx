'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

const MAX_VISIBLE = 4;

export default function BillsCard() {
  const [todayBills, setTodayBills] = useState<Bill[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  // Combine today first, then upcoming, cap at MAX_VISIBLE
  const allBills = [...todayBills, ...upcomingBills];
  const visibleBills = allBills.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, allBills.length - MAX_VISIBLE);

  return (
    <div
      className="h-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
      onClick={() => router.push('/finance')}
    >
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
            <p className="text-base font-bold text-gray-800 dark:text-gray-100">
              {formatAmount(total)}
            </p>
            <p className="text-xs text-gray-400">{count} bill{count !== 1 ? 's' : ''}</p>
          </div>

          {/* Bill list — max 4 visible, no scroll */}
          <div className="space-y-1.5">
            {visibleBills.map((bill) => {
              const today = bill.due_date && isToday(bill.due_date);
              return (
                <div
                  key={bill.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                    today
                      ? 'bg-orange-50 dark:bg-orange-900/20'
                      : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${
                      today
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {bill.name}
                    </p>
                    <p className={`text-xs ${today ? 'text-orange-500' : 'text-gray-400'}`}>
                      {today ? 'Due today' : bill.due_date ? formatDate(bill.due_date) : ''}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold flex-shrink-0 ${
                    today
                      ? 'text-orange-700 dark:text-orange-400'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}>
                    {formatAmount(bill.amount)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* View all link */}
          {hiddenCount > 0 && (
            <p className="text-xs text-blue-500 mt-2 text-right">
              +{hiddenCount} more →
            </p>
          )}
        </>
      )}
    </div>
  );
}