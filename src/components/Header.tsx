"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Heart, Home, LayoutGrid, Search, Settings as SettingsIcon, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { MODES, type Mode, modeFromPath } from "@/lib/modes";
import { PrefsControl } from "./PrefsControl";
import { AudioFormatBar, KidsBanner, ProfileToggle, ThemeToggle } from "./QuickToggles";

/** Current mode from the path; shared pages (title, my list, settings) keep the last one. */
export function useCurrentMode(): { mode: Mode; pathMode: Mode | null } {
  const pathname = usePathname();
  const pathMode = modeFromPath(pathname);
  const [lastMode, setLastMode] = useState<Mode>(pathMode ?? MODES[0]);
  if (pathMode && pathMode !== lastMode) setLastMode(pathMode);
  return { mode: pathMode ?? lastMode, pathMode };
}

/** Switching collection keeps you in the same section (browse stays browse, search keeps its text). */
function modeHref(m: Mode, pathname: string, q: string | null): string {
  if (pathname.startsWith("/browse")) return `/browse/${m.slug}`;
  if (pathname.startsWith("/search")) return `/search/${m.slug}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return m.home;
}

export function Header({ branches }: { branches: string[] }) {
  const pathname = usePathname();
  const { mode, pathMode } = useCurrentMode();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl backdrop-saturate-150">
      {/* Fills the area under the status bar in the installed app (0px tall elsewhere). */}
      <div aria-hidden className="status-band" />
      <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-3 px-4 sm:gap-5 sm:px-8">
        <Link href={mode.home} className="flex shrink-0 items-center gap-2" aria-label="Local Shelf home">
          <Logo />
          <span className="hidden font-display text-2xl font-semibold tracking-tight xl:inline">Local Shelf</span>
        </Link>

        <Suspense fallback={<ModeSwitch pathname={pathname} active={pathMode} q={null} />}>
          <ModeSwitchWithQuery pathname={pathname} active={pathMode} />
        </Suspense>

        <nav aria-label="Main" className="hidden items-center gap-5 text-sm lg:flex">
          <NavLink href={`/browse/${mode.slug}`} active={pathname.startsWith("/browse")}>
            Browse
          </NavLink>
          <NavLink href="/my-list" active={pathname === "/my-list"}>
            My List
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block">
            <Suspense fallback={<div className="h-9 w-64" />}>
              <SearchBox mode={mode} />
            </Suspense>
          </div>
          <div className="hidden items-center gap-2 xl:flex">
            <ProfileToggle />
            <PrefsControl branches={branches} />
          </div>
          <Link
            href="/support"
            aria-label="Donate to Local Shelf"
            title="Donate"
            aria-current={pathname === "/support" ? "page" : undefined}
            className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-paper-2 aria-[current=page]:bg-paper-2 xl:flex xl:w-auto xl:gap-1.5 xl:border xl:border-line xl:px-3 xl:text-sm xl:font-medium"
          >
            <Heart className="h-5 w-5 text-coral xl:h-4 xl:w-4" aria-hidden />
            <span className="hidden xl:inline">Donate</span>
          </Link>
          <ThemeToggle />
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className={`hidden h-9 w-9 place-items-center rounded-full hover:bg-paper-2 lg:grid ${
              pathname === "/settings" ? "bg-paper-2 text-sea" : "text-ink"
            }`}
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 sm:px-8 xl:hidden">
        <ProfileToggle />
        <PrefsControl branches={branches} />
      </div>
      {pathMode?.kind === "audiobook" && <AudioFormatBar />}
      <KidsBanner />
    </header>
  );
}

function ModeSwitchWithQuery({ pathname, active }: { pathname: string; active: Mode | null }) {
  const params = useSearchParams();
  return <ModeSwitch pathname={pathname} active={active} q={params.get("q")} />;
}

function ModeSwitch({ pathname, active, q }: { pathname: string; active: Mode | null; q: string | null }) {
  return (
    <nav aria-label="Collection" className="flex rounded-full bg-paper-2 p-1 text-sm">
      {MODES.map((m) => {
        const isActive = active?.kind === m.kind;
        return (
          <Link
            key={m.kind}
            href={modeHref(m, pathname, q)}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors sm:px-4 ${
              isActive ? "bg-sea text-on-sea shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <span className="sm:hidden">{m.short}</span>
            <span className="hidden sm:inline">{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone tab bar. The header hides these links below lg. */
export function BottomNav() {
  const pathname = usePathname();
  const { mode } = useCurrentMode();
  const tabs = [
    { href: mode.home, label: "Home", icon: Home, active: modeFromPath(pathname) !== null && !/^\/(browse|search)/.test(pathname) },
    { href: `/browse/${mode.slug}`, label: "Browse", icon: LayoutGrid, active: pathname.startsWith("/browse") },
    { href: `/search/${mode.slug}`, label: "Search", icon: Search, active: pathname.startsWith("/search") },
    { href: "/my-list", label: "My List", icon: Bookmark, active: pathname === "/my-list" },
    { href: "/settings", label: "Settings", icon: SettingsIcon, active: pathname === "/settings" },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-paper/80 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="grid h-[3.25rem] grid-cols-5">
        {tabs.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium tracking-wide transition-colors ${t.active ? "text-sea" : "text-muted"}`}
            >
              <t.icon className="h-6 w-6" strokeWidth={t.active ? 2.4 : 1.8} aria-hidden />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap transition-colors hover:text-ink ${active ? "font-semibold text-ink" : "text-muted"}`}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-sea" />
      <rect x="14" y="16" width="9" height="34" rx="2" className="fill-paper" />
      <rect x="26" y="12" width="9" height="38" rx="2" className="fill-paper" />
      <rect
        x="38"
        y="20"
        width="9"
        height="30"
        rx="2"
        transform="rotate(-12 42 35)"
        className="fill-coral"
      />
    </svg>
  );
}

function SearchBox({ mode }: { mode: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const searchPath = `/search/${mode.slug}`;
  const onSearch = pathname === searchPath;
  // Search is a primary task, so the box is always open on desktop.
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(onSearch ? (params.get("q") ?? "") : "");
  const input = useRef<HTMLInputElement>(null);
  // Push only the first keystroke from another page; the rest replace, until /search renders.
  const pushed = useRef(false);
  useEffect(() => {
    if (!onSearch) pushed.current = false;
  }, [onSearch]);

  // Sync from the URL when it changes underneath us (e.g. clicking a cast name on /search).
  // URL updates from our own typing can land late; prefix check stops them clobbering keystrokes.
  const urlQ = onSearch ? (params.get("q") ?? "") : null;
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if (
      urlQ !== null &&
      !(value && (value.startsWith(urlQ) || urlQ.startsWith(value)))
    ) {
      setOpen(true);
      setValue(urlQ);
    }
  }

  function update(q: string) {
    setValue(q);
    // Clearing the box elsewhere shouldn't drag you to the search page.
    if (!q && !onSearch) return;
    // On /search keep the Explorer's filters and sort; only q changes.
    const next = new URLSearchParams(onSearch ? params : undefined);
    if (q) next.set("q", q);
    else next.delete("q");
    const qs = next.toString();
    const url = qs ? `${searchPath}?${qs}` : searchPath;
    if (onSearch || pushed.current) router.replace(url, { scroll: false });
    else {
      pushed.current = true;
      router.push(url);
    }
  }

  const placeholder =
    mode.kind === "film"
      ? "Titles, actors, directors"
      : "Titles, authors, genres";

  return (
    <div
      className={`flex items-center gap-1 rounded-full border transition-all ${
        open
          ? "w-44 border-line bg-card pl-1 pr-3 shadow-sm focus-within:border-sea focus-within:ring-2 focus-within:ring-sea/25 sm:w-72"
          : "w-9 border-transparent"
      }`}
    >
      <button
        type="button"
        aria-label={`Search ${mode.label}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-2"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <Search className="h-5 w-5" />
      </button>
      {open && (
        <>
          <input
            ref={input}
            value={value}
            onChange={(e) => update(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") update("");
            }}
            placeholder={placeholder}
            aria-label={`Search ${mode.label}`}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                update("");
                input.current?.focus();
              }}
            >
              <X className="h-4 w-4 text-muted" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
