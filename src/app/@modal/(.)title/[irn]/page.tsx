import { notFound } from "next/navigation";
import { getAllTitles, getTitle } from "@/lib/catalog";
import { Modal } from "@/components/Modal";
import { TitleDetail } from "@/components/TitleDetail";

export function generateStaticParams() {
  return getAllTitles().map((t) => ({ irn: t.irn }));
}

export default async function TitleModal({ params }: PageProps<"/title/[irn]">) {
  const { irn } = await params;
  const t = getTitle(irn);
  if (!t) notFound();
  return (
    <Modal label={t.title}>
      <TitleDetail t={t} headingLevel="h2" />
    </Modal>
  );
}
