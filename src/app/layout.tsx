import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrefsController from "@/components/PrefsController";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Codenames — Online Multiplayer",
  description:
    "Play Codenames online with friends. Real-time, multi-room spy word game. Give clever one-word clues and find your agents before the assassin ends it all.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-full">
        <PrefsController />
        {children}
      </body>
    </html>
  );
}
