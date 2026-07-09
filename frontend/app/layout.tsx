import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { Providers } from "@/components/Providers";

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

export const metadata: Metadata = {
  title: "LLMRank",
  description: "Track how AI models rank your brand.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <AuthModal />
            <Analytics />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
