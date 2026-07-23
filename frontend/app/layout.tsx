import type { Metadata } from "next";
import { Inter, Source_Serif_4, Caveat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { Providers } from "@/components/Providers";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "LLMRanked",
  description: "Track how AI models rank your brand.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
              <AuthModal />
              <Analytics />
            </ToastProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
