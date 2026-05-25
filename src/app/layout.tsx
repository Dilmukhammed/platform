import type { Metadata } from "next";
import "./globals.css";

import { MotionProvider } from "@/components/ui/motion-provider";

export const metadata: Metadata = {
  title: "LMS platformasi",
  description: "Texnik ta'lim uchun zamonaviy platforma.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className="darkMode">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
