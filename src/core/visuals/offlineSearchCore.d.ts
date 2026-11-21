import type { ExpandedSemanticQueryV3, OfflineTaxonomyDomain } from './taxonomyData.js';

export interface OfflineManifestItem {
  id: string;
  pack: string;
  name: string;
  trTags: string;
  enTags: string;
  domain: OfflineTaxonomyDomain;
  isMultiColor: boolean;
  tier?: 'free' | 'pro';
  shardId: number;
}

export interface FastIndexV7Payload {
  version: number;
  totalIcons: number;
  packs: string[];
  domains: OfflineTaxonomyDomain[];
  rows: Array<[string, string, number, number, number, number]>;
  namePostings: Record<string, number[]>;
  tagPostings: Record<string, number[]>;
  vocab: string[];
}

export interface OfflineSearchHit extends OfflineManifestItem {
  normalizedScore: number;
  bm25Score: number;
}

export class OfflineBM25Engine {
  constructor(manifestItems?: OfflineManifestItem[]);
  loadManifest(items: OfflineManifestItem[]): void;
  loadFastIndexV7(fastJson: FastIndexV7Payload): void;
  search(
    rawQuery: string,
    options?: {
      discipline?: string;
      activeOfflineDomain?: OfflineTaxonomyDomain;
      limit?: number;
    }
  ): {
    hits: OfflineSearchHit[];
    expanded: ExpandedSemanticQueryV3;
  };
}
