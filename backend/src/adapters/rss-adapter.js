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

function parseFeed(xml, feedLabel, maxItems) {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  return blocks.slice(0, maxItems).map((b) => ({
    title: pick(b, 'title') ?? '(untitled)',
    link: pick(b, 'link') || pickAtomLink(b),
    published: pick(b, 'pubDate') ?? pick(b, 'published') ?? pick(b, 'updated'),
    feed: feedLabel,
  }));
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
            headers: { 'User-Agent': 'futurewatch-meter/0.1' },
          });
          stories.push(...parseFeed(String(data), feed.label, feed.maxItems ?? 3));
        } catch (err) {
          errors.push(`rss ${feed.label}: ${err.message}`);
        }
      }

      stories.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));

      return {
        indicators: {},
        stories: stories.slice(0, 12),
        fetchMs: Date.now() - t0,
        errors,
      };
    },
  };
}

export const rssAdapter = createRssAdapter();
