'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import PullToRefresh from '@/components/PullToRefresh';

const GROUPS = [
  {
    label: 'Personal',
    items: [
      { label: 'Knox', href: '/knox', icon: '🐺' },
      { label: 'Vehicle', href: '/vehicle', icon: '🚗' },
      { label: 'Home', href: '/home', icon: '🏠' },
    ],
  },
  {
    label: 'Schedule',
    items: [
      { label: 'Calendar', href: '/calendar', icon: '📅' },
      { label: 'Tasks', href: '/tasks', icon: '✅' },
      { label: 'Goals', href: '/goals', icon: '🎯' },
    ],
  },
  {
    label: 'Finance & Assets',
    items: [
      { label: 'Insurance', href: '/insurance', icon: '🛡️' },
      { label: 'Warranties', href: '/warranties', icon: '📄' },
      { label: 'Digital Wallet', href: '/wallet', icon: '💳' },
    ],
  },
  {
    label: 'Lifestyle',
    items: [
      { label: 'Spotify', href: '/spotify', icon: '🎵' },
      { label: 'Journal', href: '/journal', icon: '📝' },
      { label: 'Alerts', href: '/alerts', icon: '🔔' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'AI Assistant', href: '/chat', icon: '🤖' },
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black">
      <PullToRefresh onRefresh={async () => { window.location.reload(); }}>
        <div className="px-4 pt-6 pb-24">

          {/* Header */}
          <div className="mb-5">
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: 'Syne, system-ui, sans-serif' }}
            >
              More
            </h1>
            <p className="text-[#555] text-sm mt-0.5">All modules</p>
          </div>

          {/* Module groups */}
          <div className="space-y-5">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[#555] text-xs font-semibold uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </p>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  {group.items.map((mod, i) => (
                    <div
                      key={mod.href}
                      onClick={() => router.push(mod.href)}
                      className={`flex items-center gap-3.5 px-4 py-3.5 active:bg-[#1a1a1a] transition-colors cursor-pointer ${
                        i < group.items.length - 1 ? 'border-b border-[#1a1a1a]' : ''
                      }`}
                    >
                      <span className="text-xl w-7 text-center leading-none">{mod.icon}</span>
                      <span className="text-white text-sm font-medium flex-1">{mod.label}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#333]"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full mt-6 py-3.5 rounded-2xl border border-[#2a1010] text-[#ef4444] text-sm font-medium active:bg-[#1a0808] transition-colors"
          >
            Sign Out
          </button>

          <p className="text-center text-xs text-[#333] mt-5">
            Personal OS · Built with Claude
          </p>
        </div>
      </PullToRefresh>
    </div>
  );
}