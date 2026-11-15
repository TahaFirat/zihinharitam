import type { AcademicDepartment, StickerAsset, VisualSearchResult } from '../../types/mindmap';
import { AIStickerDirector } from './AIStickerDirector';
import { TopicContextIntelligence } from './TopicContextIntelligence';
import { getPackStickerById, SYSTEM_DESIGN_AND_ATLAS_PACK } from './providers/SystemDesignVisualPack';

/**
 * Clean V2 Facade (Zero Fake Procedural SVG Shapes — BAN 1 Enforced!)
 * Delegates shared-pool lookup to `AIStickerDirector` and resolves instant fallback
 * to real curated multi-color artwork when invoked outside the 4-Candidate Studio modal.
 */
export class AIStickerService {
  public static async searchSharedPool(
    query: string,
    limit = 6
  ): Promise<VisualSearchResult[]> {
    return AIStickerDirector.searchSharedPool(query, limit);
  }

  public static async resolveBestCuratedStickerForConcept(
    conceptTr: string,
    department: AcademicDepartment = 'genel'
  ): Promise<StickerAsset> {
    const clean = conceptTr.trim() || 'Merkezi Konu';
    const pooled = await AIStickerDirector.searchSharedPool(clean, 1);
    if (pooled.length > 0) {
      return {
        id: pooled[0].id,
        url: pooled[0].previewUrl,
        mode: pooled[0].mode,
        source: 'ai_pool',
        dieCutProcessed: true,
        aspectRatio: pooled[0].aspectRatio || 1,
        label: clean,
      };
    }

    const dummyRoot = {
      root: {
        id: 'root',
        parentId: null,
        title: clean,
        x: 0,
        y: 0,
        branchColor: '#0EA5E9',
        collapsed: false,
      },
    };
    const ctx = TopicContextIntelligence.analyzeMapContext(dummyRoot, 'root', 'root', department);
    const expanded = TopicContextIntelligence.expandQueryWithContext(clean, ctx);
    const packHit =
      (expanded.matchedPackIds[0] ? getPackStickerById(expanded.matchedPackIds[0]) : undefined) ??
      SYSTEM_DESIGN_AND_ATLAS_PACK.find((p) => p.discipline === ctx.discipline) ??
      SYSTEM_DESIGN_AND_ATLAS_PACK[0];

    return {
      id: `curated_${packHit.id}_${Date.now()}`,
      url: packHit.svgDataUri,
      mode: 'illustration',
      source: 'library',
      dieCutProcessed: true,
      aspectRatio: 1,
      label: packHit.titleTr,
    };
  }
}
