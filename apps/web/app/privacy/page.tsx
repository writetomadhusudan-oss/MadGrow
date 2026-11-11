import Link from "next/link";

export const metadata = { title: "Privacy Policy — MadGrow" };

const CONTACT = "writetomadhusudan@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-soft">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-card bg-card p-8 shadow-card">
      <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-xs text-faint">
        Applies to madgrow.cloud and the MadGrow mobile apps · Last updated 11 November 2026
      </p>

      <div className="mt-6 space-y-6">
        <Section title="What MadGrow is">
          <p>
            MadGrow is an educational paper-trading simulator. It uses a virtual currency
            (MadCoins) only. It never handles real money, payment details, bank or demat
            accounts, or government identity documents — so it never asks for them.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Account details:</strong> your email address, an optional display name,
              and your password — stored only as a one-way cryptographic hash, never in
              readable form.
            </li>
            <li>
              <strong>Practice activity:</strong> your virtual wallet, simulated orders,
              positions and trades, your watchlist, alerts, and the date you accepted the
              educational disclaimer.
            </li>
            <li>
              <strong>Technical data:</strong> standard server logs (IP address, browser type,
              time of request) kept for security and troubleshooting.
            </li>
          </ul>
          <p>
            We do not collect your contacts, location, photos, microphone, camera, or device
            identifiers, and the app contains no advertising or third-party analytics trackers.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            Only to run the simulator for you: signing you in, keeping your practice portfolio,
            and showing your performance. A count of registered users (a number only) may be
            shown publicly. We do not sell, rent, or share your personal data with advertisers.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            One essential cookie keeps you signed in for up to 7 days. Your browser or app also
            remembers a few display preferences (such as which chart signals are switched on)
            on your device. There are no advertising or tracking cookies.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            Market prices and news headlines are fetched by our server from public sources
            (Yahoo Finance and Google News); your personal data is not sent to them. News
            links open the publisher&apos;s own website, which has its own privacy policy.
          </p>
        </Section>

        <Section title="Storage and security">
          <p>
            Data is stored on a server we operate, and all traffic between you and MadGrow is
            encrypted with HTTPS. No system is perfectly secure, but we limit what we hold to
            what the simulator needs.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            You can permanently delete your account and everything attached to it at any time
            from the <Link href="/account" className="font-semibold text-accent-deep underline">Account page</Link>.
            Deletion is immediate and cannot be undone. If you cannot sign in, email us from
            your registered address and we will delete the account for you.
          </p>
        </Section>

        <Section title="Children">
          <p>
            MadGrow is intended for adults learning about financial markets and is not directed
            at children under 18.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If this policy changes, the date above will be updated. Questions or requests:{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-accent-deep underline">
              {CONTACT}
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
