'use client';

import { useState, useEffect } from 'react';
import { Newspaper, RefreshCw } from 'lucide-react';

interface Article {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  image: string;
  source: string;
}

const SOURCES = ['All', 'NPR', 'BBC', 'BBC Sport', 'ESPN', 'ABC News'];
const CACHE_KEY = 'news_articles_v1';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'Just now';
}

export default function NewsCard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  async function fetchNews(showRefresh: boolean = false) {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      const items = data.articles || [];
      setArticles(items);
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setArticles(JSON.parse(cached));
        setLoading(false);
      } catch (_) {}
    }
    fetchNews();
  }, []);

  const filtered =
    activeSource === 'All'
      ? articles
      : articles.filter((a) => a.source === activeSource);

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[#f0a050]" />
          <span className="text-white font-semibold text-sm">Top Headlines</span>
        </div>
        <button
          onClick={() => fetchNews(true)}
          className="p-1.5 rounded-full text-[#555] hover:text-[#f0a050] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Source filter tabs */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {SOURCES.map((src) => (
          <button
            key={src}
            onClick={() => setActiveSource(src)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
              activeSource === src
                ? 'bg-[#f0a050] border-[#f0a050] text-black font-semibold'
                : 'border-[#2a2a2a] text-[#888]'
            }`}
          >
            {src}
          </button>
        ))}
      </div>

      {/* Articles */}
      <div className="divide-y divide-[#1a1a1a]">
        {loading ? (
          <div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[#1a1a1a] rounded w-full" />
                  <div className="h-3 bg-[#1a1a1a] rounded w-3/4" />
                  <div className="h-2 bg-[#1a1a1a] rounded w-1/3" />
                </div>
                <div className="w-14 h-14 bg-[#1a1a1a] rounded-xl shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#555] text-sm">
            No articles found
          </div>
        ) : (
          <div>
            {filtered.slice(0, 8).map((article, i) => (
              
                {filtered.slice(0, 8).map((article, i) => (
  <div
    key={i}
    onClick={() => window.open(article.link, '_blank')}
    className="flex items-start gap-3 px-4 py-3 active:bg-[#1a1a1a] cursor-pointer"
  >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium leading-snug line-clamp-3">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[#f0a050] text-[10px] font-semibold uppercase tracking-wide">
                      {article.source}
                    </span>
                    {article.pubDate && (
                      <>
                        <span className="text-[#333] text-[10px]">·</span>
                        <span className="text-[#555] text-[10px]">
                          {timeAgo(article.pubDate)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {article.image ? (
                  <img
                    src={article.image}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0 bg-[#1a1a1a]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#1a1a1a] shrink-0 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-[#333]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && filtered.length > 0 && (
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <p className="text-[#555] text-[10px] text-center">
            Updated every 15 min · Tap to read
          </p>
        </div>
      )}

    </div>
  );
}