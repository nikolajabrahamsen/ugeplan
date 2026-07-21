import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/** Om denne enhed allerede har et aktivt push-abonnement. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return !!existing;
}

/**
 * Beder om lov til at vise notifikationer, opretter et push-abonnement
 * for DENNE enhed, og gemmer det i databasen koblet til den aktuelle
 * bruger (forælder eller parret barne-enhed - begge er almindelige
 * Supabase Auth-brugere, så samme mekanisme virker for begge).
 */
export async function enablePushNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Denne browser understøtter ikke push-notifikationer.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Du skal give tilladelse til notifikationer for at slå påmindelser til.");
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Ikke logget ind");

  const json = subscription.toJSON();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth_key: json.keys?.auth ?? ""
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;
}
