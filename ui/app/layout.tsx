import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { FloatingChat } from "./components/FloatingChat";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bernd",
  description: "chief of staff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} font-mono antialiased`}>
        <div className="min-h-screen bg-[#faf9f7]">
          <Navbar />
          <main className="ml-44">{children}</main>
          <FloatingChat />
        </div>
      </body>
    </html>
  );
}
