import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MySigrid",
  description: "MySigrid — your task and communication hub.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-outfit antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
