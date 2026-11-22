export type VisualStyleMode = 'illustration' | '3d' | 'photo' | 'diagram';

export type AcademicDepartment =
  | 'genel'
  | 'sistem_tasarimi'
  | 'tip'
  | 'muhendislik'
  | 'hukuk'
  | 'mimarlik'
  | 'temel_bilimler'
  | 'sosyal_bilimler';

export type DisciplineProfile =
  | 'system_design_cs'
  | 'electronics_robotics'
  | 'medicine_biology'
  | 'law_governance'
  | 'architecture_civil'
  | 'exact_sciences'
  | 'humanities_social'
  | 'business_economics';

export type GalleryCategoryFilter =
  | 'all'
  | 'hand_drawn'
  | 'system_arch'
  | '3d_color'
  | 'medical_academic'
  | 'photo'
  | 'diagram';

export type AIArtStyle =
  | 'hand_drawn'
  | 'isometric_3d'
  | 'scientific_atlas'
  | 'flat_vector';

export type ExamRecallMode = 'off' | 'hide_text' | 'hide_visuals_children';

export type NodeVisualStyle = 'card' | 'organic';

export type StickerSizePreset = 'sm' | 'md' | 'lg' | 'xl';

export type NodePriorityTag = 'important' | 'exam' | 'review';

export type IconTierFilter = 'all' | 'free' | 'pro';

export type MindMapFolder = 'general' | 'study_exam' | 'engineering';

export type PaywallTriggerReason =
  | 'header_pill'
  | 'map_limit'
  | 'node_limit'
  | 'pro_sticker'
  | 'note_crop_limit'
  | 'smart_map_limit'
  | 'ai_sticker_limit'
  | 'pro_export'
  | 'exam_mode'
  | 'settings_upgrade';

export interface StickerAsset {
  id: string;
  url: string; // Yerel Blob URL, SVG Data URL veya CDN WebP/PNG URL
  mode: VisualStyleMode;
  source: 'library' | 'ai_pool' | 'note_crop' | 'sketch' | 'user_photo';
  dieCutProcessed: boolean;
  aspectRatio: number;
  label?: string;
  tags?: string[];
  badgeEmoji?: string;
  isVectorSvg?: boolean;
  iconifyId?: string;
  rawSvgBody?: string;
  rawViewBox?: string;
  isDuotoneColorizable?: boolean;
}

export interface MindNode {
  id: string;
  parentId: string | null;
  title: string;
  subtitle?: string;
  subtitleIsTemplateDefault?: boolean;
  note?: string; // Uzun ders notu / detaylı alt açıklama (çok satırlı, responsive)
  noteCollapsed?: boolean; // Uzun açıklamanın kart üzerinde daraltılıp açılması
  checked?: boolean | null; // Görev / çalışma ilerleme onay kutusu (Checklist)
  priorityTag?: NodePriorityTag | null; // Önem / Sınavda Çıkar / Tekrar Et etiketi
  techBadge?: string; // Örn: "Port 443 • HTTPS", "O(log N)", "CMK m.272", "Av = -Rf/Rin"
  x: number;
  y: number;
  branchColor: string;
  collapsed: boolean;
  sticker?: StickerAsset;
  nodeStyle?: NodeVisualStyle;
  stickerSize?: StickerSizePreset;
  examHidden?: boolean;
  stickerUpdatedAt?: number;
}

export interface CrossLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  color?: string;
  style?: 'dashed_flow' | 'solid_arrow';
}

export type InkToolType =
  | 'pen'
  | 'highlighter'
  | 'laser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'lasso'
  | 'eraser';

export type EraserMode = 'stroke' | 'area';

export type PaperStyleType = 'dots' | 'grid' | 'lined' | 'blank' | 'warm';

export interface CanvasStickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  width?: number;
}

export interface CanvasInkStroke {
  id: string;
  tool: Exclude<InkToolType, 'eraser' | 'lasso' | 'laser'> | 'pencil';
  color: string;
  width: number;
  opacity: number;
  /** World-space coordinates `[worldX, worldY, pressure]` so ink pans/zooms at 120Hz in lockstep with branches! */
  points: Array<[number, number, number]>;
}

