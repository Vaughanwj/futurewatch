/**
 * RSS adapter — curated-stories panel. Fetches feeds listed in
 * backend/config/feeds.json and returns the newest items per feed.
 *
 * Minimal RSS/Atom extraction, deliberately dependency-free. If a feed's
 * format defeats it, the error lands in `errors` and the panel just shows
 * fewer stories — never breaks the pipeline.
 */
import axios from 'axios';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_CONFIG = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'config', 'feeds.json'
);

const pick = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decode(m[1].trim()) : null;
};

const pickAtomLink = (xml) => {
  const m = xml.match(/<link[^>]*href="([^"]+)"[^>]*\/?>(?:<\/link>)?/i);
  return m ? decode(m[1]) : null;
};

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

// Skip non-English mirror posts (e.g. metr.org publishes /zh-Hans/ variants
// of each article) so the stories panel doesn't show duplicates.
const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const LOCALE_PATH = /\/(?:zh-Han[st]|ja|ko|fr|de|es|pt-BR)\//i;

function isEnglishItem(item) {
  if (item.title && CJK.test(item.title)) return false;
  if (item.link && LOCALE_PATH.test(item.link)) return false;
  return true;
}

function parseFeed(xml, feedLabel, maxItems) {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks
    .map((b) => ({
      title: pick(b, 'title') ?? '(untitled)',
      link: pick(b, 'link') || pickAtomLink(b),
      published: pick(b, 'pubDate') ?? pick(b, 'published') ?? pick(b, 'updated'),
      feed: feedLabel,
    }))
    .filter(isEnglishItem)
    .slice(0, maxItems);
}

export function createRssAdapter(configPath = DEFAULT_CONFIG) {
  return {
    async fetch() {
      const t0 = Date.now();
      const errors = [];
      const stories = [];
      let feeds = [];
      try {
        feeds = JSON.parse(await readFile(configPath, 'utf8')).feeds ?? [];
      } catch (err) {
        errors.push(`rss config: ${err.message}`);
      }

      for (const feed of feeds) {
        try {
          const { data } = await axios.get(feed.url, {
            timeout: 15000,
            responseType: 'text',
            // Browser-like UA: several feed hosts (notably Substack) 403
            // generic bot UAs from datacenter IPs.
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 FutureWatchMeter/0.1 (+https://futurewatch.ai)',
              Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            },
          });
          stories.push(...parseFeed(String(data), feed.label, feed.maxItems ?? 3));
        } catch (err) {
          errors.push(`rss ${feed.label}: ${err.message}`);
        }
      }

      stories.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));

      // Dedupe by link across feeds
      const seen = new Set();
      const deduped = stories.filter((s) => {
        if (!s.link || seen.has(s.link)) return false;
        seen.add(s.link);
        return true;
      });

      return {
        indicators: {},
        stories: deduped.slice(0, 12),
        fetchMs: Date.now() - t0,
        errors,
      };
    },
  };
}

export const rssAdapter = createRssAdapter();
