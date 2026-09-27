import type { Metadata, Viewport } from "next";
import { Rubik, Tektur } from "next/font/google";
import "./globals.css";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"] });
const tektur = Tektur({ variable: "--font-tektur", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BeCarful",
  description: "Your AI car insurance companion",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5fb4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#070b1f" },
  ],
};

// Runs before paint so the night scene doesn't flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${rubik.variable} ${tektur.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
