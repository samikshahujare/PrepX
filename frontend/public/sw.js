/**
 * PrepX Conservative Service Worker
 * Focuses strictly on static shell asset caching.
 * CRITICAL RULE: NEVER caches private API responses, auth tokens, transcripts, GD WebSockets, or evaluations.
 */

const CACHE_NAME = "prepx-static-v1";

const STATIC_PRECACHE = [
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/avatars/sarah-clean.png",
];

// Install: precache essential static branding assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[PrepX SW] Pre-caching notice:", err);
      })
  );
});

// Activate: purge stale cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: strictly conservative handling
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only handle GET requests
  if (req.method !== "GET") {
    return;
  }

  // 2. Strict bypass: never intercept or cache API, WebSockets, tokens, transcripts, evaluations, or invitations
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/ws/") ||
    url.pathname.includes("/feedback/") ||
    url.pathname.includes("/evaluations") ||
    url.pathname.includes("/transcripts") ||
    url.pathname.includes("/invitations") ||
    url.searchParams.has("token") ||
    url.searchParams.has("sessionCode") ||
    url.searchParams.has("participant_id")
  ) {
    return;
  }

  // 3. Static branding assets (/icons/*, /avatars/*, manifest.json): Cache-first with network fallback
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/avatars/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. All other navigation and script requests: standard Network-first
  // (Leaves browser network stack to handle pages directly)
});
