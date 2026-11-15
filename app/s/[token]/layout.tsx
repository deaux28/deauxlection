import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreProvider } from "@/components/store";
import { Shell } from "@/components/shell";
import { Sheet } from "@/components/sheet";
import { loadShare } from "@/lib/share/load";

export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const share = await loadShare((await params).token).catch(() => null);
  return {
    title: share ? `${share.title} · Deauxlection` : "Deauxlection",
    robots: { index: false, follow: false },
  };
}

export default async function ShareLayout({ children, params }: Props) {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();
  return (
    <StoreProvider initial={share.items} share={{ readOnly: true, base: `/s/${token}`, title: share.title, kinds: share.kinds }}>
      <Shell>{children}</Shell>
      <Sheet />
    </StoreProvider>
  );
}
