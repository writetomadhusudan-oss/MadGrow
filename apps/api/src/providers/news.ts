import Parser from "rss-parser";
import type { NewsItem } from "@market-cap/shared";
import { cached, TTL } from "../cache";

const parser = new Parser();

export interface NewsProvider {
  getMarketNews(): Promise<NewsItem[]>;
  getStockNews(query: string): Promise<NewsItem[]>;
}

// Google News RSS: free, no API key. Swap this class out for a licensed
// news API without touching the routes.
class GoogleNewsRssProvider implements NewsProvider {
  private async fetchFeed(query: string): Promise<NewsItem[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const feed = await parser.parseURL(url);
    return (feed.items ?? [])
      .slice(0, 20)
      .map((item) => ({
        title: item.title ?? "",
        link: item.link ?? "",
        // Google News titles end with " - Source"; the source field is also present.
        source: (item as { source?: string }).source ?? item.creator ?? "",
        publishedAt: item.isoDate ?? item.pubDate ?? "",
      }))
      .filter((n) => n.title && n.link);
  }

  getMarketNews(): Promise<NewsItem[]> {
    return cached("news:market", TTL.news, () =>
      this.fetchFeed("indian stock market NSE BSE sensex nifty")
    );
  }

  getStockNews(query: string): Promise<NewsItem[]> {
    return cached(`news:stock:${query.toLowerCase()}`, TTL.news, () =>
      this.fetchFeed(`${query} stock NSE`)
    );
  }
}

export const news: NewsProvider = new GoogleNewsRssProvider();
