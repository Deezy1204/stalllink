/** LocalinkGo's Terms & Conditions and Privacy Policy, published on the website (Localink_website: /terms and /privacy). */
export const TERMS_URL = "https://localinkgo.com/terms/";
export const PRIVACY_URL = "https://localinkgo.com/privacy/";
export const PRIVACY_IDENTITY_URL = `${PRIVACY_URL}#identity-checks`;

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-xs text-ink-3 ${className}`}>
      <a href={TERMS_URL} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">Terms &amp; Conditions</a>
      <span aria-hidden>·</span>
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">Privacy Policy</a>
    </p>
  );
}
