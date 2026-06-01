"use client";

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import PullToRefresh from '@/components/PullToRefresh';

const modules = [
  { label: 'Knox', href: '/knox', icon: '🐺' },
  { label: 'Home', href: '/home', icon: '🏠' },
  { label: 'Vehicle', href: '/vehicle', icon: '🚗' },
  { label: 'Calendar', href: '/calendar', icon: '📅' },
  { label: 'Tasks', href: '/tasks', icon: '✅' },
  { label: 'Goals', href: '/goals', icon: '🎯' },
  { label: 'Spotify', href: '/spotify', icon: '🎵' },
  { label: 'Insurance', href: '/insurance', icon: '🛡️' },
  { label: 'Warranties', href: '/warranties', icon: '📄' },
  { label: 'Digital Wallet', href: '/wallet', icon: '💳' },
  { label: 'Journal', href: '/journal', icon: '📝' },
  { label: 'Alerts', href: '/alerts', icon: '🔔' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
  { label: 'AI Assistant', href: '/chat', icon: '🤖' },
];

export default function MorePage() {
  return (
    <div className="min-h-screen bg-background">
      <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
        <div className="px-4 pt-14 pb-24">
          <h1 className="text-2xl font-semibold mb-4">More</h1>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-sm">
            {modules.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-zinc-50 dark:active:bg-zinc-800 transition-colors"
              >
                <span className="text-xl w-7 text-center">{mod.icon}</span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex-1">
                  {mod.label}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 dark:text-zinc-600">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full mt-6 py-3.5 rounded-2xl border border-red-200 dark:border-red-900 text-red-500 text-sm font-medium active:bg-red-50 dark:active:bg-red-950 transition-colors"
          >
            Sign Out
          </button>

          <p className="text-center text-xs text-zinc-400 mt-4">
            Personal OS · Built with Claude
          </p>
        </div>
      </PullToRefresh>
    </div>
  );
}