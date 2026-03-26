import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetingMind",
  description: "Apple Watch → Whisper → Claude meeting transcript dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Fonts loaded via <link> so build doesn't need Google Fonts access */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-bricolage: 'Bricolage Grotesque', system-ui, sans-serif;
            --font-jetbrains: 'JetBrains Mono', 'Fira Code', monospace;
          }
        `}</style>
      </head>
      <body className="h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
