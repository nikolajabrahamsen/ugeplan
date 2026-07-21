// Supabase Edge Function: send-reminders
//
// Kaldes hvert minut af et Cron Job (sæt op i Supabase Dashboard under
// Database -> Cron Jobs - se README for præcis opsætning). Finder
// aktiviteter der skal have en påmindelse LIGE NU (via due_reminders()),
// og sender en rigtig push-notifikation til alle relevante enheder
// (familiens forældre + evt. parrede barne-enheder for det barn).
//
// Kræver disse miljøvariabler sat som Supabase secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (til at læse på tværs af RLS)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (fx mailto:...)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: reminders, error: remindersError } = await supabase.rpc("due_reminders");
  if (remindersError) {
    return new Response(JSON.stringify({ error: remindersError.message }), { status: 500 });
  }
  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  let sentCount = 0;

  for (const reminder of reminders) {
    // Find alle brugere der skal have besked: familiens forældre + en
    // eventuel parret barne-enhed for netop dette barn
    const { data: parentMembers } = await supabase
      .from("family_members")
      .select("user_id")
      .eq("family_id", reminder.family_id);

    const { data: deviceMembers } = await supabase
      .from("children_devices")
      .select("user_id")
      .eq("child_id", reminder.child_id);

    const userIds = [
      ...(parentMembers ?? []).map((m) => m.user_id),
      ...(deviceMembers ?? []).map((m) => m.user_id)
    ];

    if (userIds.length === 0) continue;

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .in("user_id", userIds);

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key }
          },
          JSON.stringify({
            title: "Påmindelse",
            body: reminder.title
          })
        );
        sentCount++;
      } catch (err) {
        // En udløbet/ugyldig subscription fejler her - det er forventet
        // over tid (fx hvis en bruger har afinstalleret appen), og ikke
        // en grund til at stoppe resten af kørslen
        console.error("Push fejlede:", err);
      }
    }

    await supabase.rpc("mark_reminder_sent", { target_activity_id: reminder.activity_id });
  }

  return new Response(JSON.stringify({ sent: sentCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
