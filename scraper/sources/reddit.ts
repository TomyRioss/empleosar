import type { SourceScraper } from "../types";

export const scrapeReddit: SourceScraper = async (keyword) => {
  const url = `https://www.reddit.com/r/empleos/search.json?q=${encodeURIComponent(
    keyword,
  )}&restrict_sr=1&sort=new`;

  const res = await fetch(url, {
    headers: { "User-Agent": "trabajoteca-hub/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Reddit request failed: ${res.status}`);
  }

  const json = await res.json();

  return json.data.children.map((child: { data: { id: string; title: string; permalink: string; created_utc: number } }) => ({
    externalId: child.data.id,
    title: child.data.title,
    url: `https://www.reddit.com${child.data.permalink}`,
    postedAt: new Date(child.data.created_utc * 1000),
  }));
};
