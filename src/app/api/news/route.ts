import { NextResponse } from 'next/server';

const FEEDS = [
  { url: 'https://moxie.foxnews.com/google-publisher/latest.xml', source: 'Fox News' },
  { url: 'http://rss.cnn.com/rss/cnn_topstories.rss', source: 'CNN' },
  { url: 'https://feeds.reuters.com/reuters/topNews', source: 'Reuters' },
  { url: 'https://feeds.nbcnews.com/nbcnews/public/news', source: 'NBC News' },
  { url: 'https://www.politico.com/rss/politicopicks.xml', source: 'Politico' },
  { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch' },
  { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
];

function extractTag(xml: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 's');
  const normal = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 's');
  const c = xml.match(cdata);
  if (c) return c[1].trim();
  const n = xml.match(normal);
  if (n) return n[1].replace(/<[^>]+>/g, '').trim();
  return '';
}

function extractImage(itemXml: string): string {
  const media = itemXml.match(/url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (media) return media[1];
  const enclosure = itemXml.match(/<enclosure[^>]+url="([^"]+)"/i);
  if (enclosure) return enclosure[1];
  const imgTag = itemXml.match(/<img[^>]+src="([^"]+)"/i);
  if (imgTag) return imgTag[1];
  return '';
}

function parseItems(xml: string, source: string) {
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  const items = [];
  let match;
  while ((match = itemPattern.exec(xml)) !== null && items.length < 5) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const link =
      extractTag(item, 'link') ||
      item.match(/<link>([^<]+)<\/link>/)?.[1] ||
      '';
    const pubDate = extractTag(item, 'pubDate');
    const description = extractTag(item, 'description').slice(0, 120);
    const image = extractImage(item);
    if (title && link) {
      items.push({ title, link, pubDate, description, image, source });
    }
  }
  return items;
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async ({ url, source }) => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonalOS/1.0)' },
        next: { revalidate: 900 },
      });
      if (!res.ok) throw new Error(`${source}: ${res.status}`);
      const xml = await res.text();
      return parseItems(xml, source);
    })
  );

  const articles = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 25);

  return NextResponse.json({ articles });
}