import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vouch System — Team Accountability Platform",
  description: "Peer-verified task management for teams. Assign tasks, vouch for each other, and track reliability scores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
