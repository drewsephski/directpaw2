import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DirectPaw — Simple payments for independent pet sitters",
  description: "Create secure Stripe payment requests for pet-sitting clients.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
