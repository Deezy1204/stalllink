import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AuthProvider } from "@/components/AuthProvider";
import { FeedbackProvider } from "@/components/ui";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "LocalinkGo",
  description: "Run your LocalinkGo shop, or manage LocalinkGo shops, users, orders, reviews and admins.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
