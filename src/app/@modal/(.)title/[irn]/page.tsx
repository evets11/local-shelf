import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPrerenderedTitles, getTitle } from "@/lib/catalog";
import { Modal } from "@/components/Modal";
import { DetailSkeleton } from "@/components/Skeleton";
import { TitleDetail } from "@/components/TitleDetail";

// Unlisted titles render in full on their first visit, then are cached. The root layout's
// header reads the URL, so a generic App Shell for an unknown title can't be prerendered.
export const instant = false;

export function generateStaticParams() {
  return getPrerenderedTitles().map((t) => ({ irn: t.irn }));
}

// The dialog stays mounted while an unlisted title renders (a remount would close and reopen it).
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
