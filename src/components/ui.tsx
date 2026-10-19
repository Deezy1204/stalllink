"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "./icons";

// ---- primitives -----------------------------------------------------------------

/** `index` staggers the entrance animation when the card is inside a `.stagger` list. A `bg-…` class replaces the white background. */
export function Card({ children, className = "", index }: { children: ReactNode; className?: string; index?: number }) {
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-white";
  return (
    <div style={index == null ? undefined : ({ "--i": index } as React.CSSProperties)} className={`rounded-2xl border border-line ${bg} shadow-[0_2px_12px_rgba(20,27,43,0.04)] ${className}`}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "dark";
const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink",
  success: "bg-mint-100 text-mint-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  brand: "bg-brand-50 text-brand",
  dark: "bg-ink text-white",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variantClass: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-600 shadow-sm shadow-brand/20",
  secondary: "bg-white text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export function Button({ variant = "primary", loading, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

const fieldClass = (error?: string | null) =>
  `w-full rounded-xl border bg-white text-sm text-ink outline-none transition placeholder:text-ink-3 focus:ring-4 disabled:bg-surface ${
    error ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : "border-line focus:border-brand focus:ring-brand/10"
  }`;

/** Label, the control, then an error (red) or a hint (grey) under it. */
function FieldFrame({ label, hint, error, children }: { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({
  label,
  hint,
  error,
  prefix,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { label?: string; hint?: ReactNode; error?: string | null; prefix?: string }) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">{prefix}</span>}
        <input {...rest} aria-invalid={!!error || undefined} className={`h-11 px-3.5 ${prefix ? "pl-8" : ""} ${fieldClass(error)} ${className}`} />
      </span>
    </FieldFrame>
  );
}

export function Textarea({ label, hint, error, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string | null }) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <textarea {...rest} aria-invalid={!!error || undefined} className={`min-h-24 px-3.5 py-2.5 ${fieldClass(error)} ${className}`} />
    </FieldFrame>
  );
}

export function Select({ label, hint, error, className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string | null }) {
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <select {...rest} className={`h-11 px-3 ${fieldClass(error)} ${className}`}>
        {children}
      </select>
    </FieldFrame>
  );
}

/** An on/off switch with a title and an optional line under it. */
export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-3">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-ink-3/35"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** A selectable pill, for single or multiple choice. */
export function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${
        selected ? "bg-brand text-white shadow-sm shadow-brand/30" : "border border-line bg-white text-ink-2 hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "size-8" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-[3px] border-brand border-t-transparent ${className}`} />;
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 transition group-focus-within:text-brand">
        <Icon name="search" className="size-4" strokeWidth={2} />
      </span>
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3.5 text-sm outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 ${
            value === o.value ? "bg-brand text-white shadow-sm shadow-brand/30" : "border border-line bg-white text-ink-2 hover:bg-surface-2"
          }`}
        >
          {o.label}
          {o.count != null && <span className={`rounded-full px-1.5 text-xs ${value === o.value ? "bg-white/25" : "bg-surface-2"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-3">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ---- modal --------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** For forms and maps that need more room. */
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  // Portalled to <body>: the page's entrance animation leaves a transform on <main>,
  // which would otherwise pin this "fixed" overlay to <main> instead of the window.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] animate-fade-in sm:p-6" onClick={onClose}>
      <div className={`flex max-h-full w-full ${wide ? "max-w-2xl" : "max-w-lg"} animate-rise flex-col rounded-3xl bg-white shadow-2xl`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="min-w-0 truncate text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="group shrink-0 rounded-full p-1.5 text-ink-3 transition hover:bg-surface-2" aria-label="Close">
            <Icon name="close" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Promise-based confirm dialog: `if (await confirm({...})) …`. */
const ConfirmCtx = createContext<(o: { title: string; message: string; confirm?: string; danger?: boolean }) => Promise<boolean>>(async () => false);
const ToastCtx = createContext<(message: string, tone?: "ok" | "error") => void>(() => {});

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<{ title: string; message: string; confirm?: string; danger?: boolean } | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: "ok" | "error" }[]>([]);

  const confirm = useCallback((o: { title: string; message: string; confirm?: string; danger?: boolean }) => {
    setDialog(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const close = (v: boolean) => {
    setDialog(null);
    resolver.current(v);
  };
  const toast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        <Modal
          open={dialog != null}
          onClose={() => close(false)}
          title={dialog?.title ?? ""}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
              <Button variant={dialog?.danger ? "danger" : "primary"} onClick={() => close(true)}>{dialog?.confirm ?? "Confirm"}</Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">{dialog?.message}</p>
        </Modal>
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto animate-rise rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === "ok" ? "bg-ink" : "bg-red-700"}`}>
              {t.message}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
export const useToast = () => useContext(ToastCtx);
