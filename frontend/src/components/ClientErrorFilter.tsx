"use client";

import { useEffect } from "react";

export default function ClientErrorFilter() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === "string" ? reason : reason?.message || "";
      const name = reason?.name || "";

      // Suppress normal WebRTC / LiveKit connection cancellation when user leaves page
      if (
        name === "ConnectionError" ||
        msg.includes("Client initiated disconnect") ||
        msg.includes("cancelled")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
    };
  }, []);

  return null;
}