export interface MindMapDocument {
  id: string;
  title: string;
  department: AcademicDepartment;
  rootNodeId: string;
  nodes: Record<string, MindNode>;
  crossLinks?: CrossLink[];
  inkStrokes?: CanvasInkStroke[];
  stickyNotes?: CanvasStickyNote[];
  paperStyle?: PaperStyleType;
  createdAt: number;
  updatedAt: number;
  darkMode?: boolean;
  defaultNodeStyle?: NodeVisualStyle;
  folder?: MindMapFolder;
  isPinned?: boolean;
  deletedAt?: number | null;
  thumbnailDataUrl?: string;
}

export interface ViewportTransform {
  x: number; // Screen offset X in CSS pixels
  y: number; // Screen offset Y in CSS pixels
  scale: number; // Zoom factor (0.15 - 4.0)
}

export interface CollaboratorPresence {
  id: string;
  name: string;
  color: string;
  avatarInitials: string;
  worldX: number;
  worldY: number;
  activeNodeId?: string | null;
  lastSeen: number;
  isLocal?: boolean;
}

export interface VisualSearchResult {
  id: string;
  title: string;
  previewUrl: string;
  rawUrl: string;
  mode: VisualStyleMode;
  category: Exclude<GalleryCategoryFilter, 'all'>;
  source: 'library' | 'ai_pool' | 'note_crop' | 'sketch' | 'user_photo';
  needsDieCut: boolean;
  aspectRatio: number;
  score: number;
  providerName: string;
  isDuotoneColorizable?: boolean;
  rawSvgMarkup?: string;
  rawViewBox?: string;
  iconifyId?: string;
  shardId?: number;
  isVectorSvg?: boolean;
  tier?: 'free' | 'pro';
}

export interface ProactiveBranchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  techBadge?: string;
  sticker: StickerAsset;
}

export interface MetaphorChip {
  label: string;
  queryEn: string;
  emoji: string;
}

export const BRANCH_PALETTE = [
  '#F59E0B', // Kehribar
  '#0EA5E9', // Okyanus Mavisi
  '#10B981', // Zümrüt
  '#8B5CF6', // Mor
  '#F43F5E', // Mercan
  '#EC4899', // Fuşya
] as const;

export const DEPARTMENT_LABELS: Record<AcademicDepartment, { label: string; emoji: string }> = {
  genel: { label: 'Otomatik Bağlam', emoji: '🧠' },
  sistem_tasarimi: { label: 'Sistem Tasarımı & Yazılım', emoji: '🖧' },
  tip: { label: 'Tıp & Biyoloji', emoji: '🩺' },
  muhendislik: { label: 'Elektronik & Mühendislik', emoji: '⚙️' },
  hukuk: { label: 'Hukuk & Kamu', emoji: '⚖️' },
  mimarlik: { label: 'Mimarlık & Yapı', emoji: '🏛️' },
  temel_bilimler: { label: 'Temel Bilimler', emoji: '🔬' },
  sosyal_bilimler: { label: 'Sosyal Bilimler & İktisat', emoji: '📚' },
};

export const DISCIPLINE_LABELS: Record<
  DisciplineProfile,
  { label: string; emoji: string; accent: string }
> = {
  system_design_cs: {
    label: 'Sistem Tasarımı & Bulut',
    emoji: '🖧',
    accent: '#0EA5E9',
  },
  electronics_robotics: {
    label: 'Elektronik & Gömülü Sistemler',
    emoji: '⚡',
    accent: '#F59E0B',
  },
  medicine_biology: {
    label: 'Kardiyoloji, Tıp & Biyoloji',
    emoji: '🫀',
    accent: '#F43F5E',
  },
  law_governance: {
    label: 'Hukuk & Yargılama',
    emoji: '⚖️',
    accent: '#8B5CF6',
  },
  architecture_civil: {
    label: 'Mimarlık & Yapı Statiği',
    emoji: '🏛️',
    accent: '#D97706',
  },
  exact_sciences: {
    label: 'Fizik, Kimya & Matematik',
    emoji: '🔬',
    accent: '#10B981',
  },
  humanities_social: {
    label: 'Tarih, Edebiyat & Sosyal Bilimler',
    emoji: '📜',
    accent: '#EC4899',
  },
  business_economics: {
    label: 'İktisat, Finans & İşletme',
    emoji: '📈',
    accent: '#059669',
  },
};
