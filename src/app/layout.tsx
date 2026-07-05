import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ure",
  description: "P2P STX to NGN escrow with exact-payment rails.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession().catch(() => null);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-white/10 bg-black/20">
            <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10 font-mono text-sm font-semibold text-emerald-200">
                  U
                </span>
                <span className="text-base font-semibold tracking-normal text-white">
                  Ure
                </span>
              </Link>
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white"
                >
                  Dashboard
                </Link>
                {session?.role === "ADMIN" ? (
                  <Link
                    href="/admin"
                    className="rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white"
                  >
                    Admin
                  </Link>
                ) : null}
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
