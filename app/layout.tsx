import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import AssistantWidget from "./components/AssistantWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Buzypeezy | Your Business, Made Easy",
  description: "Build, run, and grow your business with AI-powered strategy, branding, websites, marketing, SEO, automation, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
  position="top-right"
  toastOptions={{
    duration: 2500,
    style: {
      background: "#0f172a",
      color: "#ffffff",
      border: "1px solid #06b6d4",
    },
  }}
/>
<Suspense fallback={null}>
  <AssistantWidget />
</Suspense>
      </body>
    </html>
  );
}
