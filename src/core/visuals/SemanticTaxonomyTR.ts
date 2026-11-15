import type { DisciplineProfile, MetaphorChip } from '../../types/mindmap';
import {
  expandSemanticQueryV3,
  normalizeTrToken,
  stemTurkishSafe,
  type ExpandedSemanticQueryV3,
  type OfflineTaxonomyDomain,
} from './taxonomyData.js';

export type { ExpandedSemanticQueryV3, OfflineTaxonomyDomain };
export { expandSemanticQueryV3, normalizeTrToken, stemTurkishSafe };

const DISCIPLINE_TO_OFFLINE_DOMAIN: Record<DisciplineProfile, OfflineTaxonomyDomain> = {
  medicine_biology: 'medicine_bio',
  system_design_cs: 'system_cs',
  electronics_robotics: 'electronics',
  law_governance: 'law',
  architecture_civil: 'architecture',
  exact_sciences: 'science',
  humanities_social: 'social_history',
  business_economics: 'business',
};

export function mapDisciplineToOfflineDomain(
  discipline: DisciplineProfile
): OfflineTaxonomyDomain {
  return DISCIPLINE_TO_OFFLINE_DOMAIN[discipline] ?? 'general';
}

export function buildSemanticMetaphorChipsV3(
  expanded: ExpandedSemanticQueryV3
): MetaphorChip[] {
  const chips: MetaphorChip[] = [];
  const seen = new Set<string>();
  const emojis = ['🎯', '🔎', '✨', '🧩', '🔬', '⚡'];

  for (const en of expanded.expandedEnTokens) {
    if (en.length < 3 || seen.has(en)) continue;
    seen.add(en);
    chips.push({
      label: en
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      queryEn: en,
      emoji: emojis[chips.length % emojis.length],
    });
    if (chips.length >= 6) break;
  }

  return chips;
}
