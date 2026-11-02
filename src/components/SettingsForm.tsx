"use client";

import { DEFAULT_PREFS, setPrefs, usePrefs } from "@/lib/prefs";
import { Switch } from "./PrefsControl";
import { InstallSettings } from "./Install";
import { SupportBlurb, SupportLink } from "./Support";

export function SettingsForm({ branches }: { branches: string[] }) {
  const prefs = usePrefs();

  return (
    <div className="mt-10 space-y-10">
      <Section title="Look and feel">
        <Choice
          legend="Theme"
          value={prefs.theme}
          onChange={(v) => setPrefs({ theme: v })}
          options={[
            ["dark", "Dark"],
            ["light", "Light"],
          ]}
        />
        <Choice
          legend="Cover size"
          value={prefs.cover}
          onChange={(v) => setPrefs({ cover: v })}
          options={[
            ["compact", "Compact"],
            ["standard", "Standard"],
            ["big", "Big"],
          ]}
          hint="How large covers are in rows and grids."
        />
        <Choice
          legend="Profile"
          value={prefs.profile}
          onChange={(v) => setPrefs({ profile: v })}
          options={[
            ["everyone", "Everyone"],
            ["kids", "Kids"],
          ]}
          hint="Kids only shows children's films, books and audiobooks. Everyone shows everything, including family titles."
        />
      </Section>

      <Section title="Audiobooks">
        <Choice
          legend="Formats to show"
          value={prefs.audioFormat}
          onChange={(v) => setPrefs({ audioFormat: v })}
          options={[
            ["all", "Both"],
            ["eaudiobook", "eAudiobooks only"],
            ["cd", "CDs only"],
          ]}
          hint="eAudiobooks are borrowed on your phone through BorrowBox or Libby. CDs are borrowed from a branch."
        />
      </Section>

      <Section title="Books">
        <Choice
          legend="Formats to show"
          value={prefs.bookFormat}
          onChange={(v) => setPrefs({ bookFormat: v })}
          options={[
            ["all", "Both"],
            ["ebook", "eBooks only"],
            ["print", "Print only"],
          ]}
          hint="eBooks are borrowed on your phone or e-reader through BorrowBox or Libby. Print books, including large print, are borrowed from a branch."
        />
      </Section>

      <Section title="Your library">
        <label className="block space-y-1">
          <span className="font-semibold">My library</span>
          <select
            value={prefs.branch}
            onChange={(e) => setPrefs({ branch: e.target.value })}
            className="h-11 w-full rounded-lg border border-line bg-card px-3 outline-none focus:border-sea"
          >
            <option value="">Any library</option>
            {/* A saved library that's since dropped out of the list still shows as chosen. */}
            {(prefs.branch && !branches.includes(prefs.branch) ? [prefs.branch, ...branches] : branches).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <span className="block text-sm text-muted">
            We&apos;ll only show things this library holds, and list it first when checking the shelves.
          </span>
        </label>
        <Switch
          checked={prefs.onShelfOnly}
          onChange={(v) => setPrefs({ onShelfOnly: v })}
          label="Only show what's on the shelf"
          hint="Hide titles where every copy is out, so everything you see can be picked up today."
        />
      </Section>

      <Section title="Reading and display">
        <Choice
          legend="Text size"
          value={prefs.textSize}
          onChange={(v) => setPrefs({ textSize: v })}
          options={[
            ["normal", "Standard"],
            ["large", "Large"],
            ["xlarge", "Extra large"],
          ]}
        />
        <Choice
          legend="Typeface"
          value={prefs.font}
          onChange={(v) => setPrefs({ font: v })}
          options={[
            ["default", "Default"],
            ["readable", "Extra readable (Atkinson Hyperlegible)"],
          ]}
        />
        <Choice
          legend="Contrast"
          value={prefs.contrast}
          onChange={(v) => setPrefs({ contrast: v })}
          options={[
            ["normal", "Standard"],
            ["high", "High contrast"],
          ]}
        />
        <Choice
          legend="Motion"
          value={prefs.motion}
          onChange={(v) => setPrefs({ motion: v })}
          options={[
            ["normal", "Standard"],
            ["reduce", "Reduce animations"],
          ]}
          hint="We already respect your device's reduced-motion setting."
        />
      </Section>
      <Section title="App">
        <InstallSettings />
      </Section>
      <Section title="Support Local Shelf">
        <div className="space-y-3 text-sm">
          <SupportBlurb />
          <SupportLink className="rounded-full bg-paper-2 px-5 py-2.5 font-semibold hover:text-sea">
            Donate
          </SupportLink>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="button"
          onClick={() => setPrefs(DEFAULT_PREFS)}
          className="rounded-full border border-line bg-card px-5 py-2.5 font-semibold hover:border-sea hover:text-sea"
        >
          Reset everything
        </button>
        <p className="text-sm text-muted" role="status" aria-live="polite">
          Changes apply straight away.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6 rounded-2xl border border-line bg-card p-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Choice<V extends string>({
  legend,
  value,
  onChange,
  options,
  hint,
}: {
  legend: string;
  value: V;
  onChange: (v: V) => void;
  options: [V, string][];
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([v, label]) => (
          <label
            key={v}
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral ${
              value === v ? "border-sea bg-sea text-on-sea" : "border-line bg-paper hover:border-sea"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={legend}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
