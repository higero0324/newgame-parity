import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hiseiSans = Noto_Sans_JP({
  variable: "--font-hisei-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const hiseiSerif = Noto_Serif_JP({
  variable: "--font-hisei-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const hiseiMono = JetBrains_Mono({
  variable: "--font-hisei-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hisei",
  applicationName: "hisei",
  description: "盤面を均すゲーム",
  appleWebApp: {
    title: "hisei",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${hiseiSans.variable} ${hiseiSerif.variable} ${hiseiMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
