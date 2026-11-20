/** "localinkGo" set like the logo: dark "local", teal "ink", orange "Go" (the pin's second ring). */
export function Wordmark({ className = "text-lg" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-[#13261f] ${className}`} aria-label="LocalinkGo">
      local<span className="text-[#0e8a73]">ink</span>
      <span className="text-[#e69a27]">Go</span>
    </span>
  );
}

/** The pin mark and wordmark, with what this console is for underneath (sidebars). */
export function BrandHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/localink-mark.svg" alt="" className="size-10 shrink-0 drop-shadow-sm" />
      <div className="leading-tight">
        <Wordmark />
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">{label}</p>
      </div>
    </div>
  );
}

/** Compact version for the mobile top bar. */
export function BrandInline({ label }: { label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <img src="/brand/localink-mark.svg" alt="" className="size-7 shrink-0" />
      <Wordmark className="text-base" />
      <span className="truncate text-sm font-semibold text-ink-3">{label}</span>
    </span>
  );
}

/** The full logo (pin, wordmark and "Local marketplace"), for the sign-in page. */
export function FullLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex flex-col items-center ${className}`} role="img" aria-label="LocalinkGo, local marketplace">
      <img src="/brand/localink-mark.svg" alt="" className="size-20 drop-shadow-sm" />
      <Wordmark className="mt-2 text-4xl" />
      <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-[#13261f]">Local marketplace</span>
    </span>
  );
}
