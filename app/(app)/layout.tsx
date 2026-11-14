import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { StoreProvider } from "@/components/store";
import { Shell } from "@/components/shell";
import { Sheet } from "@/components/sheet";
import type { ItemRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Your collection couldn't load: ${error.message}`);
  return (
    <StoreProvider initial={(data ?? []) as ItemRow[]}>
      <Shell>{children}</Shell>
      <Sheet />
    </StoreProvider>
  );
}
