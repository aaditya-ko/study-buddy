import type { Metadata } from "next";
import { Inika, Geist_Mono } from "next/font/google";
import "./globals.css";

const inika = Inika({
  variable: "--font-inika",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyBuddy Live",
  description: "Paper‑first, proactive study companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inika.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-dvh">
          {children}
        </div>
      </body>
    </html>
  );
}
