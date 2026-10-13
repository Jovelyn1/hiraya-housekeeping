import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { DataProvider } from "@/components/DataProvider";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata = {
  title: "Hiraya Housekeeping",
  description: "Housekeeping operations for Hiraya Farm Resort",
  robots: { index: false, follow: false },
  manifest: base + "/manifest.json",
  icons: { icon: base + "/icon-192.png", apple: base + "/icon-192.png" },
  appleWebApp: { capable: true, title: "Housekeeping", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#3c7230",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
