import { createClient } from "@/lib/supabase/server";
import { me } from "@/lib/data";
import { ChatWelcome } from "@/components/ai-hub/ChatWelcome";

// Chat welcome state. Resolves the user's display name server-side (same source
// as /profile), then hands off to the client welcome composer.
export default async function ChatIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = me.name;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    name =
      profile?.display_name ??
      (user.user_metadata?.full_name as string) ??
      user.email?.split("@")[0] ??
      me.name;
  }

  return <ChatWelcome displayName={name} />;
}
