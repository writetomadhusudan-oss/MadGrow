import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — MadGrow" };

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md rounded-card bg-card p-10 text-center shadow-card">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
        <WifiOff size={24} />
      </span>
      <h1 className="mt-4 text-xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-soft">
        MadGrow needs a connection to show market prices and your portfolio. Nothing is shown
        while offline so you never practise on stale prices. Reconnect and try again.
      </p>
      <a
        href="/"
        className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop"
      >
        Retry
      </a>
    </div>
  );
}
