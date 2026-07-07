import type { NewsItem } from "@market-cap/shared";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Google News titles end with " - Source"; split it out for display. */
function splitTitle(title: string): { headline: string; source: string | null } {
  const idx = title.lastIndexOf(" - ");
  if (idx > 20) return { headline: title.slice(0, idx), source: title.slice(idx + 3) };
  return { headline: title, source: null };
}

export function NewsList({ items, limit }: { items: NewsItem[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="divide-y divide-line">
      {shown.map((item) => {
        const { headline, source } = splitTitle(item.title);
        return (
          <li key={item.link}>
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="group block px-1 py-3.5"
            >
              <p className="text-sm font-medium leading-snug group-hover:text-accent-deep">
                {headline}
              </p>
              <p className="mt-1 text-xs text-faint">
                {source ?? "News"}
                {item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}
              </p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
