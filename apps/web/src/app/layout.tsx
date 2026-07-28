import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeProvider } from "@repo/ui/components/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "Agent-ready full-stack on Azure starter",
  description: "Agent-ready full-stack on Azure starter.",
};

interface RootLayoutProperties {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
