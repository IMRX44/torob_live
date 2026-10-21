export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="10" fill="var(--brand)" />
        <path d="M16 6.5c-4.1 0-7.4 3.2-7.4 7.2 0 5.3 6.2 10.9 6.9 11.5.3.3.7.3 1 0 .7-.6 6.9-6.2 6.9-11.5 0-4-3.3-7.2-7.4-7.2Z" fill="#fff" />
        <circle cx="16" cy="13.6" r="3.1" fill="var(--brand)" />
      </svg>
      {compact ? null : (
        <span className="leading-none">
          <span className="block text-[17px] font-black tracking-tight">ترب حضوری</span>
          <span className="block text-[10px] font-medium text-muted">دستیار خرید از مغازه‌های تهران</span>
        </span>
      )}
    </span>
  );
}
