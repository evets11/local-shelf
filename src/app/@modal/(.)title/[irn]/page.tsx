import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPrerenderedTitles, getTitle } from "@/lib/catalog";
import { Modal } from "@/components/Modal";
import { DetailSkeleton } from "@/components/Skeleton";
import { TitleDetail } from "@/components/TitleDetail";

// Only the newest sheets are prerendered; the rest render in full when first opened, then are
// cached. The root layout's header reads the URL, so a generic App Shell can't be prerendered.
export const instant = false;

export function generateStaticParams() {
  return getPrerenderedTitles().map((t) => ({ irn: t.irn }));
}

// The dialog stays mounted while a sheet renders on first open (a remount would close and reopen it).
export default function TitleModal({ params }: PageProps<"/title/[irn]">) {
  return (
    <Modal label="Title details">
      <Suspense fallback={<DetailSkeleton />}>
        <ModalTitle params={params} />
      </Suspense>
    </Modal>
  );
}

async function ModalTitle({ params }: Pick<PageProps<"/title/[irn]">, "params">) {
  const t = getTitle((await params).irn);
  if (!t) notFound();
  return <TitleDetail t={t} headingLevel="h2" />;
}
