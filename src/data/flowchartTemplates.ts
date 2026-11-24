import type {
  AcademicDepartment,
  FlowchartData,
  FlowchartEdge,
  FlowchartNode,
  FlowchartPort,
  FlowchartShapeType,
  MindMapDocument,
} from '../types/mindmap';

export interface FlowchartTemplateDef {
  id: string;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
  categoryTr: string;
  categoryEn: string;
  accentColor: string;
  department: AcademicDepartment;
  build: () => MindMapDocument;
}

export function getPortCoords(
  node: FlowchartNode,
  port: FlowchartPort
): { x: number; y: number } {
  const hw = node.width / 2;
  const hh = node.height / 2;
  switch (port) {
    case 'top':
      return { x: node.x, y: node.y - hh };
    case 'right':
      return { x: node.x + hw, y: node.y };
    case 'bottom':
      return { x: node.x, y: node.y + hh };
    case 'left':
      return { x: node.x - hw, y: node.y };
  }
}

export function buildFlowchartEdgePath(
  fromNode: FlowchartNode,
  toNode: FlowchartNode,
  edge: FlowchartEdge
): { d: string; labelX: number; labelY: number } {
  const p1 = getPortCoords(fromNode, edge.fromPort);
  const p2 = getPortCoords(toNode, edge.toPort);
  const routing = edge.routing ?? 'orthogonal';

  if (routing === 'smooth') {
    const dist = Math.max(44, Math.min(140, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.42));
    const offset = (pt: { x: number; y: number }, port: FlowchartPort) => {
      if (port === 'top') return { x: pt.x, y: pt.y - dist };
      if (port === 'bottom') return { x: pt.x, y: pt.y + dist };
      if (port === 'left') return { x: pt.x - dist, y: pt.y };
      return { x: pt.x + dist, y: pt.y };
    };
    const c1 = offset(p1, edge.fromPort);
    const c2 = offset(p2, edge.toPort);
    const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    // Midpoint at t=0.5 of cubic Bezier
    const labelX = 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x;
    const labelY = 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y;
    return { d, labelX, labelY };
  }

  // Crisp 90-degree orthogonal elbow routing with subtle rounded corners
  const pts: Array<{ x: number; y: number }> = [p1];
  const exitHorizontal = edge.fromPort === 'left' || edge.fromPort === 'right';
  const enterHorizontal = edge.toPort === 'left' || edge.toPort === 'right';
  const pad = 26;

  if (!exitHorizontal && !enterHorizontal) {
    // Vertical -> Vertical (e.g., bottom -> top)
    if ((edge.fromPort === 'bottom' && p2.y >= p1.y + 18) || (edge.fromPort === 'top' && p2.y <= p1.y - 18)) {
      const midY = (p1.y + p2.y) / 2;
      pts.push({ x: p1.x, y: midY }, { x: p2.x, y: midY });
    } else {
      const dir1 = edge.fromPort === 'bottom' ? 1 : -1;
      const dir2 = edge.toPort === 'top' ? -1 : 1;
      const sideX = p2.x >= p1.x ? Math.max(p1.x, p2.x) + fromNode.width * 0.6 + 24 : Math.min(p1.x, p2.x) - fromNode.width * 0.6 - 24;
      pts.push(
        { x: p1.x, y: p1.y + dir1 * pad },
        { x: sideX, y: p1.y + dir1 * pad },
        { x: sideX, y: p2.y + dir2 * pad },
        { x: p2.x, y: p2.y + dir2 * pad }
      );
    }
  } else if (exitHorizontal && enterHorizontal) {
    // Horizontal -> Horizontal (e.g., right -> left)
    if ((edge.fromPort === 'right' && p2.x >= p1.x + 18) || (edge.fromPort === 'left' && p2.x <= p1.x - 18)) {
      const midX = (p1.x + p2.x) / 2;
      pts.push({ x: midX, y: p1.y }, { x: midX, y: p2.y });
    } else {
      const dir1 = edge.fromPort === 'right' ? 1 : -1;
      const dir2 = edge.toPort === 'left' ? -1 : 1;
      const sideY = p2.y >= p1.y ? Math.max(p1.y, p2.y) + fromNode.height * 0.7 + 28 : Math.min(p1.y, p2.y) - fromNode.height * 0.7 - 28;
      pts.push(
        { x: p1.x + dir1 * pad, y: p1.y },
        { x: p1.x + dir1 * pad, y: sideY },
        { x: p2.x + dir2 * pad, y: sideY },
        { x: p2.x + dir2 * pad, y: p2.y }
      );
    }
  } else if (exitHorizontal && !enterHorizontal) {
    // Side exit -> top/bottom entry (classic Decision diamond branch!)
    pts.push({ x: p2.x, y: p1.y });
  } else {
    // Vertical exit -> side entry
    pts.push({ x: p1.x, y: p2.y });
  }
  pts.push(p2);

  // Build smooth corner-rounded SVG path
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const cornerR = 10;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(cornerR, d1 * 0.45, d2 * 0.45);
    if (r < 2) {
      d += ` L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    } else {
      const ax = curr.x - ((curr.x - prev.x) / d1) * r;
      const ay = curr.y - ((curr.y - prev.y) / d1) * r;
      const bx = curr.x + ((next.x - curr.x) / d2) * r;
      const by = curr.y + ((next.y - curr.y) / d2) * r;
      d += ` L ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
    }
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  // Compute label position on longest segment
  let bestIdx = 0;
  let bestLen = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (len > bestLen) {
      bestLen = len;
      bestIdx = i;
    }
  }
  const labelX = (pts[bestIdx].x + pts[bestIdx + 1].x) / 2;
  const labelY = (pts[bestIdx].y + pts[bestIdx + 1].y) / 2;

  return { d, labelX, labelY };
}

