import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces, Inter } from "next/font/google";
import { BottomNav, Header } from "@/components/Header";
import { Hydrated } from "@/components/Hydrated";
import { Footer } from "@/components/Footer";
import { Welcome } from "@/components/Welcome";
import { InstallSheet } from "@/components/Install";
import { OfflineNotice } from "@/components/OfflineNotice";
import { getBranches } from "@/lib/catalog";
import { PREFS_SCRIPT } from "@/lib/prefs-script";
import { STARTUP_IMAGES } from "@/lib/pwa-splash";
import { DEFAULT_TITLE, OG_BASE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});
// Offered as a "readable font" setting; designed for low-vision readers.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: [
    "Brighton library",
    "Hove library",
    "Brighton and Hove Libraries",
    "library DVDs",
    "library audiobooks",
    "Jubilee Library",
    "borrow films Brighton",
    "eAudiobooks BorrowBox Libby",
  ],
  // No canonical or og:url here: pages inherit them and would all claim to be the home page.
  openGraph: { ...OG_BASE, title: DEFAULT_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image" },
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    // Content runs under the status bar; the header pads itself with the safe-area inset.
    statusBarStyle: "black-translucent",
    startupImage: STARTUP_IMAGES,
  },
  icons: { apple: "/pwa/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Dark default; PREFS_SCRIPT and prefs keep it in step with the chosen theme.
  themeColor: "#0e1014",
  // Lets env(safe-area-inset-*) report the notch/home indicator so we can pad around them.
  viewportFit: "cover",
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    // The inline script sets data-* display prefs before paint, so the attributes differ from SSR.
    <html
      lang="en-GB"
      className={`${inter.variable} ${fraunces.variable} ${atkinson.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] font-sans lg:pb-0">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to main content
        </a>
        <Header branches={getBranches()} />
        <Welcome />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer />
        <BottomNav />
        <Hydrated />
        <InstallSheet />
        <OfflineNotice />
        {modal}
      </body>
    </html>
  );
}
