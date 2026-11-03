"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Check,
  ChevronDown,
  Heart,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  Settings as SettingsIcon,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { MODES, type Mode, modeFromPath } from "@/lib/modes";
import { SITE_NAME } from "@/lib/site";
import { PrefsControl, shortBranch, useDismiss } from "./PrefsControl";
import { openProfileSheet } from "./ProfileSheet";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { LAST_MODE_KEY } from "@/lib/prefs-script";
import { usePrizesKind } from "@/lib/prizes-kind";
import {
  FormatBar,
  KidsBanner,
  ProfileToggle,
  ThemeToggle,
} from "./QuickToggles";

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
  if (pathname.startsWith("/search"))
    return `/search/${m.slug}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return m.home;
}

export function Header({ branches }: { branches: string[] }) {
  const pathname = usePathname();
  const { mode, pathMode } = useCurrentMode();

  useEffect(() => {
    if (!pathMode) return;
    try {
      localStorage.setItem(LAST_MODE_KEY, pathMode.slug);
    } catch {}
  }, [pathMode]);

  return (
    <header className="z-40 border-b border-line bg-paper/85 backdrop-blur-xl backdrop-saturate-150 lg:sticky lg:top-0">
      {/* Fills the area under the status bar in the installed app (0px tall elsewhere). */}
      <div aria-hidden className="status-band" />
      <MobileHeader />
      <div className="mx-auto hidden h-16 max-w-[1800px] items-center gap-3 px-4 sm:gap-5 sm:px-8 lg:flex">
        <Link
          href={mode.home}
          className="flex shrink-0 items-center gap-2"
          aria-label={`${SITE_NAME} home`}
        >
          <Logo />
          <span className="hidden font-display text-2xl font-semibold tracking-tight xl:inline">
            {SITE_NAME}
          </span>
        </Link>

        <Suspense
          fallback={
            <ModeSwitch pathname={pathname} active={pathMode} q={null} />
          }
        >
          <ModeSwitchWithQuery pathname={pathname} active={pathMode} />
        </Suspense>

        <nav
          aria-label="Main"
          className="hidden items-center gap-5 text-sm lg:flex"
        >
          <NavLink
            href={`/browse/${mode.slug}`}
            active={pathname.startsWith("/browse")}
          >
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
            aria-label={`Donate to ${SITE_NAME}`}
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
      <div className="hidden items-center justify-between gap-2 px-4 pb-2 sm:px-8 lg:flex xl:hidden">
        <ProfileToggle />
        <PrefsControl branches={branches} />
      </div>
      {(pathMode?.kind === "audiobook" || pathMode?.kind === "book") && <FormatBar kind={pathMode.kind} />}
      {pathname === "/prizes" && (
        <Suspense fallback={<FormatBar kind="book" onPrizes />}>
          <PrizesFormatBar />
        </Suspense>
      )}
      <KidsBanner />
    </header>
  );
}

function PrizesFormatBar() {
  return <FormatBar kind={usePrizesKind()} onPrizes />;
}

function ModeSwitchWithQuery({
  pathname,
  active,
}: {
  pathname: string;
  active: Mode | null;
}) {
  const params = useSearchParams();
  return <ModeSwitch pathname={pathname} active={active} q={params.get("q")} />;
}

function ModeSwitch({
  pathname,
  active,
  q,
}: {
  pathname: string;
  active: Mode | null;
  q: string | null;
}) {
  return (
    <nav
      aria-label="Collection"
      className="flex rounded-full bg-paper-2 p-1 text-sm"
    >
      {MODES.map((m) => {
        const isActive = active?.kind === m.kind;
        return (
          <Link
            key={m.kind}
            href={modeHref(m, pathname, q)}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors sm:px-4 ${
              isActive
                ? "bg-sea text-on-sea shadow-sm"
                : "text-muted hover:text-ink"
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

/** Phone tab bar: a slim floating bar, like iOS apps. Search lives in the header's field. */
export function BottomNav() {
  const pathname = usePathname();
  const { mode } = useCurrentMode();
  const tabs = [
    {
      href: mode.home,
      label: "Home",
      icon: Home,
      active:
        modeFromPath(pathname) !== null && !/^\/(browse|search)/.test(pathname),
    },
    {
      href: `/browse/${mode.slug}`,
      label: "Browse",
      icon: LayoutGrid,
      active: /^\/(browse|search)/.test(pathname),
    },
    {
      href: "/my-list",
      label: "My List",
      icon: Bookmark,
      active: pathname === "/my-list",
    },
    {
      href: "/settings",
      label: "Settings",
      icon: SettingsIcon,
      active: pathname === "/settings",
    },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.6rem)] left-1/2 z-40 w-[min(21rem,calc(100%-2rem))] -translate-x-1/2 rounded-full border border-line/70 bg-card/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="grid h-14 grid-cols-4 px-1.5">
        {tabs.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors ${t.active ? "text-sea" : "text-muted"}`}
            >
              <t.icon
                className="h-[22px] w-[22px]"
                strokeWidth={t.active ? 2.3 : 1.8}
                aria-hidden
              />
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