/**
 * Computes a clean hierarchical auto-layout (Top-to-Bottom or Left-to-Right)
 * for any flowchart graph, preserving cyclic feedback edges cleanly.
 */
export function computeFlowchartAutoLayout(
  data: FlowchartData,
  direction: 'TB' | 'LR' = data.direction ?? 'TB'
): FlowchartData {
  if (!data.nodes.length) return { ...data, direction };

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of data.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of data.edges) {
    if (adj.has(e.fromNodeId) && inDegree.has(e.toNodeId)) {
      adj.get(e.fromNodeId)!.push(e.toNodeId);
      inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) ?? 0) + 1);
    }
  }

  // BFS topological layering
  const layerMap = new Map<string, number>();
  const queue: string[] = [];
  for (const n of data.nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0 || n.shape === 'start_end') {
      if ((inDegree.get(n.id) ?? 0) === 0) {
        layerMap.set(n.id, 0);
        queue.push(n.id);
      }
    }
  }
  if (queue.length === 0) {
    layerMap.set(data.nodes[0].id, 0);
    queue.push(data.nodes[0].id);
  }

  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLayer = layerMap.get(cur) ?? 0;
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        layerMap.set(next, curLayer + 1);
        queue.push(next);
      }
    }
  }
  // Assign any disconnected islands
  let fallbackLayer = Math.max(0, ...Array.from(layerMap.values()));
  for (const n of data.nodes) {
    if (!layerMap.has(n.id)) {
      layerMap.set(n.id, fallbackLayer);
      fallbackLayer += 1;
    }
  }

  const layers = new Map<number, FlowchartNode[]>();
  for (const n of data.nodes) {
    const l = layerMap.get(n.id) ?? 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(n);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

  if (direction === 'TB') {
    const rowGap = 152;
    const colGap = 256;
    const startY = -((sortedLayerKeys.length - 1) * rowGap) / 2;
    sortedLayerKeys.forEach((lk, rowIdx) => {
      const row = layers.get(lk)!;
      const startX = -((row.length - 1) * colGap) / 2;
      row.forEach((node, colIdx) => {
        posMap.set(node.id, {
          x: Math.round((startX + colIdx * colGap) / 16) * 16,
          y: Math.round((startY + rowIdx * rowGap) / 16) * 16,
        });
      });
    });
  } else {
    const colGap = 272;
    const rowGap = 156;
    const startX = -((sortedLayerKeys.length - 1) * colGap) / 2;
    sortedLayerKeys.forEach((lk, colIdx) => {
      const col = layers.get(lk)!;
      const startY = -((col.length - 1) * rowGap) / 2;
      col.forEach((node, rowIdx) => {
        posMap.set(node.id, {
          x: Math.round((startX + colIdx * colGap) / 16) * 16,
          y: Math.round((startY + rowIdx * rowGap) / 16) * 16,
        });
      });
    });
  }

  const nextNodes = data.nodes.map((n) => {
    const p = posMap.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });
  const nodeById = new Map(nextNodes.map((n) => [n.id, n]));

  // Re-orient edge ports cleanly to match new geometry
  const nextEdges = data.edges.map((e) => {
    const a = nodeById.get(e.fromNodeId);
    const b = nodeById.get(e.toNodeId);
    if (!a || !b) return e;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (direction === 'TB') {
      if (dy >= 40) {
        if (a.shape === 'decision' && Math.abs(dx) > 90) {
          return { ...e, fromPort: (dx > 0 ? 'right' : 'left') as FlowchartPort, toPort: 'top' as FlowchartPort };
        }
        return { ...e, fromPort: 'bottom' as FlowchartPort, toPort: 'top' as FlowchartPort };
      }
      if (Math.abs(dy) < 40) {
        return {
          ...e,
          fromPort: (dx >= 0 ? 'right' : 'left') as FlowchartPort,
          toPort: (dx >= 0 ? 'left' : 'right') as FlowchartPort,
        };
      }
      // Loopback edge going upwards
      return {
        ...e,
        fromPort: (dx >= 0 ? 'right' : 'left') as FlowchartPort,
        toPort: (dx >= 0 ? 'right' : 'left') as FlowchartPort,
      };
    } else {
      if (dx >= 40) {
        if (a.shape === 'decision' && Math.abs(dy) > 70) {
          return { ...e, fromPort: (dy > 0 ? 'bottom' : 'top') as FlowchartPort, toPort: 'left' as FlowchartPort };
        }
        return { ...e, fromPort: 'right' as FlowchartPort, toPort: 'left' as FlowchartPort };
      }
      return {
        ...e,
        fromPort: (dy >= 0 ? 'bottom' : 'top') as FlowchartPort,
        toPort: (dy >= 0 ? 'bottom' : 'top') as FlowchartPort,
      };
    }
  });

  return { nodes: nextNodes, edges: nextEdges, direction };
}

