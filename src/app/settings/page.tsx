import type { Metadata } from "next";
import { getBranches } from "@/lib/catalog";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: true } };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-5xl font-semibold">Settings</h1>
      <p className="mt-2 text-muted">
        Make Local Shelf work the way you like. Settings are saved in this browser only; there are no
        accounts.
      </p>
      <SettingsForm branches={getBranches()} />
    </div>
  );
}