/** `bar`: the desktop header's rounded box. `field`: a full-width iOS-style search field for phones. */
function SearchBox({
  mode,
  variant = "bar",
}: {
  mode: Mode;
  variant?: "bar" | "field";
}) {
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
      className={
        variant === "field"
          ? "flex h-10 w-full items-center gap-1 rounded-xl bg-paper-2 pl-0.5 pr-3 focus-within:ring-2 focus-within:ring-sea/30"
          : `flex items-center gap-1 rounded-full border transition-all ${
              open
                ? "w-44 border-line bg-card pl-1 pr-3 shadow-sm focus-within:border-sea focus-within:ring-2 focus-within:ring-sea/25 sm:w-72"
                : "w-9 border-transparent"
            }`
      }
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
            type="search"
            enterKeyHint="search"
            className={`h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden ${
              variant === "field" ? "text-base" : "text-sm"
            }`}
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

/**
 * Phones: an iOS-style large title that switches collection, a profile button (opens the
 * profile sheet), a search field and filter chips. Pages outside a collection get a compact row.
 */
function MobileHeader() {
  const pathname = usePathname();
  const { mode, pathMode } = useCurrentMode();
  const prefs = usePrefs();

  if (!pathMode) {
    return (
      <div className="flex h-14 items-center justify-between px-4 lg:hidden">
        <Link
          href={mode.home}
          className="flex items-center gap-2"
          aria-label={`${SITE_NAME} home`}
        >
          <Logo />
          <span className="font-display text-xl font-semibold">
            {SITE_NAME}
          </span>
        </Link>
        <HeaderActions />
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-3 pt-3 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Suspense
          fallback={
            <CollectionMenu pathname={pathname} active={pathMode} q={null} />
          }
        >
          <CollectionMenuWithQuery pathname={pathname} active={pathMode} />
        </Suspense>
        <HeaderActions />
      </div>
      <Suspense fallback={<div className="h-10 rounded-xl bg-paper-2" />}>
        <SearchBox mode={pathMode} variant="field" />
      </Suspense>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={openProfileSheet}
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
            prefs.branch
              ? "border-sea bg-sea/10 text-sea"
              : "border-line text-ink"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {prefs.branch ? shortBranch(prefs.branch) : "Any library"}
          <span className="sr-only">, change library</span>
        </button>
        <button
          type="button"
          aria-pressed={prefs.onShelfOnly}
          onClick={() => setPrefs({ onShelfOnly: !prefs.onShelfOnly })}
          className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold ${
            prefs.onShelfOnly
              ? "bg-sea text-on-sea"
              : "border border-line text-ink"
          }`}
        >
          On the shelf
        </button>
        {prefs.profile === "kids" && (
          <button
            type="button"
            onClick={openProfileSheet}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-sea px-3 text-[13px] font-semibold text-on-sea"
          >
            <Star className="h-3.5 w-3.5" aria-hidden /> Kids
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileButton() {
  const { profile } = usePrefs();
  return (
    <button
      type="button"
      onClick={openProfileSheet}
      aria-label="Profile, library and appearance"
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-2 text-ink"
    >
      {profile === "kids" ? (
        <Star className="h-5 w-5 text-sea" aria-hidden />
      ) : (
        <UserRound className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}

function CollectionMenuWithQuery({
  pathname,
  active,
}: {
  pathname: string;
  active: Mode;
}) {
  const params = useSearchParams();
  return (
    <CollectionMenu pathname={pathname} active={active} q={params.get("q")} />
  );
}

/** The large title doubles as the collection switcher, like an iOS title menu. */
function CollectionMenu({
  pathname,
  active,
  q,
}: {
  pathname: string;
  active: Mode;
  q: string | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, open, () => setOpen(false));

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1.5"
      >
        <span className="truncate font-display text-[2rem] font-semibold leading-tight tracking-tight">
          {active.label}
        </span>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span className="sr-only">, switch collection</span>
      </button>
      {open && (
        <nav
          aria-label="Collection"
          className="sheet-in absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          {MODES.map((m) => (
            <Link
              key={m.kind}
              href={modeHref(m, pathname, q)}
              onClick={() => setOpen(false)}
              aria-current={m.kind === active.kind ? "page" : undefined}
              className="flex items-center justify-between border-b border-line px-4 py-3 text-base last:border-0"
            >
              {m.label}
              {m.kind === active.kind && (
                <Check className="h-4 w-4 text-sea" aria-hidden />
              )}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Phone header's right-hand buttons: donate (heart) and the profile sheet. */
function HeaderActions() {
  const pathname = usePathname();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Link
        href="/support"
        aria-label={`Donate to ${SITE_NAME}`}
        aria-current={pathname === "/support" ? "page" : undefined}
        className="grid h-10 w-10 place-items-center rounded-full text-coral aria-[current=page]:bg-paper-2"
      >
        <Heart className="h-5 w-5" aria-hidden />
      </Link>
      <ProfileButton />
    </div>
  );
}
