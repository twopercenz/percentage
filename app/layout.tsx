import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const interop = localFont({
  src: [
    {
      path: "../fonts/Interop-1.8/web/subset/Interop-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Interop-1.8/web/subset/Interop-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Interop-1.8/web/subset/Interop-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-interop",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Percentage — 쌓으면, 보입니다.",
  description: "나무위키와 동일한 구조를 가진 한국어 개방형 위키, Percentage입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${interop.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
