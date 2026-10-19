"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AdminDataProvider } from "@/components/AdminData";
import { useAuth } from "@/components/AuthProvider";
import { Shell } from "@/components/Shell";

/** Every admin console page: only signed-in admins get past this. Other accounts go to the merchant console. */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!isAdmin) router.replace("/merchant");
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminDataProvider>
      <Shell>{children}</Shell>
    </AdminDataProvider>
  );
}
