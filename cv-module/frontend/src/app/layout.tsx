import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "BeCarful — 3D Car",
  description: "Interactive 3D preview of a white Suzuki XL7.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
