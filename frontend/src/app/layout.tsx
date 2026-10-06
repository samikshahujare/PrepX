import type { Metadata } from "next";
import "./globals.css";
import ClientErrorFilter from "@/components/ClientErrorFilter";

export const metadata: Metadata = {
  title: "PrepX — Intelligent Interview Training",
  description: "AI-Powered Technical & Behavioral Mock Interviews and Group Discussion Arena",
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
        {children}
      </body>
    </html>
  );
}