function wrapFlowchartDoc(
  idPrefix: string,
  title: string,
  department: AcademicDepartment,
  folder: string,
  flowchart: FlowchartData
): MindMapDocument {
  const now = Date.now();
  const rootId = 'root';
  const summarySubtitle = `${flowchart.nodes.length} blok • ${flowchart.edges.length} bağlantı`;
  return {
    id: `${idPrefix}_${now}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    documentType: 'flowchart',
    layoutType: 'org_chart',
    department,
    rootNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        parentId: null,
        title,
        subtitle: summarySubtitle,
        x: 0,
        y: 0,
        branchColor: '#0EA5E9',
        collapsed: false,
      },
    },
    crossLinks: [],
    flowchart,
    inkStrokes: [],
    stickyNotes: [],
    paperStyle: 'grid',
    createdAt: now,
    updatedAt: now,
    darkMode: false,
    defaultNodeStyle: 'card',
    folder,
    isPinned: false,
    deletedAt: null,
  };
}

export function createBlankFlowchart(
  title = 'Yeni Akış Diyagramı',
  department: AcademicDepartment = 'genel'
): MindMapDocument {
  const nodes: FlowchartNode[] = [
    { id: 'fn_start', shape: 'start_end', title: 'Başla', subtitle: 'Süreç tetikleyici', x: 0, y: -216, width: 172, height: 64, color: '#10B981' },
    { id: 'fn_step1', shape: 'process', title: 'Veri Hazırla', subtitle: 'Girdiyi doğrula', x: 0, y: -72, width: 204, height: 74, color: '#0EA5E9' },
    { id: 'fn_dec', shape: 'decision', title: 'Koşul Uygun mu?', x: 0, y: 88, width: 184, height: 110, color: '#F59E0B' },
    { id: 'fn_yes', shape: 'start_end', title: 'İşlemi Tamamla', subtitle: 'Başarılı çıkış', x: 192, y: 248, width: 184, height: 66, color: '#8B5CF6' },
    { id: 'fn_no', shape: 'process', title: 'Hata Bildir & Düzelt', subtitle: 'Tekrar dene', x: -192, y: 248, width: 196, height: 74, color: '#F43F5E' },
  ];
  const edges: FlowchartEdge[] = [
    { id: 'fe_1', fromNodeId: 'fn_start', fromPort: 'bottom', toNodeId: 'fn_step1', toPort: 'top', color: '#64748B', style: 'solid', routing: 'orthogonal' },
    { id: 'fe_2', fromNodeId: 'fn_step1', fromPort: 'bottom', toNodeId: 'fn_dec', toPort: 'top', color: '#64748B', style: 'solid', routing: 'orthogonal' },
    { id: 'fe_3', fromNodeId: 'fn_dec', fromPort: 'right', toNodeId: 'fn_yes', toPort: 'top', label: 'Evet', color: '#10B981', style: 'solid', routing: 'orthogonal' },
    { id: 'fe_4', fromNodeId: 'fn_dec', fromPort: 'left', toNodeId: 'fn_no', toPort: 'top', label: 'Hayır', color: '#F43F5E', style: 'solid', routing: 'orthogonal' },
  ];
  return wrapFlowchartDoc('flow', title, department, 'engineering', { nodes, edges, direction: 'TB' });
}

export const FLOWCHART_TEMPLATES: FlowchartTemplateDef[] = [
  {
    id: 'flow_auth_2fa',
    titleTr: 'Kullanıcı Giriş & 2FA Akışı',
    titleEn: 'User Login & 2FA Auth Flow',
    subtitleTr: 'Doğrulama, karar dalları, JWT oturum ve veritabanı',
    subtitleEn: 'Validation, decision branches, JWT session & DB',
    categoryTr: 'Akış Diyagramı',
    categoryEn: 'Flowchart',
    accentColor: '#0EA5E9',
    department: 'sistem_tasarimi',
    build: () => {
      const nodes: FlowchartNode[] = [
        { id: 'n1', shape: 'start_end', title: 'Giriş İsteği', subtitle: 'POST /auth/login', x: 0, y: -288, width: 184, height: 64, color: '#10B981' },
        { id: 'n2', shape: 'io', title: 'E-Posta & Şifre Al', subtitle: 'TLS 1.3 Şifreli', x: 0, y: -160, width: 210, height: 70, color: '#0EA5E9' },
        { id: 'n3', shape: 'decision', title: 'Kimlik Doğru mu?', x: 0, y: -16, width: 188, height: 112, color: '#F59E0B' },
        { id: 'n4', shape: 'process', title: '401 Hata & Sayaç', subtitle: '5 denemede kilitle', x: -240, y: 128, width: 204, height: 74, color: '#F43F5E' },
        { id: 'n5', shape: 'decision', title: '2FA Aktif mi?', x: 176, y: 128, width: 176, height: 106, color: '#8B5CF6' },
        { id: 'n6', shape: 'process', title: 'SMS / OTP Doğrula', subtitle: '6 Haneli Kod', x: 352, y: 272, width: 196, height: 72, color: '#EC4899' },
        { id: 'n7', shape: 'database', title: 'Oturum & Token DB', subtitle: 'Redis + JWT', x: 64, y: 272, width: 200, height: 80, color: '#0284C7' },
        { id: 'n8', shape: 'start_end', title: 'Ana Panele Yönlendir', subtitle: '200 OK', x: 64, y: 400, width: 208, height: 64, color: '#10B981' },
      ];
      const edges: FlowchartEdge[] = [
        { id: 'e1', fromNodeId: 'n1', fromPort: 'bottom', toNodeId: 'n2', toPort: 'top', color: '#64748B' },
        { id: 'e2', fromNodeId: 'n2', fromPort: 'bottom', toNodeId: 'n3', toPort: 'top', color: '#64748B' },
        { id: 'e3', fromNodeId: 'n3', fromPort: 'left', toNodeId: 'n4', toPort: 'top', label: 'Hayır', color: '#F43F5E' },
        { id: 'e4', fromNodeId: 'n3', fromPort: 'right', toNodeId: 'n5', toPort: 'top', label: 'Evet', color: '#10B981' },
        { id: 'e5', fromNodeId: 'n5', fromPort: 'right', toNodeId: 'n6', toPort: 'top', label: 'Evet', color: '#8B5CF6' },
        { id: 'e6', fromNodeId: 'n5', fromPort: 'left', toNodeId: 'n7', toPort: 'top', label: 'Hayır', color: '#0EA5E9' },
        { id: 'e7', fromNodeId: 'n6', fromPort: 'left', toNodeId: 'n7', toPort: 'right', label: 'Onaylı', color: '#10B981' },
        { id: 'e8', fromNodeId: 'n7', fromPort: 'bottom', toNodeId: 'n8', toPort: 'top', color: '#10B981' },
      ];
      return wrapFlowchartDoc('flow_auth', 'Kullanıcı Giriş & 2FA Akışı', 'sistem_tasarimi', 'engineering', { nodes, edges, direction: 'TB' });
    },
  },
  {
    id: 'flow_clinical_triage',
    titleTr: 'Acil Servis Triyaj Algoritması',
    titleEn: 'Emergency Clinical Triage Flow',
    subtitleTr: 'Vital bulgular, aciliyet karar ağacı ve klinik protokol',
    subtitleEn: 'Vitals assessment, red-flag decision & clinical protocol',
    categoryTr: 'Tıp Akışı',
    categoryEn: 'Clinical Flow',
    accentColor: '#F43F5E',
    department: 'tip',
    build: () => {
      const nodes: FlowchartNode[] = [
        { id: 'c1', shape: 'start_end', title: 'Hasta Başvurusu', subtitle: 'Triyaj Kayıt', x: 0, y: -256, width: 192, height: 64, color: '#0EA5E9' },
        { id: 'c2', shape: 'io', title: 'ABCDE & Vital Ölçüm', subtitle: 'TA, Nabız, SpO₂, Ateş', x: 0, y: -128, width: 224, height: 72, color: '#8B5CF6' },
        { id: 'c3', shape: 'decision', title: 'Hayati Risk Var mı?', x: 0, y: 24, width: 196, height: 114, color: '#F43F5E' },
        { id: 'c4', shape: 'process', title: 'Kırmızı Alan Müdahale', subtitle: 'Monitörizasyon & O₂', x: -224, y: 176, width: 212, height: 76, color: '#EF4444' },
        { id: 'c5', shape: 'process', title: 'EKG, Lab & Görüntüleme', subtitle: 'Sarı / Yeşil Alan', x: 208, y: 176, width: 216, height: 76, color: '#F59E0B' },
        { id: 'c6', shape: 'document', title: 'Epikriz & Tedavi Planı', subtitle: 'Yatış veya Taburcu', x: 0, y: 320, width: 216, height: 76, color: '#10B981' },
      ];
      const edges: FlowchartEdge[] = [
        { id: 'ce1', fromNodeId: 'c1', fromPort: 'bottom', toNodeId: 'c2', toPort: 'top', color: '#64748B' },
        { id: 'ce2', fromNodeId: 'c2', fromPort: 'bottom', toNodeId: 'c3', toPort: 'top', color: '#64748B' },
        { id: 'ce3', fromNodeId: 'c3', fromPort: 'left', toNodeId: 'c4', toPort: 'top', label: 'Evet (Acil)', color: '#EF4444' },
        { id: 'ce4', fromNodeId: 'c3', fromPort: 'right', toNodeId: 'c5', toPort: 'top', label: 'Stabil', color: '#F59E0B' },
        { id: 'ce5', fromNodeId: 'c4', fromPort: 'bottom', toNodeId: 'c6', toPort: 'left', color: '#10B981' },
        { id: 'ce6', fromNodeId: 'c5', fromPort: 'bottom', toNodeId: 'c6', toPort: 'right', color: '#10B981' },
      ];
      return wrapFlowchartDoc('flow_triage', 'Acil Servis Triyaj Algoritması', 'tip', 'study_exam', { nodes, edges, direction: 'TB' });
    },
  },
  {
    id: 'flow_order_pipeline',
    titleTr: 'E-Ticaret Sipariş Süreci',
    titleEn: 'E-Commerce Order Workflow',
    subtitleTr: 'Stok kontrolü, ödeme geçidi, fatura ve kargo akışı',
    subtitleEn: 'Inventory check, payment gateway, invoice & shipping',
    categoryTr: 'İş Süreci',
    categoryEn: 'Business Flow',
    accentColor: '#10B981',
    department: 'sosyal_bilimler',
    build: () => {
      const nodes: FlowchartNode[] = [
        { id: 'o1', shape: 'start_end', title: 'Sipariş Oluşturuldu', x: 0, y: -256, width: 196, height: 64, color: '#10B981' },
        { id: 'o2', shape: 'database', title: 'Stok Veritabanı', subtitle: 'Rezervasyon Kilidi', x: 0, y: -120, width: 196, height: 78, color: '#0EA5E9' },
        { id: 'o3', shape: 'decision', title: 'Stok & Ödeme OK?', x: 0, y: 32, width: 192, height: 112, color: '#F59E0B' },
        { id: 'o4', shape: 'process', title: 'Siparişi İptal Et', subtitle: 'Otomatik Bilgilendirme', x: -224, y: 184, width: 196, height: 74, color: '#F43F5E' },
        { id: 'o5', shape: 'document', title: 'E-Fatura & Kargo Fişi', subtitle: 'Depo Çıkış Emri', x: 208, y: 184, width: 212, height: 76, color: '#8B5CF6' },
        { id: 'o6', shape: 'start_end', title: 'Müşteriye Teslim', subtitle: 'Tamamlandı', x: 208, y: 320, width: 196, height: 64, color: '#10B981' },
      ];
      const edges: FlowchartEdge[] = [
        { id: 'oe1', fromNodeId: 'o1', fromPort: 'bottom', toNodeId: 'o2', toPort: 'top', color: '#64748B' },
        { id: 'oe2', fromNodeId: 'o2', fromPort: 'bottom', toNodeId: 'o3', toPort: 'top', color: '#64748B' },
        { id: 'oe3', fromNodeId: 'o3', fromPort: 'left', toNodeId: 'o4', toPort: 'top', label: 'Hayır', color: '#F43F5E' },
        { id: 'oe4', fromNodeId: 'o3', fromPort: 'right', toNodeId: 'o5', toPort: 'top', label: 'Evet', color: '#10B981' },
        { id: 'oe5', fromNodeId: 'o5', fromPort: 'bottom', toNodeId: 'o6', toPort: 'top', color: '#10B981' },
      ];
      return wrapFlowchartDoc('flow_order', 'E-Ticaret Sipariş Süreci', 'sosyal_bilimler', 'study_exam', { nodes, edges, direction: 'TB' });
    },
  },
];

function escapeMermaidText(text: string): string {
  return text.replace(/"/g, "'").replace(/\r?\n/g, ' ').trim() || 'Step';
}

export function exportFlowchartToMermaid(doc: MindMapDocument): string {
  const fc = doc.flowchart;
  if (!fc) return `flowchart TD\n  A["${escapeMermaidText(doc.title)}"]\n`;
  const dir = fc.direction === 'LR' ? 'LR' : 'TD';
  const lines: string[] = [`flowchart ${dir}`];
  const idSafe = new Map<string, string>();
  fc.nodes.forEach((n, idx) => {
    const key = `N${idx + 1}`;
    idSafe.set(n.id, key);
    const label = escapeMermaidText(n.subtitle ? `${n.title} (${n.subtitle})` : n.title);
    if (n.shape === 'start_end') lines.push(`  ${key}(["${label}"])`);
    else if (n.shape === 'decision') lines.push(`  ${key}{"${label}"}`);
    else if (n.shape === 'io') lines.push(`  ${key}[/"${label}"/]`);
    else if (n.shape === 'database') lines.push(`  ${key}[("${label}")]`);
    else if (n.shape === 'document') lines.push(`  ${key}[["${label}"]]`);
    else lines.push(`  ${key}["${label}"]`);
  });
  for (const e of fc.edges) {
    const from = idSafe.get(e.fromNodeId);
    const to = idSafe.get(e.toNodeId);
    if (!from || !to) continue;
    const arrow = e.style === 'dashed' ? '-.->' : '-->';
    if (e.label?.trim()) {
      lines.push(`  ${from} ${arrow}|"${escapeMermaidText(e.label)}"| ${to}`);
    } else {
      lines.push(`  ${from} ${arrow} ${to}`);
    }
  }
  return lines.join('\n') + '\n';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function computeFlowchartBounds(fc: FlowchartData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (!fc.nodes.length) return { minX: -320, minY: -240, maxX: 320, maxY: 240 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of fc.nodes) {
    minX = Math.min(minX, n.x - n.width / 2 - 48);
    maxX = Math.max(maxX, n.x + n.width / 2 + 48);
    minY = Math.min(minY, n.y - n.height / 2 - 48);
    maxY = Math.max(maxY, n.y + n.height / 2 + 48);
  }
  return { minX, minY, maxX, maxY };
}

export function buildFlowchartNodeShapeSvg(
  shape: FlowchartShapeType,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string
): string {
  const left = x - w / 2;
  const top = y - h / 2;
  if (shape === 'start_end') {
    const rx = Math.min(h / 2, 36);
    return `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" />`;
  }
  if (shape === 'decision') {
    return `<polygon points="${x.toFixed(1)},${top.toFixed(1)} ${(left + w).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(top + h).toFixed(1)} ${left.toFixed(1)},${y.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round" />`;
  }
  if (shape === 'io') {
    const skew = 18;
    return `<polygon points="${(left + skew).toFixed(1)},${top.toFixed(1)} ${(left + w).toFixed(1)},${top.toFixed(1)} ${(left + w - skew).toFixed(1)},${(top + h).toFixed(1)} ${left.toFixed(1)},${(top + h).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round" />`;
  }
  if (shape === 'database') {
    const ry = 12;
    const rx = w / 2;
    const bodyD = `M ${left.toFixed(1)} ${(top + ry).toFixed(1)} V ${(top + h - ry).toFixed(1)} A ${rx.toFixed(1)} ${ry} 0 0 0 ${(left + w).toFixed(1)} ${(top + h - ry).toFixed(1)} V ${(top + ry).toFixed(1)} Z`;
    return `${`<path d="${bodyD}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" />`}<ellipse cx="${x.toFixed(1)}" cy="${(top + ry).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" />`;
  }
  if (shape === 'document') {
    const waveY = top + h - 10;
    const d = `M ${left.toFixed(1)} ${(top + 12).toFixed(1)} Q ${left.toFixed(1)} ${top.toFixed(1)} ${(left + 12).toFixed(1)} ${top.toFixed(1)} H ${(left + w - 12).toFixed(1)} Q ${(left + w).toFixed(1)} ${top.toFixed(1)} ${(left + w).toFixed(1)} ${(top + 12).toFixed(1)} V ${waveY.toFixed(1)} Q ${(left + w * 0.75).toFixed(1)} ${(waveY - 14).toFixed(1)} ${x.toFixed(1)} ${waveY.toFixed(1)} T ${left.toFixed(1)} ${waveY.toFixed(1)} Z`;
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2.6" />`;
  }
  return `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="2.6" />`;
}

