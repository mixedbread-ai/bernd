import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import { AuthGate } from "./components/AuthGate";
import { OrgGate } from "./components/OrgGate";
import { OrgSwitchProvider } from "./context/OrgSwitchContext";
import { AuthenticatedLayout } from "./components/AuthenticatedLayout";

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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <AuthGate>
              <OrgSwitchProvider>
                <OrgGate>
                  <AuthenticatedLayout>{children}</AuthenticatedLayout>
                </OrgGate>
              </OrgSwitchProvider>
            </AuthGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
