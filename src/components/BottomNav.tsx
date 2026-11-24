'use client';

import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          fill={active ? 'var(--amber)' : 'none'}
          stroke={active ? 'var(--amber)' : '#444'}
          strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/finance',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2"
          fill={active ? 'var(--amber)' : 'none'}
          stroke={active ? 'var(--amber)' : '#444'}
          strokeWidth="1.5"/>
        <path d="M2 10H22" stroke={active ? '#000' : '#444'} strokeWidth="1.5"/>
        <path d="M6 15H10" stroke={active ? '#000' : '#444'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'health',
    label: 'Health',
    href: '/health',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 14 21 12 21Z"
          fill={active ? 'var(--amber)' : 'none'}
          stroke={active ? 'var(--amber)' : '#444'}
          strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'today',
    label: 'Today',
    href: '/today',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="2"
          fill={active ? 'var(--amber)' : 'none'}
          stroke={active ? 'var(--amber)' : '#444'}
          strokeWidth="1.5"/>
        <path d="M3 9H21" stroke={active ? '#000' : '#444'} strokeWidth="1.5"/>
        <path d="M8 2V6M16 2V6" stroke={active ? 'var(--amber)' : '#444'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'More',
    href: '/more',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="1.5" fill={active ? 'var(--amber)' : '#444'}/>
        <circle cx="12" cy="12" r="1.5" fill={active ? 'var(--amber)' : '#444'}/>
        <circle cx="19" cy="12" r="1.5" fill={active ? 'var(--amber)' : '#444'}/>
      </svg>
    ),
  },
];

function tabFromPath(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname === '/finance' || pathname.startsWith('/finance/')) return 'finance';
  if (pathname === '/health' || pathname.startsWith('/health/')) return 'health';
  if (
    pathname === '/today' ||
    pathname === '/calendar' ||
    pathname === '/tasks' ||
    pathname.startsWith('/calendar/') ||
    pathname.startsWith('/tasks/')
  ) return 'today';
  return 'more';
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const active = tabFromPath(pathname || '/');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-[#1a1a1a]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                router.push(tab.href);
              }}
              className="flex flex-col items-center gap-0.5 flex-1 py-1 active:opacity-70 transition-opacity"
            >
              {tab.icon(isActive)}
              <span className="text-[10px] font-medium"
                style={{ color: isActive ? 'var(--amber)' : '#444' }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