export function renderFlowchartToSvgString(
  doc: MindMapDocument,
  transparentBg = false
): string {
  const fc = doc.flowchart ?? { nodes: [], edges: [] };
  const bounds = computeFlowchartBounds(fc);
  const pad = 48;
  const width = Math.max(480, Math.round(bounds.maxX - bounds.minX + pad * 2));
  const height = Math.max(360, Math.round(bounds.maxY - bounds.minY + pad * 2));
  const ox = -bounds.minX + pad;
  const oy = -bounds.minY + pad;
  const dark = Boolean(doc.darkMode);
  const bg = dark ? '#0F172A' : '#FAF9F5';
  const cardBg = dark ? '#1E293B' : '#FFFFFF';
  const textFill = dark ? '#F8FAFC' : '#0F172A';
  const subFill = dark ? '#94A3B8' : '#475569';

  const nodeById = new Map(fc.nodes.map((n) => [n.id, n]));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" /></marker></defs>`,
  ];
  if (!transparentBg) {
    parts.push(`<rect width="100%" height="100%" fill="${bg}" />`);
  }
  parts.push(`<g transform="translate(${ox.toFixed(1)}, ${oy.toFixed(1)})">`);

  // Edges first
  for (const e of fc.edges) {
    const a = nodeById.get(e.fromNodeId);
    const b = nodeById.get(e.toNodeId);
    if (!a || !b) continue;
    const { d, labelX, labelY } = buildFlowchartEdgePath(a, b, e);
    const stroke = e.color || '#64748B';
    const dash = e.style === 'dashed' ? ' stroke-dasharray="7 5"' : '';
    parts.push(
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round"${dash} marker-end="url(#fc-arrow)" />`
    );
    if (e.label?.trim()) {
      const lw = Math.max(42, e.label.length * 7.5 + 18);
      parts.push(
        `<rect x="${(labelX - lw / 2).toFixed(1)}" y="${(labelY - 12).toFixed(1)}" width="${lw.toFixed(1)}" height="24" rx="12" fill="${cardBg}" stroke="${stroke}" stroke-width="1.5" />` +
          `<text x="${labelX.toFixed(1)}" y="${(labelY + 4).toFixed(1)}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11.5" font-weight="700" fill="${textFill}">${escapeXml(e.label)}</text>`
      );
    }
  }

  // Nodes
  for (const n of fc.nodes) {
    parts.push(buildFlowchartNodeShapeSvg(n.shape, n.x, n.y, n.width, n.height, cardBg, n.color));
    const hasSub = Boolean(n.subtitle?.trim()) && n.shape !== 'decision';
    const titleY = hasSub ? n.y - 4 : n.y + 4;
    parts.push(
      `<text x="${n.x.toFixed(1)}" y="${titleY.toFixed(1)}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13.5" font-weight="800" fill="${textFill}">${escapeXml(n.title)}</text>`
    );
    if (hasSub && n.subtitle) {
      parts.push(
        `<text x="${n.x.toFixed(1)}" y="${(n.y + 15).toFixed(1)}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="500" fill="${subFill}">${escapeXml(n.subtitle)}</text>`
      );
    }
  }

  parts.push(`</g></svg>`);
  return parts.join('');
}

