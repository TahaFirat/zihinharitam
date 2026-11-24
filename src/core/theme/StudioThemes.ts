import type { MindMapDocument } from '../../types/mindmap';

export type StudioThemeId =
  | 'classic'
  | 'ocean'
  | 'botanical'
  | 'pastel'
  | 'espresso'
  | 'cyber';

export interface StudioThemeDef {
  id: StudioThemeId;
  nameTr: string;
  nameEn: string;
  swatch: string;
  isDark: boolean;
  paperStyle: MindMapDocument['paperStyle'];
  palette: readonly [string, string, string, string, string, string];
}

export const STUDIO_THEMES: readonly StudioThemeDef[] = [
  {
    id: 'classic',
    nameTr: 'Klasik Defter',
    nameEn: 'Classic Paper',
    swatch: '#F59E0B',
    isDark: false,
    paperStyle: 'dots',
    palette: ['#F59E0B', '#0EA5E9', '#10B981', '#8B5CF6', '#F43F5E', '#EC4899'],
  },
  {
    id: 'ocean',
    nameTr: 'Okyanus',
    nameEn: 'Ocean Mist',
    swatch: '#0284C7',
    isDark: false,
    paperStyle: 'grid',
    palette: ['#0284C7', '#0891B2', '#2563EB', '#0D9488', '#4F46E5', '#0369A1'],
  },
  {
    id: 'botanical',
    nameTr: 'Botanik',
    nameEn: 'Botanical Sage',
    swatch: '#059669',
    isDark: false,
    paperStyle: 'warm',
    palette: ['#059669', '#65A30D', '#D97706', '#0D9488', '#EA580C', '#16A34A'],
  },
  {
    id: 'pastel',
    nameTr: 'Pastel Stüdyo',
    nameEn: 'Pastel Studio',
    swatch: '#EC4899',
    isDark: false,
    paperStyle: 'dots',
    palette: ['#F472B6', '#38BDF8', '#34D399', '#A78BFA', '#FB923C', '#FB7185'],
  },
  {
    id: 'espresso',
    nameTr: 'Sıcak Kahve',
    nameEn: 'Warm Espresso',
    swatch: '#B45309',
    isDark: false,
    paperStyle: 'warm',
    palette: ['#B45309', '#9A3412', '#4D7C0F', '#0F766E', '#7C2D12', '#A16207'],
  },
  {
    id: 'cyber',
    nameTr: 'Gece Neon',
    nameEn: 'Midnight Neon',
    swatch: '#22D3EE',
    isDark: true,
    paperStyle: 'grid',
    palette: ['#22D3EE', '#E879F9', '#4ADE80', '#FBBF24', '#818CF8', '#FB7185'],
  },
] as const;

export function applyStudioThemeToDocument(
  doc: MindMapDocument,
  themeId: StudioThemeId
): MindMapDocument {
  const theme = STUDIO_THEMES.find((t) => t.id === themeId) ?? STUDIO_THEMES[0];
  const palette = theme.palette;

  // Harmoniously recolor mind map branches (each main branch gets a cohesive palette color, inherited by its subtree)
  const nextNodes = { ...doc.nodes };
  const mainBranches = Object.values(nextNodes).filter((n) => n.parentId === doc.rootNodeId);
  const branchColorMap = new Map<string, string>();
  mainBranches.forEach((b, idx) => {
    branchColorMap.set(b.id, palette[idx % palette.length]);
  });

  const resolveMainAncestor = (id: string): string | null => {
    let cur = nextNodes[id];
    let guard = 0;
    while (cur && cur.parentId && guard++ < 40) {
      if (cur.parentId === doc.rootNodeId) return cur.id;
      cur = nextNodes[cur.parentId];
    }
    return null;
  };

  for (const [id, node] of Object.entries(nextNodes)) {
    if (id === doc.rootNodeId) {
      nextNodes[id] = { ...node, branchColor: palette[0] };
    } else {
      const mainId = resolveMainAncestor(id);
      const col = (mainId && branchColorMap.get(mainId)) || palette[0];
      nextNodes[id] = { ...node, branchColor: col };
    }
  }

  // Harmoniously recolor flowchart blocks too if present
  const nextFlowchart = doc.flowchart
    ? {
        ...doc.flowchart,
        nodes: doc.flowchart.nodes.map((fn, idx) => ({
          ...fn,
          color: palette[idx % palette.length],
        })),
      }
    : doc.flowchart;

  return {
    ...doc,
    colorTheme: theme.id,
    darkMode: theme.isDark,
    paperStyle: theme.paperStyle,
    nodes: nextNodes,
    flowchart: nextFlowchart,
    updatedAt: Date.now(),
  };
}
