'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
  align?: 'center' | 'sheet';
};

export default function Modal({
  title,
  onClose,
  children,
  footer,
  headerRight,
  align = 'center',
}: ModalProps) {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const dialog = (
    <div
      className={`fixed inset-0 z-[80] flex justify-center overflow-hidden bg-black/70 px-4 ${align === 'sheet' ? 'items-end' : 'items-center'}`}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#1c1c1e]"
        style={{ maxHeight: '90dvh', maxWidth: 'min(32rem, 100%)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#1c1c1e] px-5 py-4">
          <button type="button" onClick={onClose} className="shrink-0 text-base text-[#f0a050]">
            Cancel
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-white">{title}</h2>
          <div className="flex min-w-[4.5rem] shrink-0 justify-end">{headerRight}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [&_input]:!text-base [&_select]:!text-base [&_textarea]:!text-base">
          {children}
        </div>
        {footer ? (
          <div
            className="shrink-0 border-t border-[#1a1a1a] bg-[#1c1c1e] px-4 pt-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(dialog, document.body);
}
