import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { listMine, listSharedByOthers } from "@/lib/db/headers";
import { LibraryView } from "./library-view";

export const metadata = { title: "Saved headers — GreenMentor Community" };

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/library");

  const [mine, shared] = await Promise.all([
    listMine(supabase, user.id),
    listSharedByOthers(supabase, user.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Saved headers"
        sub="Your personal library and headers shared with the GreenMentor team."
      />
      <LibraryView mine={mine} shared={shared} userId={user.id} />
    </div>
  );
}
