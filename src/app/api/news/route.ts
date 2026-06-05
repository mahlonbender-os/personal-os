import { NextResponse } from 'next/server';

const FEEDS = [
  { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR' },
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', source: 'BBC Sport' },
  { url: 'https://www.espn.com/espn/rss/news', source: 'ESPN' },
  { url: 'https://abcnews.go.com/abcnews/topstories', source: 'ABC News' },
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
  // Try media:content, enclosure, then og image
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
    const link = extractTag(item, 'link') || item.match(/<link>([^<]+)<\/link>/)?.[1] || '';
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
        next: { revalidate: 900 }, // cache 15 min
      });
      if (!res.ok) throw new Error(`${source}: ${res.status}`);
      const xml = await res.text();
      return parseItems(xml, source);
    })
  );

  const articles = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 20);

  return NextResponse.json({ articles });
}