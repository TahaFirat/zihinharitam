export type OfflineTaxonomyDomain =
  | 'medicine_bio'
  | 'system_cs'
  | 'electronics'
  | 'law'
  | 'architecture'
  | 'science'
  | 'social_history'
  | 'business'
  | 'general';

export interface ExpandedSemanticQueryV3 {
  normalizedQuery: string;
  stemmedTokens: string[];
  expandedEnTokens: string[];
  expandedTrTokens: string[];
  blockedTokens: string[];
  matchedAtlasIds: string[];
  detectedDomains: OfflineTaxonomyDomain[];
  isHomonym: boolean;
}

export function normalizeTrToken(raw: string): string;
export function stemTurkishSafe(word: string): string;
export function enrichEnglishIconTokensWithTurkish(
  enTokens: string[],
  packPrefix: string
): { trTags: string; domain: OfflineTaxonomyDomain };
export function expandSemanticQueryV3(
  rawQuery: string,
  disciplineHint?: string
): ExpandedSemanticQueryV3;
export const RAW_TAXONOMY_CLUSTERS: Array<[string, string, string, string?, string?]>;
export const DIRECT_TR_EN_PAIRS: Record<string, string[]>;
