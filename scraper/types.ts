export type RawJob = {
  externalId: string;
  title: string;
  company?: string;
  url: string;
  location?: string;
  postedAt?: Date;
};

export type SourceScraper = (keyword: string) => Promise<RawJob[]>;
