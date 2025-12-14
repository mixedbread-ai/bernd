import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { FloatingChat } from "./components/FloatingChat";
import { ThemeProvider } from "./context/ThemeContext";

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistMono.variable} font-mono antialiased`}>
        <ThemeProvider>
          <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            <Navbar />
            <main className="ml-44">{children}</main>
            <FloatingChat />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
