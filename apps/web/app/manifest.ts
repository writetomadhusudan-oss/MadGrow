import type { MetadataRoute } from "next";

/**
 * The web app manifest. It makes MadGrow installable from a browser, and it is
 * what Bubblewrap reads when it builds the Android package — so the name,
 * colours and shortcuts here are the ones on the launcher and the Play listing.
 *
 * `display: standalone` only hides the browser bar on Android once
 * /.well-known/assetlinks.json proves the app and this domain share an owner.
 */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }];
  return {
    name: "MadGrow — Learn Trading, Risk-Free",
    short_name: "MadGrow",
    description:
      "Educational paper-trading simulator for Indian markets. Practise on NSE & BSE prices with virtual MadCoins — no real money, not investment advice.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --color-canvas so the splash screen and first paint are one surface.
    background_color: "#eceff9",
    theme_color: "#eceff9",
    categories: ["finance", "education"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Portfolio", short_name: "Portfolio", url: "/trading", description: "Your paper-trading holdings and orders", icons: shortcutIcon },
      { name: "Watchlist", short_name: "Watchlist", url: "/watchlist", description: "Stocks you are tracking", icons: shortcutIcon },
      { name: "Analytics", short_name: "Analytics", url: "/analytics", description: "Your trading performance", icons: shortcutIcon },
      { name: "Market News", short_name: "News", url: "/news", description: "Latest Indian market news", icons: shortcutIcon },
    ],
  };
}
