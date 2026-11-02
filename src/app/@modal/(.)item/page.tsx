import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalItem } from "@/components/ExternalItem";
import { Modal } from "@/components/Modal";
import { DetailSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "From the library catalogue", robots: { index: false, follow: true } };

/** Full-catalogue results open in the same sheet as titles (close, Escape, swipe down). */
export default function ItemModal() {
  return (
    <Modal label="From the library catalogue">
      <Suspense fallback={<DetailSkeleton />}>
        <ExternalItem headingLevel="h2" />
      </Suspense>
    </Modal>
  );
}
