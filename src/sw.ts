/// <reference lib="webworker" />
// Custom service worker for Ugeplan.
//
// To ting foregår her:
// 1) Almindelig offline-precaching af app-skallen (samme som
//    vite-plugin-pwa's generateSW gjorde automatisk før) via Workbox.
// 2) Håndtering af push-notifikationer og runtime-caching af
//    piktogrammer/Supabase-data, som ikke kunne tilføjes uden en
//    custom service worker.

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// ARASAAC-piktogrammer: cache-first, lang levetid (de ændrer sig ikke)
registerRoute(
  ({ url }) => url.origin === "https://static.arasaac.org",
  new CacheFirst({
    cacheName: "arasaac-pictograms",
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 })]
  })
);

// OpenSymbols-piktogrammer (Sclera, Mulberry m.fl.)
registerRoute(
  ({ url }) =>
    url.origin === "https://storage.googleapis.com" || url.hostname.endsWith(".cloudfront.net"),
  new CacheFirst({
    cacheName: "opensymbols-pictograms",
    plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 })]
  })
);

// Supabase data-kald: network-first med fallback til cache
registerRoute(
  ({ url }) => url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/"),
  new NetworkFirst({
    cacheName: "supabase-data",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })]
  })
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------- Push-notifikationer ----------

self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: "Påmindelse", body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Påmindelse";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "ugeplan-reminder"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsList) => {
      if (clientsList.length > 0) {
        return (clientsList[0] as WindowClient).focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