/**
 * Parses standard Mermaid `flowchart TD/LR` or `graph TD/LR` syntax into an interactive FlowchartData.
 * Supports `([Start])`, `[Process]`, `{Decision}`, `[/Data/]`, `[(Database)]`, `[[Document]]`,
 * and labeled edges `A -->|Yes| B`, `A -- Yes --> B`, `A -.-> B`.
 */
export function parseMermaidToFlowchart(rawInput: string): FlowchartData {
  const lines = rawInput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('%%'));

  let direction: 'TB' | 'LR' = 'TB';
  const nodesById = new Map<string, FlowchartNode>();
  const edges: FlowchartEdge[] = [];
  const palette = ['#10B981', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EC4899', '#0284C7'];

  const ensureNode = (rawToken: string): string => {
    const token = rawToken.trim();
    const m = token.match(/^([A-Za-z0-9_-]+)\s*(.*)$/);
    const id = m?.[1] || `n_${nodesById.size + 1}`;
    const rest = (m?.[2] || '').trim();

    let shape: FlowchartShapeType = 'process';
    let label = id;
    if (rest.startsWith('([') && rest.endsWith('])')) {
      shape = 'start_end';
      label = rest.slice(2, -2);
    } else if (rest.startsWith('[(') && rest.endsWith(')]')) {
      shape = 'database';
      label = rest.slice(2, -2);
    } else if (rest.startsWith('[[') && rest.endsWith(']]')) {
      shape = 'document';
      label = rest.slice(2, -2);
    } else if (rest.startsWith('[/') && rest.endsWith('/]')) {
      shape = 'io';
      label = rest.slice(2, -2);
    } else if (rest.startsWith('{') && rest.endsWith('}')) {
      shape = 'decision';
      label = rest.slice(1, -1);
    } else if (rest.startsWith('(') && rest.endsWith(')')) {
      shape = 'start_end';
      label = rest.slice(1, -1);
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      shape = 'process';
      label = rest.slice(1, -1);
    }
    label = label.replace(/^["']|["']$/g, '').trim() || id;

    const existing = nodesById.get(id);
    if (!existing) {
      const idx = nodesById.size;
      nodesById.set(id, {
        id,
        shape,
        title: label,
        x: 0,
        y: idx * 140,
        width: shape === 'decision' ? 188 : 204,
        height: shape === 'decision' ? 110 : shape === 'start_end' ? 64 : 74,
        color:
          shape === 'start_end'
            ? '#10B981'
            : shape === 'decision'
            ? '#F59E0B'
            : shape === 'database'
            ? '#0284C7'
            : palette[idx % palette.length],
      });
    } else if (rest) {
      existing.shape = shape;
      existing.title = label;
      if (shape === 'decision') {
        existing.width = 188;
        existing.height = 110;
      }
    }
    return id;
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL)/i);
    if (headerMatch) {
      direction = headerMatch[1].toUpperCase() === 'LR' ? 'LR' : 'TB';
      continue;
    }

    // Match `A -->|Label| B`, `A -.->|Label| B`, `A -- Label --> B`, `A --> B`
    const pipeEdge = line.match(/^(.+?)\s*(-->|-\.->|==>)\s*(?:\|([^|]+)\|)?\s*(.+)$/);
    if (pipeEdge) {
      const fromId = ensureNode(pipeEdge[1]);
      const arrowToken = pipeEdge[2];
      const lbl = pipeEdge[3]?.replace(/^["']|["']$/g, '').trim();
      const toId = ensureNode(pipeEdge[4]);
      if (fromId !== toId) {
        edges.push({
          id: `fe_m_${edges.length + 1}`,
          fromNodeId: fromId,
          fromPort: direction === 'LR' ? 'right' : 'bottom',
          toNodeId: toId,
          toPort: direction === 'LR' ? 'left' : 'top',
          label: lbl || undefined,
          style: arrowToken === '-.->' ? 'dashed' : 'solid',
          color:
            lbl && /^(evet|yes|ok|onay|başarılı|success)$/i.test(lbl)
              ? '#10B981'
              : lbl && /^(hayır|no|hata|error|red|iptal)$/i.test(lbl)
              ? '#F43F5E'
              : '#64748B',
          routing: 'orthogonal',
        });
      }
      continue;
    }

    const textEdge = line.match(/^(.+?)\s*--\s*([^-][^>]+?)\s*-->\s*(.+)$/);
    if (textEdge) {
      const fromId = ensureNode(textEdge[1]);
      const lbl = textEdge[2].replace(/^["']|["']$/g, '').trim();
      const toId = ensureNode(textEdge[3]);
      if (fromId !== toId) {
        edges.push({
          id: `fe_m_${edges.length + 1}`,
          fromNodeId: fromId,
          fromPort: direction === 'LR' ? 'right' : 'bottom',
          toNodeId: toId,
          toPort: direction === 'LR' ? 'left' : 'top',
          label: lbl || undefined,
          style: 'solid',
          color: '#64748B',
          routing: 'orthogonal',
        });
      }
      continue;
    }

    // Standalone node declaration
    if (/^[A-Za-z0-9_-]+\s*[\[\(\{]/.test(line)) {
      ensureNode(line);
    }
  }

  return computeFlowchartAutoLayout(
    {
      nodes: Array.from(nodesById.values()),
      edges,
      direction,
    },
    direction
  );
}

/**
 * Converts any MindMapDocument into a crisp auto-laid-out Flowchart document in 1 tap!
 */
export function convertMindMapToFlowchart(doc: MindMapDocument): MindMapDocument {
  const fNodes: FlowchartNode[] = [];
  const fEdges: FlowchartEdge[] = [];
  const childrenCount = new Map<string, number>();

  for (const n of Object.values(doc.nodes)) {
    if (n.parentId) {
      childrenCount.set(n.parentId, (childrenCount.get(n.parentId) ?? 0) + 1);
    }
  }

  for (const n of Object.values(doc.nodes)) {
    const isRoot = n.id === doc.rootNodeId;
    const kids = childrenCount.get(n.id) ?? 0;
    const shape: FlowchartShapeType = isRoot
      ? 'start_end'
      : n.title.includes('?') || kids >= 3
      ? 'decision'
      : kids === 0
      ? 'document'
      : 'process';

    fNodes.push({
      id: n.id,
      shape,
      title: n.title,
      subtitle: n.subtitle || n.techBadge,
      x: n.x,
      y: n.y,
      width: shape === 'decision' ? 190 : 206,
      height: shape === 'decision' ? 112 : shape === 'start_end' ? 66 : 74,
      color: n.branchColor || '#0EA5E9',
    });

    if (n.parentId && doc.nodes[n.parentId]) {
      fEdges.push({
        id: `fe_cv_${n.id}`,
        fromNodeId: n.parentId,
        fromPort: 'bottom',
        toNodeId: n.id,
        toPort: 'top',
        color: n.branchColor || '#64748B',
        style: 'solid',
        routing: 'orthogonal',
      });
    }
  }

  for (const cl of doc.crossLinks ?? []) {
    if (doc.nodes[cl.fromNodeId] && doc.nodes[cl.toNodeId]) {
      fEdges.push({
        id: `fe_cl_${cl.id}`,
        fromNodeId: cl.fromNodeId,
        fromPort: 'right',
        toNodeId: cl.toNodeId,
        toPort: 'left',
        label: cl.label || undefined,
        color: cl.color || '#8B5CF6',
        style: 'dashed',
        routing: 'smooth',
      });
    }
  }

  const laidOut = computeFlowchartAutoLayout(
    { nodes: fNodes, edges: fEdges, direction: 'TB' },
    'TB'
  );
  return wrapFlowchartDoc(
    'flow_conv',
    `${doc.title} (Akış)`,
    doc.department,
    doc.folder || 'engineering',
    laidOut
  );
}
