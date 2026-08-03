import type { Metadata, Viewport } from "next";
import { Open_Sans, Space_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { NotificationProvider } from "@/components/notification-provider";
import { JudgingTimerProvider } from "@/components/providers/judging-timer-provider";
import { QueryProvider } from "@/components/providers/query-provider";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bench - Hackathon Judging Platform",
  description: "AI-powered hackathon project evaluation and judging",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${openSans.variable} ${spaceMono.variable} font-sans antialiased h-full`}
      >
        <NuqsAdapter>
          <QueryProvider>
            <JudgingTimerProvider>
              {children}
              <NotificationProvider />
            </JudgingTimerProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
