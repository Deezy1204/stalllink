"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";
import { MerchantDataProvider } from "@/components/merchant/MerchantData";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { Spinner } from "@/components/ui";

/** The merchant console: any signed-in StallLink account can run shops here, as in the app's Merchant mode. */
export default function MerchantLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <MerchantDataProvider user={user}>
      <MerchantShell>{children}</MerchantShell>
    </MerchantDataProvider>
  );
}
