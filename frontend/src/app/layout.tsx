import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientErrorFilter from "@/components/ClientErrorFilter";
import PWARegistration from "@/components/PWARegistration";

export const viewport: Viewport = {
  themeColor: "#0a0d14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "PrepX — Intelligent Interview Training",
  description: "AI-Powered Technical & Behavioral Mock Interviews and Group Discussion Arena",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PrepX",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isIgnoredLiveKitError(reason) {
                  if (!reason) return false;
                  var msg = typeof reason === 'string' ? reason : (reason.message || '');
                  var name = reason.name || '';
                  return (
                    name === 'ConnectionError' ||
                    msg.indexOf('Client initiated disconnect') !== -1 ||
                    msg.indexOf('cancelled') !== -1
                  );
                }
                window.addEventListener(
                  'unhandledrejection',
                  function(event) {
                    if (isIgnoredLiveKitError(event.reason)) {
                      event.preventDefault();
                      event.stopImmediatePropagation();
                    }
                  },
                  true // capturing phase to intercept before dev overlay
                );
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[#0a0d14] text-slate-100 min-h-screen flex flex-col antialiased">
        <ClientErrorFilter />
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
