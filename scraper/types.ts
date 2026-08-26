export type RawJob = {
  externalId: string;
  title: string;
  company?: string;
  url: string;
  location?: string;
  postedAt?: Date;
};

export type ScraperSession = {
  scrape: (keyword: string) => Promise<RawJob[]>;
  // Fetches the full posting text from a job's detail page. Returns
  // undefined if the page has no extractable description.
  fetchDescription: (url: string) => Promise<string | undefined>;
  dispose: () => Promise<void>;
};

// A source scraper opens one session per run (e.g. one browser launch) and
// reuses it across every keyword, instead of paying setup cost per keyword.
export type SourceScraper = () => Promise<ScraperSession>;
