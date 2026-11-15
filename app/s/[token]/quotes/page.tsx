import { notFound } from "next/navigation";
import { Collection } from "@/components/views";
import { loadShare } from "@/lib/share/load";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const share = await loadShare((await params).token);
  if (!share?.kinds.includes("quote")) notFound();
  return <Collection kind="quote" />;
}
