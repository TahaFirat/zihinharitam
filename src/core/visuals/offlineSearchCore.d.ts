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

export interface OfflineSearchHit extends OfflineManifestItem {
  normalizedScore: number;
  bm25Score: number;
}

export class OfflineBM25Engine {
  constructor(manifestItems?: OfflineManifestItem[]);
  loadManifest(items: OfflineManifestItem[]): void;
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
