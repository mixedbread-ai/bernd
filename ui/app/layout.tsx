import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthGate } from "@/components/auth-gate";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { OrgGate } from "@/components/org-gate";
import { AuthProvider } from "@/context/auth-context";
import { OrgSwitchProvider } from "@/context/org-switch-context";

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
        <NuqsAdapter>
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
        </NuqsAdapter>
      </body>
    </html>
  );
}
