import type { DisciplineProfile, GalleryCategoryFilter } from '../../../types/mindmap';

export interface CuratedPackSticker {
  id: string;
  titleTr: string;
  titleEn: string;
  discipline: DisciplineProfile;
  category: Exclude<GalleryCategoryFilter, 'all'>;
  tagsTr: string[];
  tagsEn: string[];
  svgDataUri: string;
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Wraps rich multi-color isometric/editorial SVG artwork in a crisp #FFFFFF Die-Cut Sticker frame.
 */
export function wrapMultiColorDieCutSvg(inner: string, viewBox = '0 0 160 160'): string {
  return toDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="160" height="160">
  <defs>
    <linearGradient id="isoTopBlue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0284C7"/>
    </linearGradient>
    <linearGradient id="isoTopEmerald" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="isoTopViolet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#A78BFA"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
    <linearGradient id="isoTopAmber" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="isoTopRose" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FB7185"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
    <filter id="dc" x="-22%" y="-22%" width="144%" height="148%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="7" result="wDilate"/>
      <feFlood flood-color="#FFFFFF" flood-opacity="1" result="wFlood"/>
      <feComposite in="wFlood" in2="wDilate" operator="in" result="wRing"/>
      <feMorphology in="SourceAlpha" operator="dilate" radius="8.1" result="bDilate"/>
      <feFlood flood-color="#0F172A" flood-opacity="0.12" result="bFlood"/>
      <feComposite in="bFlood" in2="bDilate" operator="in" result="cutLine"/>
      <feDropShadow in="cutLine" dx="0" dy="5" stdDeviation="5" flood-color="#0F172A" flood-opacity="0.15" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="wRing"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#dc)">
    ${inner}
  </g>
</svg>`);
}

// Isometric helper snippets for 3D server/database/cube rendering
const isoCube = (
  cx: number,
  cy: number,
  w: number,
  h: number,
  d: number,
  topFill: string,
  leftFill: string,
  rightFill: string
) => `
  <polygon points="${cx},${cy - d} ${cx + w},${cy - d / 2} ${cx},${cy} ${cx - w},${cy - d / 2}" fill="${topFill}" stroke="#1E293B" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="${cx - w},${cy - d / 2} ${cx},${cy} ${cx},${cy + h} ${cx - w},${cy + h - d / 2}" fill="${leftFill}" stroke="#1E293B" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="${cx + w},${cy - d / 2} ${cx},${cy} ${cx},${cy + h} ${cx + w},${cy + h - d / 2}" fill="${rightFill}" stroke="#1E293B" stroke-width="3" stroke-linejoin="round"/>
`;

const dbCylinder = (
  cx: number,
  topY: number,
  rx: number,
  ry: number,
  height: number,
  bodyFill: string,
  topFill: string
) => `
  <path d="M ${cx - rx} ${topY} V ${topY + height} A ${rx} ${ry} 0 0 0 ${cx + rx} ${topY + height} V ${topY} Z" fill="${bodyFill}" stroke="#1E293B" stroke-width="3.4" stroke-linejoin="round"/>
  <ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="${topFill}" stroke="#1E293B" stroke-width="3.4"/>
  <path d="M ${cx - rx} ${topY + height * 0.5} A ${rx} ${ry} 0 0 0 ${cx + rx} ${topY + height * 0.5}" fill="none" stroke="#1E293B" stroke-width="2.4" opacity="0.55"/>
`;

export const SYSTEM_DESIGN_AND_ATLAS_PACK: CuratedPackSticker[] = [
  // ==========================================================================
  // A. SYSTEM DESIGN: TRAFFIC, NETWORKING & EDGE (14 ITEMS)
  // ==========================================================================
  {
    id: 'sd_load_balancer',
    titleTr: 'Yük Dengeleyici (Load Balancer)',
    titleEn: 'Load Balancer L4/L7',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['yük dengeleyici', 'load balancer', 'trafik dağıtımı', 'l4', 'l7', 'haproxy', 'alb', 'elb', 'ters vekil'],
    tagsEn: ['load balancer', 'traffic distribution', 'round robin', 'alb', 'nginx', 'network'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="24" y="62" width="38" height="36" rx="10" fill="url(#isoTopBlue)" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="43" cy="80" r="8" fill="#E0F2FE" stroke="#1E293B" stroke-width="2.8"/>
      <path d="M62 80 C82 80, 82 42, 104 42" fill="none" stroke="#10B981" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M62 80 L104 80" fill="none" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M62 80 C82 80, 82 118, 104 118" fill="none" stroke="#8B5CF6" stroke-width="4.5" stroke-linecap="round"/>
      <rect x="104" y="28" width="30" height="26" rx="6" fill="#34D399" stroke="#1E293B" stroke-width="3.2"/>
      <rect x="104" y="67" width="30" height="26" rx="6" fill="#FBBF24" stroke="#1E293B" stroke-width="3.2"/>
      <rect x="104" y="106" width="30" height="26" rx="6" fill="#A78BFA" stroke="#1E293B" stroke-width="3.2"/>
      <circle cx="119" cy="41" r="4" fill="#FFFFFF"/><circle cx="119" cy="80" r="4" fill="#FFFFFF"/><circle cx="119" cy="119" r="4" fill="#FFFFFF"/>
    `),
  },
  {
    id: 'sd_api_gateway',
    titleTr: 'API Gateway (Geçit Katmanı)',
    titleEn: 'API Gateway',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['api gateway', 'api geçidi', 'kong', 'apigee', 'yönlendirme', 'endpoint', 'giriş kapısı', 'rest'],
    tagsEn: ['api gateway', 'routing', 'kong', 'ingress', 'endpoint', 'gateway'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="52" y="26" width="56" height="108" rx="14" fill="url(#isoTopViolet)" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="64" y="42" width="32" height="76" rx="8" fill="#EDE9FE" stroke="#1E293B" stroke-width="3"/>
      <path d="M24 80 H52" stroke="#0EA5E9" stroke-width="5.5" stroke-linecap="round"/>
      <polygon points="52,80 42,73 42,87" fill="#0EA5E9"/>
      <path d="M108 52 H136 M108 80 H136 M108 108 H136" stroke="#10B981" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="80" cy="62" r="6" fill="#F59E0B" stroke="#1E293B" stroke-width="2.5"/>
      <circle cx="80" cy="96" r="6" fill="#F43F5E" stroke="#1E293B" stroke-width="2.5"/>
    `),
  },
  {
    id: 'sd_cdn_edge',
    titleTr: 'CDN Kenar Dağıtım Ağı',
    titleEn: 'CDN Edge Network',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['cdn', 'içerik dağıtım ağı', 'cloudflare', 'cloudfront', 'edge', 'statik dosya', 'küresel önbellek'],
    tagsEn: ['cdn', 'content delivery network', 'edge server', 'cloudflare', 'global'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="80" cy="80" r="38" fill="#BAE6FD" stroke="#1E293B" stroke-width="3.8"/>
      <ellipse cx="80" cy="80" rx="18" ry="38" fill="none" stroke="#0284C7" stroke-width="3"/>
      <line x1="42" y1="80" x2="118" y2="80" stroke="#0284C7" stroke-width="3"/>
      <circle cx="34" cy="44" r="11" fill="#F59E0B" stroke="#1E293B" stroke-width="3.2"/>
      <circle cx="126" cy="44" r="11" fill="#10B981" stroke="#1E293B" stroke-width="3.2"/>
      <circle cx="34" cy="118" r="11" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.2"/>
      <circle cx="126" cy="118" r="11" fill="#F43F5E" stroke="#1E293B" stroke-width="3.2"/>
    `),
  },
  {
    id: 'sd_dns_resolver',
    titleTr: 'DNS Alan Adı Çözümleyici',
    titleEn: 'DNS Resolver',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['dns', 'alan adı', 'domain', 'route53', 'ip çözümleme', 'nameserver'],
    tagsEn: ['dns', 'domain name system', 'route53', 'ip lookup', 'nameserver'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="30" y="34" width="100" height="92" rx="16" fill="#FEF3C7" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="42" y="48" width="76" height="24" rx="7" fill="#38BDF8" stroke="#1E293B" stroke-width="3"/>
      <rect x="42" y="86" width="76" height="24" rx="7" fill="#34D399" stroke="#1E293B" stroke-width="3"/>
      <path d="M80 72 V86" stroke="#1E293B" stroke-width="3.8" stroke-linecap="round"/>
      <circle cx="56" cy="60" r="4.5" fill="#FFFFFF"/><circle cx="70" cy="60" r="4.5" fill="#FFFFFF"/>
      <circle cx="56" cy="98" r="4.5" fill="#1E293B"/><circle cx="70" cy="98" r="4.5" fill="#1E293B"/><circle cx="84" cy="98" r="4.5" fill="#1E293B"/>
    `),
  },
  {
    id: 'sd_waf_firewall',
    titleTr: 'WAF & Güvenlik Duvarı',
    titleEn: 'WAF Firewall Shield',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['waf', 'firewall', 'güvenlik duvarı', 'ddos', 'siber güvenlik', 'koruma', 'kalkan', 'filtreleme'],
    tagsEn: ['waf', 'firewall', 'security shield', 'ddos protection', 'cybersecurity'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M80 24 L126 42 V78 C126 108, 104 126, 80 136 C56 126, 34 108, 34 78 V42 Z" fill="url(#isoTopRose)" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <path d="M80 38 L112 50 V76 C112 98, 96 112, 80 120 C64 112, 48 98, 48 76 V50 Z" fill="#FFE4E6" stroke="#1E293B" stroke-width="2.8"/>
      <path d="M66 78 L76 88 L96 66" fill="none" stroke="#059669" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sd_rate_limiter',
    titleTr: 'Hız Sınırlayıcı (Rate Limiter)',
    titleEn: 'Rate Limiter Token Bucket',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['rate limiter', 'hız sınırlayıcı', 'token bucket', 'leaky bucket', 'kota', 'throttling', 'istek sınırı'],
    tagsEn: ['rate limiter', 'throttling', 'token bucket', 'speedometer', 'quota'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M32 106 A48 48 0 1 1 128 106 Z" fill="#FDE68A" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <path d="M44 100 A36 36 0 0 1 116 100" fill="none" stroke="#10B981" stroke-width="8" stroke-linecap="round"/>
      <path d="M96 68 A36 36 0 0 1 116 100" fill="none" stroke="#F43F5E" stroke-width="8" stroke-linecap="round"/>
      <line x1="80" y1="100" x2="104" y2="66" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="80" cy="100" r="9" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.4"/>
    `),
  },
  {
    id: 'sd_reverse_proxy',
    titleTr: 'Ters Vekil Sunucu (Reverse Proxy)',
    titleEn: 'Reverse Proxy Nginx',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['reverse proxy', 'ters vekil', 'nginx', 'envoy', 'haproxy', 'proxy', 'vekil sunucu'],
    tagsEn: ['reverse proxy', 'nginx', 'envoy', 'proxy server', 'forwarding'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="80,26 126,52 126,108 80,134 34,108 34,52" fill="#10B981" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="80,40 112,58 112,102 80,120 48,102 48,58" fill="#D1FAE5"/>
      <path d="M58 80 H98 M86 68 L98 80 L86 92" fill="none" stroke="#065F46" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sd_network_bridge',
    titleTr: 'Ağ Köprüsü & Anahtarlayıcı (Network Bridge)',
    titleEn: 'Network Bridge & Switch',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['köprü', 'ağ köprüsü', 'network bridge', 'switch', 'anahtarlayıcı', 'ethernet', 'lan', 'vlan', 'veri bağı'],
    tagsEn: ['network bridge', 'network switch', 'ethernet bridge', 'layer 2 switch', 'lan'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="24" y="56" width="112" height="48" rx="12" fill="url(#isoTopBlue)" stroke="#1E293B" stroke-width="4"/>
      <rect x="36" y="72" width="14" height="14" rx="3" fill="#FEF08A" stroke="#1E293B" stroke-width="2.6"/>
      <rect x="58" y="72" width="14" height="14" rx="3" fill="#FEF08A" stroke="#1E293B" stroke-width="2.6"/>
      <rect x="80" y="72" width="14" height="14" rx="3" fill="#34D399" stroke="#1E293B" stroke-width="2.6"/>
      <rect x="102" y="72" width="14" height="14" rx="3" fill="#34D399" stroke="#1E293B" stroke-width="2.6"/>
      <path d="M44 40 H112 M100 32 L112 40 L100 48" fill="none" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M116 120 H48 M60 112 L48 120 L60 128" fill="none" stroke="#8B5CF6" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sd_core_router',
    titleTr: 'Yönlendirici (Core Router / NAT)',
    titleEn: 'Core Network Router',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['router', 'yönlendirici', 'nat', 'bgp', 'ospf', 'paket yönlendirme', 'ip ağ'],
    tagsEn: ['router', 'nat gateway', 'bgp', 'packet routing', 'network'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="80" cy="80" r="46" fill="#38BDF8" stroke="#1E293B" stroke-width="4"/>
      <circle cx="80" cy="80" r="34" fill="#E0F2FE"/>
      <path d="M80 50 V70 M80 110 V90 M50 80 H70 M110 80 H90" stroke="#0284C7" stroke-width="5" stroke-linecap="round"/>
      <polygon points="80,44 73,54 87,54" fill="#0284C7"/>
      <polygon points="80,116 73,106 87,106" fill="#0284C7"/>
      <polygon points="44,80 54,73 54,87" fill="#F59E0B"/>
      <polygon points="116,80 106,73 106,87" fill="#10B981"/>
    `),
  },
  {
    id: 'sd_vpc_cloud',
    titleTr: 'Bulut Altyapısı & VPC',
    titleEn: 'VPC Cloud Infrastructure',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['bulut', 'vpc', 'cloud', 'aws', 'gcp', 'azure', 'sanal ağ', 'subnet'],
    tagsEn: ['cloud', 'vpc', 'virtual private cloud', 'aws', 'infrastructure'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M46 112 H116 C132 112, 138 92, 124 82 C126 60, 104 44, 84 52 C72 36, 44 42, 42 64 C24 68, 24 112, 46 112 Z" fill="#BAE6FD" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <rect x="66" y="74" width="28" height="24" rx="6" fill="#F59E0B" stroke="#1E293B" stroke-width="3.2"/>
      <path d="M73 74 V67 A7 7 0 0 1 87 67 V74" fill="none" stroke="#1E293B" stroke-width="3.2"/>
    `),
  },
  {
    id: 'sd_websocket_stream',
    titleTr: 'WebSocket Çift Yönlü Akış',
    titleEn: 'WebSocket Full-Duplex',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['websocket', 'çift yönlü', 'canlı bağlantı', 'gerçek zamanlı', 'socket', 'long polling', 'sse'],
    tagsEn: ['websocket', 'realtime', 'bidirectional', 'full duplex', 'socket'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="28" y="38" width="104" height="84" rx="18" fill="#F3E8FF" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M46 66 H112 M98 54 L112 66 L98 78" fill="none" stroke="#10B981" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M114 96 H48 M62 84 L48 96 L62 108" fill="none" stroke="#8B5CF6" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sd_grpc_graphql',
    titleTr: 'gRPC / GraphQL Servis İletişimi',
    titleEn: 'gRPC & GraphQL Mesh',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['grpc', 'graphql', 'protobuf', 'rpc', 'servis iletişimi', 'rest api', 'http2'],
    tagsEn: ['grpc', 'graphql', 'protobuf', 'rpc', 'api mesh'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="80,26 126,53 126,107 80,134 34,107 34,53" fill="none" stroke="#EC4899" stroke-width="5"/>
      <polygon points="80,38 118,104 42,104" fill="#FCE7F3" stroke="#1E293B" stroke-width="3.4" stroke-linejoin="round"/>
      <circle cx="80" cy="28" r="9" fill="#EC4899" stroke="#1E293B" stroke-width="3"/>
      <circle cx="124" cy="105" r="9" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
      <circle cx="36" cy="105" r="9" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
    `),
  },

  // ==========================================================================
  // B. SYSTEM DESIGN: DATABASES, SHARDING, CACHE & STORAGE (13 ITEMS)
  // ==========================================================================
  {
    id: 'sd_sql_primary',
    titleTr: 'İlişkisel Veritabanı (SQL Primary)',
    titleEn: 'SQL Primary Database',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['veritabanı', 'sql', 'postgresql', 'mysql', 'ilişkisel veritabanı', 'primary db', 'acid', 'tablo'],
    tagsEn: ['sql database', 'postgresql', 'mysql', 'relational database', 'primary db'],
    svgDataUri: wrapMultiColorDieCutSvg(
      dbCylinder(80, 40, 42, 15, 76, '#38BDF8', '#BAE6FD') +
        `<circle cx="104" cy="72" r="5" fill="#FEF08A"/><circle cx="104" cy="98" r="5" fill="#34D399"/>`
    ),
  },
  {
    id: 'sd_db_sharding',
    titleTr: 'Veritabanı Sharding (Yatay Bölümleme)',
    titleEn: 'Database Sharding Cluster',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['veritabanı sharding', 'sharding', 'yatay bölümleme', 'partitioning', 'dağıtık veritabanı', 'consistent hashing'],
    tagsEn: ['database sharding', 'horizontal partitioning', 'sharded cluster', 'distributed database'],
    svgDataUri: wrapMultiColorDieCutSvg(
      dbCylinder(46, 56, 22, 9, 58, '#38BDF8', '#BAE6FD') +
        dbCylinder(80, 38, 22, 9, 58, '#10B981', '#A7F3D0') +
        dbCylinder(114, 56, 22, 9, 58, '#8B5CF6', '#DDD6FE')
    ),
  },
  {
    id: 'sd_read_replica',
    titleTr: 'Okuma Kopyası (Read Replica)',
    titleEn: 'Read Replica Database',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['read replica', 'replikasyon', 'okuma kopyası', 'master slave', 'senkronizasyon', 'yedek veritabanı'],
    tagsEn: ['read replica', 'database replication', 'leader follower', 'sync'],
    svgDataUri: wrapMultiColorDieCutSvg(
      dbCylinder(54, 42, 26, 10, 66, '#0EA5E9', '#BAE6FD') +
        dbCylinder(108, 54, 24, 9, 60, '#34D399', '#A7F3D0') +
        `<path d="M74 68 H94" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>`
    ),
  },
  {
    id: 'sd_redis_cache',
    titleTr: 'Redis Bellek İçi Önbellek (Cache)',
    titleEn: 'Redis In-Memory Cache',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['redis', 'önbellek', 'cache', 'memcached', 'bellek içi', 'in-memory', 'hızlı erişim', 'ttl'],
    tagsEn: ['redis', 'in-memory cache', 'memcached', 'caching', 'fast storage'],
    svgDataUri: wrapMultiColorDieCutSvg(
      isoCube(80, 96, 44, 16, 24, '#FB7185', '#E11D48', '#BE123C') +
        isoCube(80, 74, 44, 16, 24, '#FDA4AF', '#F43F5E', '#E11D48') +
        `<polygon points="86,32 66,64 80,64 74,90 98,54 83,54" fill="#FDE047" stroke="#1E293B" stroke-width="3" stroke-linejoin="round"/>`
    ),
  },
  {
    id: 'sd_nosql_document',
    titleTr: 'NoSQL Belge Veritabanı (MongoDB / Dynamo)',
    titleEn: 'NoSQL Document Store',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['nosql', 'mongodb', 'dynamodb', 'cassandra', 'belge veritabanı', 'json', 'key value'],
    tagsEn: ['nosql', 'mongodb', 'dynamodb', 'document store', 'key value'],
    svgDataUri: wrapMultiColorDieCutSvg(
      dbCylinder(80, 40, 40, 14, 76, '#10B981', '#A7F3D0') +
        `<rect x="64" y="66" width="32" height="36" rx="5" fill="#FEF3C7" stroke="#1E293B" stroke-width="2.8"/>
         <line x1="70" y1="76" x2="90" y2="76" stroke="#1E293B" stroke-width="2.6"/>
         <line x1="70" y1="86" x2="86" y2="86" stroke="#1E293B" stroke-width="2.6"/>`
    ),
  },
  {
    id: 'sd_vector_db',
    titleTr: 'Vektör Veritabanı (pgvector / Embedding)',
    titleEn: 'Vector Database Embedding',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['vektör veritabanı', 'vector db', 'pgvector', 'embedding', 'pinecone', 'milvus', 'anlamsal arama', 'rag'],
    tagsEn: ['vector database', 'embeddings', 'pgvector', 'pinecone', 'similarity search'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="30" y="30" width="100" height="100" rx="22" fill="#EDE9FE" stroke="#1E293B" stroke-width="3.8"/>
      <line x1="48" y1="112" x2="112" y2="48" stroke="#8B5CF6" stroke-width="4.5"/>
      <line x1="48" y1="112" x2="114" y2="92" stroke="#0EA5E9" stroke-width="4.5"/>
      <line x1="48" y1="112" x2="68" y2="46" stroke="#10B981" stroke-width="4.5"/>
      <circle cx="48" cy="112" r="9" fill="#1E293B"/>
      <circle cx="112" cy="48" r="9" fill="#F43F5E" stroke="#1E293B" stroke-width="3"/>
      <circle cx="114" cy="92" r="8" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
      <circle cx="68" cy="46" r="8" fill="#10B981" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'sd_object_storage_s3',
    titleTr: 'Nesne Depolama (S3 Bucket / Blob)',
    titleEn: 'Object Storage S3 Bucket',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['s3', 'nesne depolama', 'object storage', 'blob', 'minio', 'dosya depolama', 'medya cdn'],
    tagsEn: ['s3 bucket', 'object storage', 'blob storage', 'cloud storage'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="38,52 122,52 110,126 50,126" fill="#F59E0B" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <ellipse cx="80" cy="52" rx="42" ry="13" fill="#FDE68A" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M44 52 C44 22, 116 22, 116 52" fill="none" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="72" cy="88" r="9" fill="#38BDF8" stroke="#1E293B" stroke-width="2.8"/>
      <rect x="84" y="80" width="16" height="16" rx="4" fill="#34D399" stroke="#1E293B" stroke-width="2.8"/>
    `),
  },
  {
    id: 'sd_search_elastic',
    titleTr: 'Arama Motoru İndeksi (Elasticsearch)',
    titleEn: 'Full-Text Search Engine',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['elasticsearch', 'arama motoru', 'tam metin arama', 'inverted index', 'algolia', 'typesense'],
    tagsEn: ['elasticsearch', 'search index', 'full text search', 'inverted index'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="72" cy="72" r="34" fill="#A7F3D0" stroke="#1E293B" stroke-width="4.2"/>
      <circle cx="72" cy="72" r="22" fill="#ECFDF5" stroke="#059669" stroke-width="3"/>
      <line x1="97" y1="97" x2="128" y2="128" stroke="#F59E0B" stroke-width="11" stroke-linecap="round"/>
      <line x1="97" y1="97" x2="128" y2="128" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sd_graph_db',
    titleTr: 'Çizge Veritabanı (Graph DB / Neo4j)',
    titleEn: 'Graph Database',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['graph db', 'çizge veritabanı', 'neo4j', 'sosyal ağ grafiği', 'düğüm kenar'],
    tagsEn: ['graph database', 'neo4j', 'nodes and edges', 'knowledge graph'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <line x1="80" y1="40" x2="40" y2="108" stroke="#1E293B" stroke-width="4"/>
      <line x1="80" y1="40" x2="120" y2="108" stroke="#1E293B" stroke-width="4"/>
      <line x1="40" y1="108" x2="120" y2="108" stroke="#1E293B" stroke-width="4"/>
      <circle cx="80" cy="40" r="16" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="40" cy="108" r="16" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="120" cy="108" r="16" fill="#10B981" stroke="#1E293B" stroke-width="3.8"/>
    `),
  },
  {
    id: 'sd_data_warehouse',
    titleTr: 'Veri Ambarı & Data Lake',
    titleEn: 'Data Warehouse & Analytics',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['veri ambarı', 'data warehouse', 'data lake', 'snowflake', 'bigquery', 'olap', 'analitik', 'etl'],
    tagsEn: ['data warehouse', 'data lake', 'bigquery', 'snowflake', 'olap'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="80,26 130,52 130,126 30,126 30,52" fill="#DBEAFE" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <rect x="48" y="88" width="16" height="38" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
      <rect x="72" y="68" width="16" height="58" fill="#10B981" stroke="#1E293B" stroke-width="3"/>
      <rect x="96" y="54" width="16" height="72" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
    `),
  },

  // ==========================================================================
  // C. SYSTEM DESIGN: MICROSERVICES, CONTAINERS & MESSAGING (12 ITEMS)
  // ==========================================================================
  {
    id: 'sd_microservice',
    titleTr: 'Mikroservis Düğümü (Microservice)',
    titleEn: 'Microservice Node',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['mikroservis', 'microservice', 'servis', 'backend', 'uygulama sunucusu', 'auth service', 'order service'],
    tagsEn: ['microservice', 'service pod', 'backend service', 'application node'],
    svgDataUri: wrapMultiColorDieCutSvg(
      isoCube(80, 74, 42, 42, 24, '#38BDF8', '#0284C7', '#0369A1') +
        `<circle cx="80" cy="62" r="8" fill="#FEF08A" stroke="#1E293B" stroke-width="2.6"/>`
    ),
  },
  {
    id: 'sd_kafka_queue',
    titleTr: 'Mesaj Kuyruğu & Olay Akışı (Kafka / RabbitMQ)',
    titleEn: 'Message Queue & Event Stream',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['mesaj kuyruğu', 'kafka', 'rabbitmq', 'sqs', 'kuyruk', 'queue', 'event stream', 'pub sub', 'asenkron'],
    tagsEn: ['message queue', 'kafka', 'rabbitmq', 'event stream', 'pub sub', 'queue'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="22" y="54" width="116" height="52" rx="26" fill="#EDE9FE" stroke="#1E293B" stroke-width="4"/>
      <rect x="36" y="66" width="22" height="28" rx="6" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
      <rect x="69" y="66" width="22" height="28" rx="6" fill="#0EA5E9" stroke="#1E293B" stroke-width="3"/>
      <rect x="102" y="66" width="22" height="28" rx="6" fill="#10B981" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'sd_kubernetes',
    titleTr: 'Kubernetes Kümesi (K8s Pod / Orchestration)',
    titleEn: 'Kubernetes Cluster',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['kubernetes', 'k8s', 'pod', 'konteyner orkestrasyon', 'küme', 'cluster', 'helm', 'autoscaling'],
    tagsEn: ['kubernetes', 'k8s', 'container orchestration', 'cluster', 'pod'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="80,24 124,46 134,94 104,132 56,132 26,94 36,46" fill="#2563EB" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="80" cy="80" r="24" fill="none" stroke="#FFFFFF" stroke-width="5"/>
      <circle cx="80" cy="80" r="8" fill="#FEF08A"/>
      <path d="M80 44 V116 M46 64 L114 96 M46 96 L114 64" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sd_docker_container',
    titleTr: 'Docker Konteyner Paketi',
    titleEn: 'Docker Container',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['docker', 'konteyner', 'container', 'imaj', 'image', 'sanallaştırma'],
    tagsEn: ['docker', 'container', 'shipping container', 'deployment'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M26 86 H130 C130 116, 98 128, 68 126 C40 124, 26 106, 26 86 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8" stroke-linejoin="round"/>
      <rect x="42" y="64" width="20" height="22" rx="3" fill="#BAE6FD" stroke="#1E293B" stroke-width="3"/>
      <rect x="64" y="64" width="20" height="22" rx="3" fill="#38BDF8" stroke="#1E293B" stroke-width="3"/>
      <rect x="86" y="64" width="20" height="22" rx="3" fill="#BAE6FD" stroke="#1E293B" stroke-width="3"/>
      <rect x="64" y="42" width="20" height="22" rx="3" fill="#FBBF24" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'sd_serverless_lambda',
    titleTr: 'Sunucusuz Fonksiyon (Serverless / Lambda)',
    titleEn: 'Serverless Function',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['serverless', 'lambda', 'edge function', 'sunucusuz', 'faas', 'bulut fonksiyon'],
    tagsEn: ['serverless', 'aws lambda', 'edge function', 'cloud function'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="32" y="32" width="96" height="96" rx="22" fill="url(#isoTopAmber)" stroke="#1E293B" stroke-width="4"/>
      <path d="M56 48 L74 48 L104 112 M78 68 L56 112" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sd_worker_cron',
    titleTr: 'Arka Plan İşçisi (Background Worker / Cron)',
    titleEn: 'Background Worker Job',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['worker', 'arka plan işçisi', 'cron', 'zamanlanmış görev', 'job queue', 'celery', 'batch'],
    tagsEn: ['background worker', 'cron job', 'task runner', 'async processor'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="74" cy="84" r="34" fill="#A7F3D0" stroke="#1E293B" stroke-width="4"/>
      <polyline points="74,64 74,84 90,92" fill="none" stroke="#065F46" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="114" cy="48" r="18" fill="#F59E0B" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="114" cy="48" r="6" fill="#FFFFFF"/>
    `),
  },
  {
    id: 'sd_auth_jwt',
    titleTr: 'Kimlik Doğrulama (OAuth2 / JWT / SSO)',
    titleEn: 'Authentication OAuth JWT',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['kimlik doğrulama', 'auth', 'oauth', 'jwt', 'sso', 'şifreleme', 'yetkilendirme', 'kilit', 'anahtar'],
    tagsEn: ['authentication', 'oauth2', 'jwt', 'security lock', 'key'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="44" y="70" width="72" height="58" rx="14" fill="#FBBF24" stroke="#1E293B" stroke-width="4"/>
      <path d="M58 70 V50 A22 22 0 0 1 102 50 V70" fill="none" stroke="#1E293B" stroke-width="7" stroke-linecap="round"/>
      <circle cx="80" cy="94" r="8" fill="#1E293B"/>
      <line x1="80" y1="100" x2="80" y2="114" stroke="#1E293B" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sd_observability',
    titleTr: 'Gözlemlenebilirlik & Metrik (Prometheus / Grafana)',
    titleEn: 'Observability & Metrics',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['observability', 'gözlemlenebilirlik', 'log', 'metrik', 'monitoring', 'izleme', 'prometheus', 'grafana', 'tracing'],
    tagsEn: ['observability', 'monitoring', 'metrics', 'logging', 'dashboard'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="26" y="34" width="108" height="92" rx="14" fill="#1E293B" stroke="#1E293B" stroke-width="3.8"/>
      <polyline points="38,98 60,76 78,88 102,54 122,64" fill="none" stroke="#34D399" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="102" cy="54" r="6" fill="#FBBF24"/>
    `),
  },
  {
    id: 'sd_client_devices',
    titleTr: 'İstemci Cihazlar (Mobil / Web / Masaüstü)',
    titleEn: 'Client Apps Web & Mobile',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['istemci', 'client', 'kullanıcı', 'mobil uygulama', 'web tarayıcı', 'frontend', 'ui'],
    tagsEn: ['client', 'mobile app', 'web browser', 'user device', 'frontend'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="26" y="38" width="84" height="60" rx="10" fill="#E0F2FE" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="52" y="98" width="32" height="10" fill="#94A3B8" stroke="#1E293B" stroke-width="3"/>
      <rect x="96" y="60" width="38" height="66" rx="8" fill="#DDD6FE" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="115" cy="116" r="3" fill="#1E293B"/>
    `),
  },

  // ==========================================================================
  // D. AI, ELECTRONICS, EMBEDDED & HARDWARE ENGINEERING (13 ITEMS)
  // ==========================================================================
  {
    id: 'sd_ai_llm_neural',
    titleTr: 'Yapay Zekâ & Derin Sinir Ağı (LLM / Neural Net)',
    titleEn: 'Neural Network & LLM Engine',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['yapay zeka', 'sinir ağı', 'evrişimli sinir ağı', 'llm', 'transformer', 'derin öğrenme', 'makine öğrenmesi', 'model'],
    tagsEn: ['neural network', 'llm', 'artificial intelligence', 'deep learning', 'transformer'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <line x1="40" y1="44" x2="80" y2="62" stroke="#8B5CF6" stroke-width="4"/>
      <line x1="40" y1="80" x2="80" y2="62" stroke="#0EA5E9" stroke-width="4"/>
      <line x1="40" y1="116" x2="80" y2="98" stroke="#10B981" stroke-width="4"/>
      <line x1="80" y1="62" x2="120" y2="80" stroke="#F43F5E" stroke-width="4.5"/>
      <line x1="80" y1="98" x2="120" y2="80" stroke="#F59E0B" stroke-width="4.5"/>
      <circle cx="40" cy="44" r="11" fill="#38BDF8" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="40" cy="80" r="11" fill="#A78BFA" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="40" cy="116" r="11" fill="#34D399" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="80" cy="62" r="13" fill="#FBBF24" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="80" cy="98" r="13" fill="#FB7185" stroke="#1E293B" stroke-width="3.8"/>
      <circle cx="120" cy="80" r="15" fill="#10B981" stroke="#1E293B" stroke-width="4"/>
    `),
  },
  {
    id: 'sd_gpu_cluster',
    titleTr: 'GPU Hesaplama Kümesi (CUDA / Tensor)',
    titleEn: 'GPU Compute Cluster',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['gpu', 'ekran kartı', 'cuda', 'tensor', 'paralel hesaplama', 'eğitim kümesi'],
    tagsEn: ['gpu cluster', 'graphics card', 'cuda', 'tensor core', 'ai hardware'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="26" y="48" width="108" height="64" rx="12" fill="#10B981" stroke="#1E293B" stroke-width="4"/>
      <circle cx="58" cy="80" r="18" fill="#1E293B"/><circle cx="58" cy="80" r="7" fill="#34D399"/>
      <circle cx="102" cy="80" r="18" fill="#1E293B"/><circle cx="102" cy="80" r="7" fill="#34D399"/>
      <rect x="38" y="112" width="44" height="8" fill="#FBBF24" stroke="#1E293B" stroke-width="2.5"/>
    `),
  },
  {
    id: 'eng_opamp_inverting',
    titleTr: 'Eviren Yükselteç (Op-Amp Devresi)',
    titleEn: 'Operational Amplifier Op-Amp',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['eviren yükselteç', 'op-amp', 'opamp', 'işlemsel yükselteç', 'evirmeyen yükselteç', 'geri besleme', 'kazanç', 'analog elektronik'],
    tagsEn: ['operational amplifier', 'op-amp', 'inverting amplifier', 'feedback circuit', 'analog electronics'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="48,38 48,122 122,80" fill="#BAE6FD" stroke="#1E293B" stroke-width="4.4" stroke-linejoin="round"/>
      <line x1="24" y1="62" x2="48" y2="62" stroke="#F43F5E" stroke-width="5" stroke-linecap="round"/>
      <line x1="24" y1="98" x2="48" y2="98" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
      <line x1="122" y1="80" x2="140" y2="80" stroke="#F59E0B" stroke-width="5.5" stroke-linecap="round"/>
      <polyline points="36,62 36,28 66,28 70,20 78,36 86,20 94,36 98,28 128,28 128,80" fill="none" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="56" y1="62" x2="68" y2="62" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
      <line x1="56" y1="98" x2="68" y2="98" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
      <line x1="62" y1="92" x2="62" y2="104" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'eng_logic_gates',
    titleTr: 'Mantık Kapıları (AND / OR / XOR)',
    titleEn: 'Digital Logic Gates',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['mantık kapıları', 'sayısal tasarım', 'and', 'or', 'xor', 'nand', 'lojik devre', 'boolean', 'fpga'],
    tagsEn: ['logic gates', 'digital circuit', 'boolean algebra', 'and gate', 'xor gate'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M44 40 H78 A30 30 0 0 1 78 100 H44 Z" fill="#FDE68A" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <line x1="24" y1="56" x2="44" y2="56" stroke="#0EA5E9" stroke-width="5" stroke-linecap="round"/>
      <line x1="24" y1="84" x2="44" y2="84" stroke="#8B5CF6" stroke-width="5" stroke-linecap="round"/>
      <circle cx="116" cy="70" r="7" fill="#F43F5E" stroke="#1E293B" stroke-width="3.6"/>
      <line x1="123" y1="70" x2="140" y2="70" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'eng_mcu_arduino',
    titleTr: 'Mikrodenetleyici & Gömülü Sistem (MCU)',
    titleEn: 'Microcontroller Embedded Chip',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['mikrodenetleyici', 'stm32', 'arduino', 'esp32', 'gömülü sistem', 'işlemci', 'cpu', 'adc', 'pwm', 'uart'],
    tagsEn: ['microcontroller', 'arduino', 'stm32', 'microchip', 'embedded system', 'cpu'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="44" y="44" width="72" height="72" rx="12" fill="#059669" stroke="#1E293B" stroke-width="4.2"/>
      <rect x="60" y="60" width="40" height="40" rx="6" fill="#1E293B"/>
      <circle cx="80" cy="80" r="9" fill="#38BDF8"/>
      <path d="M58 28 V44 M80 28 V44 M102 28 V44 M58 116 V132 M80 116 V132 M102 116 V132 M28 58 H44 M28 80 H44 M28 102 H44 M116 58 H132 M116 80 H132 M116 102 H132" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'eng_bms_battery',
    titleTr: 'Lityum Batarya & BMS Güç Yönetimi',
    titleEn: 'Lithium Battery Pack & BMS',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['lityum batarya', 'bms', 'pil', 'batarya yönetimi', 'lipo', 'güç elektroniği', 'şarj', 'enerji depolama'],
    tagsEn: ['lithium battery', 'battery management system', 'bms', 'power pack', 'cell'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="30" y="48" width="92" height="64" rx="12" fill="#ECFDF5" stroke="#1E293B" stroke-width="4.2"/>
      <rect x="122" y="66" width="10" height="28" rx="4" fill="#64748B" stroke="#1E293B" stroke-width="3.4"/>
      <rect x="40" y="58" width="22" height="44" rx="5" fill="#10B981"/>
      <rect x="66" y="58" width="22" height="44" rx="5" fill="#10B981"/>
      <rect x="92" y="58" width="20" height="44" rx="5" fill="#F59E0B"/>
      <polygon points="82,42 66,80 78,80 72,114 96,74 83,74" fill="#FDE047" stroke="#1E293B" stroke-width="2.8" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'eng_iot_sensor_rf',
    titleTr: 'Kablosuz Sensör & RF Anten Modülü',
    titleEn: 'IoT Wireless Sensor & RF',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['sensör', 'kablosuz sensör', 'iot', 'rf', 'anten', 'telemetri', 'lora', 'sdr', 'haberleşme'],
    tagsEn: ['iot sensor', 'wireless antenna', 'rf transceiver', 'telemetry', 'radio wave'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <line x1="80" y1="68" x2="80" y2="128" stroke="#1E293B" stroke-width="6" stroke-linecap="round"/>
      <rect x="58" y="114" width="44" height="18" rx="6" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="80" cy="64" r="10" fill="#F43F5E" stroke="#1E293B" stroke-width="3.6"/>
      <path d="M54 46 A34 34 0 0 1 106 46" fill="none" stroke="#8B5CF6" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M40 34 A52 52 0 0 1 120 34" fill="none" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },

  // ==========================================================================
  // E. MEDICINE & BIOLOGY CORE ATLAS (11 ITEMS)
  // ==========================================================================
  {
    id: 'med_heart_mitral',
    titleTr: 'Kalp Anatomisi & Mitral Kapak',
    titleEn: 'Anatomical Heart & Mitral Valve',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['mitral kapak', 'kalp', 'kardiyoloji', 'aort', 'ventrikül', 'atriyum', 'biküspit', 'miyokard', 'kapakçık'],
    tagsEn: ['mitral valve', 'anatomical heart', 'cardiology', 'heart chambers', 'aorta'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M58 46 C48 26, 72 20, 78 38 L78 52" fill="#38BDF8" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M84 44 C86 22, 112 24, 110 46 L104 58" fill="#FB7185" stroke="#1E293B" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M80 48 C50 42, 34 68, 44 98 C52 122, 76 134, 86 136 C98 132, 122 110, 120 80 C118 56, 98 46, 80 48 Z" fill="#F43F5E" stroke="#1E293B" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M56 68 C66 80, 78 96, 84 126" fill="none" stroke="#FFF1F2" stroke-width="4" stroke-linecap="round"/>
      <path d="M74 78 L90 72 M76 88 L92 84" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_sa_node_ecg',
    titleTr: 'Sinoatriyal Düğüm & Kardiyak İleti (EKG)',
    titleEn: 'Sinoatrial Node & ECG Pacemaker',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['sinoatriyal düğüm', 'sa düğümü', 'av düğümü', 'purkinje', 'his demeti', 'ekg', 'elektrokardiyografi', 'aritmi', 'kalp ritmi'],
    tagsEn: ['sinoatrial node', 'cardiac conduction', 'ecg pulse', 'heartbeat pacemaker'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="24" y="34" width="112" height="92" rx="18" fill="#FFF1F2" stroke="#1E293B" stroke-width="4"/>
      <polyline points="34,84 56,84 64,66 74,106 84,44 94,96 102,84 126,84" fill="none" stroke="#E11D48" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="54" r="9" fill="#FDE047" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'med_neuron_synapse',
    titleTr: 'Nöron & Sinaptik İletim',
    titleEn: 'Neuron & Synapse',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['nöron', 'sinaps', 'nöron sinaps', 'beyin', 'akson', 'dendrit', 'nörotransmitter', 'sinir hücresi', 'aksiyon potansiyeli'],
    tagsEn: ['neuron', 'synapse', 'axon', 'dendrite', 'neuroscience', 'brain cell'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="54" cy="80" r="22" fill="#C084FC" stroke="#1E293B" stroke-width="4"/>
      <circle cx="54" cy="80" r="9" fill="#FEF08A" stroke="#1E293B" stroke-width="2.8"/>
      <path d="M32 80 L20 68 M32 80 L20 92 M44 58 L34 42 M44 102 L34 118" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round"/>
      <path d="M76 80 H116" stroke="#F59E0B" stroke-width="8" stroke-linecap="round"/>
      <path d="M116 80 L134 62 M116 80 L134 98" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="136" cy="62" r="5" fill="#10B981"/><circle cx="136" cy="98" r="5" fill="#10B981"/>
    `),
  },
  {
    id: 'med_kidney_nephron',
    titleTr: 'Böbrek & Nefron Filtrasyonu',
    titleEn: 'Kidney & Nephron Anatomy',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['böbrek', 'nefron', 'böbrek nefron', 'glomerül', 'henle kulpu', 'boşaltım', 'üreter', 'renal'],
    tagsEn: ['kidney', 'nephron', 'renal anatomy', 'glomerulus', 'urology'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M68 34 C34 34, 28 126, 68 126 C88 126, 86 98, 72 88 C62 80, 62 72, 72 64 C86 54, 88 34, 68 34 Z" fill="#E11D48" stroke="#1E293B" stroke-width="4.2"/>
      <path d="M72 74 H106 V128" fill="none" stroke="#FBBF24" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M72 84 H120" fill="none" stroke="#38BDF8" stroke-width="5.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_lungs_alveoli',
    titleTr: 'Akciğerler & Alveol Gaz Değişimi',
    titleEn: 'Lungs & Respiratory System',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['akciğer', 'alveol', 'bronş', 'solunum', 'pulmoner', 'diyafram', 'oksijen'],
    tagsEn: ['lungs', 'alveoli', 'respiratory', 'pulmonary', 'bronchi'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M80 26 V64 M80 54 L62 70 M80 54 L98 70" fill="none" stroke="#0EA5E9" stroke-width="7" stroke-linecap="round"/>
      <path d="M72 48 C44 46, 28 74, 30 112 C32 126, 54 128, 70 118 Z" fill="#FDA4AF" stroke="#1E293B" stroke-width="4.2"/>
      <path d="M88 48 C116 46, 132 74, 130 112 C128 126, 106 128, 90 118 Z" fill="#FB7185" stroke="#1E293B" stroke-width="4.2"/>
    `),
  },
  {
    id: 'med_dna_cell',
    titleTr: 'DNA Çift Sarmal & Genetik',
    titleEn: 'DNA Double Helix',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['dna', 'rna', 'genetik', 'kromozom', 'mutasyon', 'genom', 'replikasyon'],
    tagsEn: ['dna', 'genetics', 'chromosome', 'double helix', 'molecular biology'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M48 28 C108 52, 52 108, 112 132" fill="none" stroke="#0EA5E9" stroke-width="7" stroke-linecap="round"/>
      <path d="M112 28 C52 52, 108 108, 48 132" fill="none" stroke="#F43F5E" stroke-width="7" stroke-linecap="round"/>
      <line x1="60" y1="40" x2="100" y2="40" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="68" y1="58" x2="92" y2="58" stroke="#10B981" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="68" y1="102" x2="92" y2="102" stroke="#8B5CF6" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="60" y1="120" x2="100" y2="120" stroke="#F59E0B" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_stethoscope_clinic',
    titleTr: 'Stetoskop & Klinik Oskültasyon',
    titleEn: 'Stethoscope Auscultation',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['stetoskop', 'oskültasyon', 'muayene', 'klinik', 'üfürüm', 'tanı', 'semptom'],
    tagsEn: ['stethoscope', 'clinical examination', 'doctor', 'auscultation'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M50 34 V66 C50 88, 86 88, 86 66 V34" fill="none" stroke="#0EA5E9" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M68 84 V112 C68 130, 112 130, 112 102" fill="none" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="112" cy="94" r="15" fill="#F59E0B" stroke="#1E293B" stroke-width="4.2"/>
      <circle cx="112" cy="94" r="7" fill="#FEF08A"/>
    `),
  },

  // ==========================================================================
  // F. LAW, JUDICIARY & GOVERNANCE CORE ATLAS (6 ITEMS)
  // ==========================================================================
  {
    id: 'law_istinaf_scales',
    titleTr: 'Adalet Terazisi & İstinaf Denetimi',
    titleEn: 'Scales of Justice Appellate Court',
    discipline: 'law_governance',
    category: 'medical_academic',
    tagsTr: ['istinaf', 'istinaf mahkemesi', 'temyiz', 'yargıtay', 'danıştay', 'adalet', 'terazi', 'kanun yolları', 'hukuk'],
    tagsEn: ['scales of justice', 'appellate court', 'judiciary', 'law', 'balance scale'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="54" y="124" width="52" height="12" rx="6" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
      <line x1="80" y1="32" x2="80" y2="124" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M36 52 Q80 42 124 52" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
      <path d="M26 88 C26 102, 58 102, 58 88 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M102 88 C102 102, 134 102, 134 88 Z" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.8"/>
      <line x1="42" y1="52" x2="30" y2="88" stroke="#1E293B" stroke-width="3"/><line x1="42" y1="52" x2="54" y2="88" stroke="#1E293B" stroke-width="3"/>
      <line x1="118" y1="52" x2="106" y2="88" stroke="#1E293B" stroke-width="3"/><line x1="118" y1="52" x2="130" y2="88" stroke="#1E293B" stroke-width="3"/>
      <circle cx="80" cy="32" r="8" fill="#F43F5E" stroke="#1E293B" stroke-width="3.8"/>
    `),
  },
  {
    id: 'law_judge_gavel',
    titleTr: 'Hakim Tokmağı & Hüküm Kararı',
    titleEn: 'Judge Gavel Verdict',
    discipline: 'law_governance',
    category: 'medical_academic',
    tagsTr: ['hüküm', 'karar', 'bozma', 'onama', 'hakim', 'duruşma', 'ceza mahkemesi', 'tokmak', 'kesin hüküm'],
    tagsEn: ['judge gavel', 'verdict', 'courtroom', 'trial', 'ruling'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <g transform="rotate(-32 80 76)">
        <rect x="54" y="34" width="52" height="26" rx="8" fill="#D97706" stroke="#1E293B" stroke-width="4.2"/>
        <rect x="74" y="60" width="12" height="58" rx="5" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
      </g>
      <ellipse cx="96" cy="126" rx="28" ry="9" fill="#8B5CF6" stroke="#1E293B" stroke-width="4"/>
    `),
  },
  {
    id: 'law_separation_powers',
    titleTr: 'Kuvvetler Ayrılığı (Yasama • Yürütme • Yargı)',
    titleEn: 'Separation of Powers Courthouse',
    discipline: 'law_governance',
    category: 'medical_academic',
    tagsTr: ['kuvvetler ayrılığı', 'yasama', 'yürütme', 'yargı', 'anayasa hukuku', 'parlamento', 'meclis', 'devlet'],
    tagsEn: ['separation of powers', 'courthouse', 'parliament', 'constitutional law', 'pillars'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="80,24 132,52 28,52" fill="#8B5CF6" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <rect x="38" y="52" width="18" height="58" rx="3" fill="#38BDF8" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="71" y="52" width="18" height="58" rx="3" fill="#F59E0B" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="104" y="52" width="18" height="58" rx="3" fill="#10B981" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="26" y="110" width="108" height="16" rx="5" fill="#EDE9FE" stroke="#1E293B" stroke-width="4"/>
    `),
  },
  {
    id: 'law_evidence_discovery',
    titleTr: 'Delil Tespiti & İnceleme Dosyası',
    titleEn: 'Legal Evidence Inspection',
    discipline: 'law_governance',
    category: 'medical_academic',
    tagsTr: ['delil tespiti', 'delil', 'bilirkişi', 'keşif', 'soruşturma', 'tutanak', 'ispat'],
    tagsEn: ['legal evidence', 'magnifying glass document', 'investigation', 'forensic'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="34" y="28" width="74" height="98" rx="10" fill="#FEF3C7" stroke="#1E293B" stroke-width="4"/>
      <line x1="48" y1="50" x2="92" y2="50" stroke="#1E293B" stroke-width="4" stroke-linecap="round"/>
      <line x1="48" y1="66" x2="86" y2="66" stroke="#64748B" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="96" cy="92" r="22" fill="#BAE6FD" stroke="#1E293B" stroke-width="4.2"/>
      <line x1="112" y1="108" x2="130" y2="126" stroke="#F43F5E" stroke-width="8" stroke-linecap="round"/>
    `),
  },
  {
    id: 'law_contract_seal',
    titleTr: 'Sözleşme Hukuku & Mühürlü Belge',
    titleEn: 'Legal Contract & Wax Seal',
    discipline: 'law_governance',
    category: 'medical_academic',
    tagsTr: ['sözleşme hukuku', 'sözleşme', 'borçlar hukuku', 'akit', 'imza', 'mühür', 'noter', 'dilekçe'],
    tagsEn: ['contract', 'legal scroll', 'wax seal', 'agreement', 'law document'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="38" y="26" width="84" height="108" rx="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="4.2"/>
      <line x1="54" y1="48" x2="106" y2="48" stroke="#0EA5E9" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="54" y1="66" x2="106" y2="66" stroke="#94A3B8" stroke-width="3.8" stroke-linecap="round"/>
      <line x1="54" y1="82" x2="90" y2="82" stroke="#94A3B8" stroke-width="3.8" stroke-linecap="round"/>
      <circle cx="98" cy="108" r="14" fill="#E11D48" stroke="#1E293B" stroke-width="3.6"/>
    `),
  },

  // ==========================================================================
  // G. ARCHITECTURE, HISTORY & SCIENCES CORE ATLAS (8 ITEMS)
  // ==========================================================================
  {
    id: 'arch_flying_buttress',
    titleTr: 'Gotik Uçan Payanda & Tonoz İtkisi',
    titleEn: 'Gothic Flying Buttress',
    discipline: 'architecture_civil',
    category: 'medical_academic',
    tagsTr: ['uçan payanda', 'payanda', 'gotik', 'kaburgalı tonoz', 'yanal itki', 'katedral', 'taşıyıcı sistem'],
    tagsEn: ['flying buttress', 'gothic cathedral', 'vault thrust', 'architecture'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="66" y="34" width="48" height="98" rx="4" fill="#FDE68A" stroke="#1E293B" stroke-width="4.2"/>
      <path d="M66 34 L90 16 L114 34 Z" fill="#F59E0B" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <rect x="26" y="64" width="20" height="68" rx="3" fill="#CBD5E1" stroke="#1E293B" stroke-width="4"/>
      <path d="M46 72 Q56 54 66 56 L66 68 Q54 68 46 84 Z" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M46 100 Q56 84 66 86 L66 98 Q54 98 46 112 Z" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M80 96 V68 Q90 52 100 68 V96 Z" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.8"/>
    `),
  },
  {
    id: 'arch_corinthian_column',
    titleTr: 'Korint Sütunu & Klasik Başlık',
    titleEn: 'Corinthian Column Capital',
    discipline: 'architecture_civil',
    category: 'medical_academic',
    tagsTr: ['korint sütunu', 'sütun', 'dor', 'iyon', 'antik mimari', 'başlık', 'kaide', 'klasik mimari'],
    tagsEn: ['corinthian column', 'classical pillar', 'greek temple column', 'capital'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="44" y="26" width="72" height="14" rx="4" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M48 40 C38 52, 54 60, 60 54 H100 C106 60, 122 52, 112 40 Z" fill="#FDE68A" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="58" y="54" width="44" height="66" fill="#F8FAFC" stroke="#1E293B" stroke-width="4"/>
      <line x1="70" y1="58" x2="70" y2="116" stroke="#94A3B8" stroke-width="3"/>
      <line x1="80" y1="58" x2="80" y2="116" stroke="#94A3B8" stroke-width="3"/>
      <line x1="90" y1="58" x2="90" y2="116" stroke="#94A3B8" stroke-width="3"/>
      <rect x="48" y="120" width="64" height="14" rx="4" fill="#CBD5E1" stroke="#1E293B" stroke-width="3.8"/>
    `),
  },
  {
    id: 'arch_geodesic_dome',
    titleTr: 'Jeodezik Kubbe & Uzay Kafes Sistem',
    titleEn: 'Geodesic Dome Structure',
    discipline: 'architecture_civil',
    category: 'medical_academic',
    tagsTr: ['jeodezik kubbe', 'kubbe', 'uzay kafes', 'çelik strüktür', 'kabuk yapı', 'tonoz', 'kemer'],
    tagsEn: ['geodesic dome', 'architectural dome', 'space frame', 'shell structure'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M26 114 A54 54 0 0 1 134 114 Z" fill="#BAE6FD" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <polygon points="80,60 54,90 106,90" fill="#38BDF8" stroke="#1E293B" stroke-width="3" stroke-linejoin="round"/>
      <line x1="80" y1="60" x2="80" y2="114" stroke="#1E293B" stroke-width="3"/>
      <line x1="54" y1="90" x2="36" y2="114" stroke="#1E293B" stroke-width="3"/>
      <line x1="106" y1="90" x2="124" y2="114" stroke="#1E293B" stroke-width="3"/>
      <rect x="22" y="114" width="116" height="12" rx="5" fill="#F59E0B" stroke="#1E293B" stroke-width="3.6"/>
    `),
  },
  {
    id: 'arch_structural_bridge',
    titleTr: 'Asma & Kemer Köprü Yapısı',
    titleEn: 'Architectural Suspension Arch Bridge',
    discipline: 'architecture_civil',
    category: 'medical_academic',
    tagsTr: ['köprü', 'asma köprü', 'taş köprü', 'kemer köprü', 'viyadük', 'açıklık', 'inşaat'],
    tagsEn: ['suspension bridge', 'stone arch bridge', 'civil engineering bridge', 'viaduct'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="44" y="36" width="12" height="84" rx="3" fill="#F43F5E" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="104" y="36" width="12" height="84" rx="3" fill="#F43F5E" stroke="#1E293B" stroke-width="3.6"/>
      <path d="M22 86 Q50 42 50 42 Q80 84 110 42 Q110 42 138 86" fill="none" stroke="#F59E0B" stroke-width="4.2"/>
      <rect x="20" y="88" width="120" height="12" rx="4" fill="#64748B" stroke="#1E293B" stroke-width="3.6"/>
      <path d="M22 120 Q80 110 138 120" fill="none" stroke="#0EA5E9" stroke-width="7" stroke-linecap="round"/>
    `),
  },
  {
    id: 'hist_ottoman_timar',
    titleTr: 'Osmanlı Tımar & İltizam Sistemi',
    titleEn: 'Ottoman Timar Cavalry & Imperial Scroll',
    discipline: 'humanities_social',
    category: 'hand_drawn',
    tagsTr: ['osmanlı tımar', 'osmanlı tımar sistemi', 'tımar', 'iltizam', 'sipahi', 'dirlik', 'ferman', 'hazine', 'osmanlı'],
    tagsEn: ['ottoman empire', 'cavalry shield scroll', 'historical fiefdom', 'imperial decree'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M40 32 H102 C110 32, 112 44, 104 48 L100 116 C100 126, 38 126, 38 116 Z" fill="#FEF3C7" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <circle cx="108" cy="88" r="26" fill="#E11D48" stroke="#1E293B" stroke-width="4"/>
      <circle cx="108" cy="88" r="12" fill="#FBBF24" stroke="#1E293B" stroke-width="3"/>
      <path d="M54 58 Q70 46 84 58" fill="none" stroke="#D97706" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sci_atom_quantum',
    titleTr: 'Atom Yapısı & Kuantum Orbitalleri',
    titleEn: 'Atomic Orbitals & Physics',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    tagsTr: ['atom', 'orbital', 'kuantum', 'elektron', 'fizik', 'kimya', 'çekirdek'],
    tagsEn: ['atom', 'quantum orbital', 'physics', 'chemistry', 'electron'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(30 80 80)" fill="none" stroke="#0EA5E9" stroke-width="4.5"/>
      <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(-30 80 80)" fill="none" stroke="#8B5CF6" stroke-width="4.5"/>
      <ellipse cx="80" cy="80" rx="52" ry="20" transform="rotate(90 80 80)" fill="none" stroke="#10B981" stroke-width="4.5"/>
      <circle cx="80" cy="80" r="13" fill="#F43F5E" stroke="#1E293B" stroke-width="4"/>
    `),
  },
  {
    id: 'econ_supply_demand',
    titleTr: 'Arz-Talep Dengesi & Makroiktisat',
    titleEn: 'Supply and Demand Equilibrium',
    discipline: 'business_economics',
    category: 'medical_academic',
    tagsTr: ['arz talep', 'enflasyon', 'iktisat', 'ekonomi', 'merkez bankası', 'faiz', 'borsa', 'finans'],
    tagsEn: ['supply and demand', 'economics chart', 'inflation', 'finance', 'market'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="30" y="30" width="100" height="100" rx="16" fill="#F8FAFC" stroke="#1E293B" stroke-width="4.2"/>
      <path d="M46 110 L114 48" fill="none" stroke="#10B981" stroke-width="6" stroke-linecap="round"/>
      <path d="M46 48 L114 110" fill="none" stroke="#F43F5E" stroke-width="6" stroke-linecap="round"/>
      <circle cx="80" cy="79" r="9" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
    `),
  },
  {
    id: 'sd_timeseries_db',
    titleTr: 'Zaman Serisi Veritabanı (Time-Series DB)',
    titleEn: 'Time-Series Database InfluxDB',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['zaman serisi', 'time series', 'influxdb', 'timescaledb', 'telemetri veri', 'metrik depo'],
    tagsEn: ['time series database', 'influxdb', 'metrics storage', 'chronological'],
    svgDataUri: wrapMultiColorDieCutSvg(
      dbCylinder(74, 40, 38, 13, 74, '#6366F1', '#C7D2FE') +
        `<circle cx="110" cy="106" r="22" fill="#FEF3C7" stroke="#1E293B" stroke-width="3.6"/>
         <polyline points="110,94 110,106 120,112" fill="none" stroke="#1E293B" stroke-width="3.6" stroke-linecap="round"/>`
    ),
  },
  {
    id: 'sd_pubsub_broker',
    titleTr: 'Pub/Sub Yayın-Abone Dağıtıcı',
    titleEn: 'Pub/Sub Event Broker',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['pub sub', 'yayın abone', 'event broker', 'bildirim dağıtımı', 'fanout', 'sns'],
    tagsEn: ['pub sub', 'publish subscribe', 'event fanout', 'broker'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="44" cy="80" r="18" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
      <line x1="62" y1="72" x2="112" y2="42" stroke="#0EA5E9" stroke-width="4.5"/>
      <line x1="62" y1="80" x2="112" y2="80" stroke="#10B981" stroke-width="4.5"/>
      <line x1="62" y1="88" x2="112" y2="118" stroke="#8B5CF6" stroke-width="4.5"/>
      <circle cx="120" cy="40" r="13" fill="#38BDF8" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="120" cy="80" r="13" fill="#34D399" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="120" cy="120" r="13" fill="#A78BFA" stroke="#1E293B" stroke-width="3.4"/>
    `),
  },
  {
    id: 'sd_circuit_breaker',
    titleTr: 'Devre Kesici & Hata Toleransı (Circuit Breaker)',
    titleEn: 'Circuit Breaker Fault Tolerance',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['circuit breaker', 'devre kesici', 'hata toleransı', 'dayanıklılık', 'resilience', 'failover', 'retry'],
    tagsEn: ['circuit breaker', 'fault tolerance', 'resilience', 'failover', 'switch'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="24" y="44" width="112" height="72" rx="16" fill="#FEE2E2" stroke="#1E293B" stroke-width="3.8"/>
      <line x1="38" y1="88" x2="64" y2="88" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
      <line x1="64" y1="88" x2="96" y2="58" stroke="#E11D48" stroke-width="6" stroke-linecap="round"/>
      <line x1="98" y1="88" x2="122" y2="88" stroke="#1E293B" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="64" cy="88" r="7" fill="#F59E0B" stroke="#1E293B" stroke-width="3"/>
      <circle cx="98" cy="88" r="7" fill="#10B981" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'sd_distributed_lock',
    titleTr: 'Dağıtık Kilit & Konsensüs (ZooKeeper / etcd / Raft)',
    titleEn: 'Distributed Lock & Consensus',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['dağıtık kilit', 'distributed lock', 'zookeeper', 'etcd', 'raft', 'paxos', 'konsensüs', 'kilit'],
    tagsEn: ['distributed lock', 'consensus', 'etcd', 'zookeeper', 'mutex'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="80" cy="80" r="46" fill="#EDE9FE" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="58" y="76" width="44" height="34" rx="8" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.6"/>
      <path d="M66 76 V62 A14 14 0 0 1 94 62 V76" fill="none" stroke="#1E293B" stroke-width="5.5"/>
      <circle cx="80" cy="93" r="5" fill="#FEF08A"/>
    `),
  },
  {
    id: 'sd_service_mesh',
    titleTr: 'Servis Ağı & Sidecar (Service Mesh / Istio)',
    titleEn: 'Service Mesh Sidecar',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['service mesh', 'istio', 'linkerd', 'sidecar', 'mtls', 'servis ağı'],
    tagsEn: ['service mesh', 'istio', 'sidecar proxy', 'mtls', 'network mesh'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="30" y="42" width="64" height="64" rx="14" fill="#38BDF8" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="78" y="66" width="52" height="52" rx="12" fill="#FBBF24" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M62 74 L104 92" stroke="#1E293B" stroke-width="4.5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sd_etl_pipeline',
    titleTr: 'Veri Akış Boru Hattı (ETL / Data Pipeline)',
    titleEn: 'ETL Data Pipeline',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['boru hattı', 'pipeline', 'etl', 'veri işleme', 'airflow', 'spark', 'stream processing'],
    tagsEn: ['data pipeline', 'etl', 'stream processing', 'apache spark', 'funnel'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="34,34 126,34 94,82 94,126 66,114 66,82" fill="#34D399" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="64" cy="50" r="7" fill="#FEF08A"/><circle cx="84" cy="54" r="7" fill="#38BDF8"/><circle cx="98" cy="46" r="6" fill="#FB7185"/>
    `),
  },
  {
    id: 'sd_payment_ledger',
    titleTr: 'Ödeme Geçidi & Finansal Defter (Payment / Ledger)',
    titleEn: 'Payment Gateway & Ledger',
    discipline: 'business_economics',
    category: 'system_arch',
    tagsTr: ['ödeme', 'payment gateway', 'stripe', 'fintech', 'cüzdan', 'bakiye', 'işlem', 'banka'],
    tagsEn: ['payment gateway', 'credit card', 'fintech', 'ledger', 'billing'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="26" y="44" width="108" height="72" rx="14" fill="#0EA5E9" stroke="#1E293B" stroke-width="4"/>
      <rect x="26" y="60" width="108" height="16" fill="#1E293B"/>
      <rect x="40" y="88" width="24" height="16" rx="4" fill="#FBBF24" stroke="#1E293B" stroke-width="2.6"/>
    `),
  },
  {
    id: 'sd_push_notification',
    titleTr: 'Bildirim Servisi (Push / SMS / E-Posta)',
    titleEn: 'Notification Service FCM APNS',
    discipline: 'system_design_cs',
    category: 'system_arch',
    tagsTr: ['bildirim', 'notification', 'push', 'fcm', 'apns', 'sms', 'eposta', 'uyarı'],
    tagsEn: ['push notification', 'bell alert', 'messaging service', 'email'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M80 30 C56 30, 46 52, 46 78 L34 98 H126 L114 78 C114 52, 104 30, 80 30 Z" fill="#FBBF24" stroke="#1E293B" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="80" cy="112" r="12" fill="#F59E0B" stroke="#1E293B" stroke-width="3.6"/>
      <circle cx="110" cy="44" r="14" fill="#F43F5E" stroke="#1E293B" stroke-width="3.4"/>
    `),
  },
  {
    id: 'eng_pcb_circuit',
    titleTr: 'Baskı Devre Kartı (PCB & Donanım)',
    titleEn: 'PCB Printed Circuit Board',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['pcb', 'baskı devre', 'anakart', 'elektronik kart', 'lehim', 'bakır yol', 'donanım tasarım'],
    tagsEn: ['pcb', 'circuit board', 'hardware', 'electronic traces', 'motherboard'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="28" y="28" width="104" height="104" rx="14" fill="#047857" stroke="#1E293B" stroke-width="4"/>
      <path d="M44 48 H74 L92 66 H116 M44 112 H68 L86 94 H116 M64 48 V92" fill="none" stroke="#FDE047" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="44" cy="48" r="6" fill="#FBBF24" stroke="#1E293B" stroke-width="2.6"/>
      <circle cx="116" cy="66" r="6" fill="#FBBF24" stroke="#1E293B" stroke-width="2.6"/>
      <circle cx="44" cy="112" r="6" fill="#FBBF24" stroke="#1E293B" stroke-width="2.6"/>
      <rect x="68" y="68" width="24" height="24" rx="4" fill="#1E293B" stroke="#FFFFFF" stroke-width="2"/>
    `),
  },
  {
    id: 'eng_servo_actuator',
    titleTr: 'Servo Motor & Robotik Eyleyici (Actuator)',
    titleEn: 'Servo Motor & Robotic Actuator',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['servo', 'motor', 'step motor', 'aktuatör', 'eyleyici', 'robot kol', 'mekatronik', 'pid', 'dişli'],
    tagsEn: ['servo motor', 'actuator', 'robotics', 'stepper motor', 'mechanical'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="38" y="54" width="84" height="68" rx="12" fill="#0284C7" stroke="#1E293B" stroke-width="4"/>
      <circle cx="80" cy="54" r="20" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
      <rect x="52" y="34" width="56" height="14" rx="7" fill="#FEF08A" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="80" cy="41" r="4.5" fill="#1E293B"/>
    `),
  },
  {
    id: 'eng_uav_drone',
    titleTr: 'İnsansız Hava Aracı & Otonom İHA (UAV / Drone)',
    titleEn: 'Autonomous UAV Drone',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['iha', 'drone', 'uav', 'quadcopter', 'uçuş kontrol', 'otopilot', 'havacılık', 'telemetri'],
    tagsEn: ['drone', 'uav', 'quadcopter', 'autonomous vehicle', 'aerospace'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <line x1="42" y1="42" x2="118" y2="118" stroke="#1E293B" stroke-width="6" stroke-linecap="round"/>
      <line x1="118" y1="42" x2="42" y2="118" stroke="#1E293B" stroke-width="6" stroke-linecap="round"/>
      <circle cx="38" cy="38" r="16" fill="#BAE6FD" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="122" cy="38" r="16" fill="#BAE6FD" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="38" cy="122" r="16" fill="#BAE6FD" stroke="#1E293B" stroke-width="3.4"/>
      <circle cx="122" cy="122" r="16" fill="#BAE6FD" stroke="#1E293B" stroke-width="3.4"/>
      <rect x="62" y="62" width="36" height="36" rx="10" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
    `),
  },
  {
    id: 'eng_passive_rlc',
    titleTr: 'Direnç, Kondansatör & Bobin (RLC Devresi)',
    titleEn: 'Resistor Capacitor Inductor RLC',
    discipline: 'electronics_robotics',
    category: 'system_arch',
    tagsTr: ['direnç', 'kondansatör', 'bobin', 'indüktör', 'rlc', 'pasif elemanlar', 'filtre', 'empedans', 'ohm'],
    tagsEn: ['resistor', 'capacitor', 'inductor', 'electronic components', 'rlc'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="34" y="42" width="92" height="28" rx="14" fill="#F59E0B" stroke="#1E293B" stroke-width="4"/>
      <rect x="52" y="42" width="10" height="28" fill="#EF4444"/><rect x="74" y="42" width="10" height="28" fill="#8B5CF6"/>
      <rect x="52" y="90" width="14" height="36" rx="4" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.6"/>
      <rect x="94" y="90" width="14" height="36" rx="4" fill="#0EA5E9" stroke="#1E293B" stroke-width="3.6"/>
      <line x1="26" y1="108" x2="52" y2="108" stroke="#1E293B" stroke-width="4.2"/><line x1="108" y1="108" x2="134" y2="108" stroke="#1E293B" stroke-width="4.2"/>
    `),
  },
  {
    id: 'med_microscope_lab',
    titleTr: 'Optik Mikroskop & Laboratuvar İncelemesi',
    titleEn: 'Laboratory Microscope',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['mikroskop', 'laboratuvar', 'histoloji', 'patoloji', 'bakteri', 'mikrobiyoloji', 'hücre inceleme'],
    tagsEn: ['microscope', 'laboratory', 'pathology', 'histology', 'biology'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="36" y="120" width="88" height="14" rx="6" fill="#334155" stroke="#1E293B" stroke-width="3.8"/>
      <path d="M92 46 C118 56, 118 102, 90 120" fill="none" stroke="#0EA5E9" stroke-width="11" stroke-linecap="round"/>
      <rect x="62" y="28" width="18" height="52" rx="5" transform="rotate(-18 71 54)" fill="#F59E0B" stroke="#1E293B" stroke-width="3.8"/>
      <line x1="50" y1="92" x2="96" y2="92" stroke="#1E293B" stroke-width="6" stroke-linecap="round"/>
    `),
  },
  {
    id: 'med_cell_mitochondria',
    titleTr: 'Ökaryot Hücre & Mitokondri Organelleri',
    titleEn: 'Eukaryotic Cell & Mitochondria',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['hücre', 'mitokondri', 'organel', 'çekirdek', 'sitoplazma', 'atp', 'ribozom', 'zar'],
    tagsEn: ['biological cell', 'mitochondria', 'organelle', 'nucleus', 'cytoplasm'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <ellipse cx="80" cy="82" rx="52" ry="42" fill="#6EE7B7" stroke="#1E293B" stroke-width="4.2"/>
      <circle cx="70" cy="78" r="16" fill="#8B5CF6" stroke="#1E293B" stroke-width="3.6"/>
      <ellipse cx="104" cy="74" rx="12" ry="7" transform="rotate(-24 104 74)" fill="#F97316" stroke="#1E293B" stroke-width="3"/>
    `),
  },
  {
    id: 'med_brain_cortex',
    titleTr: 'Beyin Lobları & Merkezi Sinir Sistemi',
    titleEn: 'Human Brain & Cortex',
    discipline: 'medicine_biology',
    category: 'medical_academic',
    tagsTr: ['beyin', 'korteks', 'nöroloji', 'kraniyal sinirler', 'hipokampus', 'serebellum', 'psikoloji', 'bilişsel'],
    tagsEn: ['human brain', 'cerebral cortex', 'neurology', 'psychology', 'mind'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <path d="M52 98 C32 96, 26 74, 38 60 C34 42, 54 30, 74 36 C86 26, 114 32, 118 50 C134 60, 130 88, 112 96 C110 114, 86 118, 76 108 C64 116, 50 110, 52 98 Z" fill="#F472B6" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <path d="M52 64 C66 56, 78 68, 92 58 M48 82 C66 78, 84 88, 106 76" fill="none" stroke="#FCE7F3" stroke-width="3.8" stroke-linecap="round"/>
    `),
  },
  {
    id: 'sci_chemistry_flask',
    titleTr: 'Erlenmayer & Kimyasal Reaksiyon',
    titleEn: 'Chemistry Erlenmeyer Flask',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    tagsTr: ['kimya', 'erlenmayer', 'beher', 'reaksiyon', 'çözelti', 'asit', 'baz', 'titrasyon', 'laboratuvar'],
    tagsEn: ['chemistry flask', 'erlenmeyer', 'chemical reaction', 'beaker', 'science'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <polygon points="66,32 94,32 94,58 126,122 34,122 66,58" fill="#E0F2FE" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
      <polygon points="46,98 114,98 124,120 36,120" fill="#10B981"/>
      <circle cx="74" cy="84" r="6" fill="#34D399"/><circle cx="90" cy="72" r="5" fill="#FBBF24"/>
    `),
  },
  {
    id: 'sci_optical_prism',
    titleTr: 'Optik Prizma & Işık Tayfı',
    titleEn: 'Optical Prism & Light Spectrum',
    discipline: 'exact_sciences',
    category: 'medical_academic',
    tagsTr: ['optik', 'prizma', 'ışık', 'kırılma', 'spektrum', 'dalga boyu', 'foton', 'fizik'],
    tagsEn: ['optical prism', 'light spectrum', 'refraction', 'physics', 'wave'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <line x1="22" y1="88" x2="64" y2="76" stroke="#F59E0B" stroke-width="5" stroke-linecap="round"/>
      <line x1="96" y1="68" x2="138" y2="54" stroke="#EF4444" stroke-width="4.5"/>
      <line x1="98" y1="78" x2="138" y2="78" stroke="#10B981" stroke-width="4.5"/>
      <line x1="100" y1="88" x2="138" y2="102" stroke="#3B82F6" stroke-width="4.5"/>
      <polygon points="80,34 120,118 40,118" fill="#BAE6FD" fill-opacity="0.88" stroke="#1E293B" stroke-width="4.2" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'sci_polar_unit_circle',
    titleTr: 'Birim Çember, Vektör & Karmaşık Düzlem',
    titleEn: 'Polar Coordinates & Unit Circle',
    discipline: 'exact_sciences',
    category: 'diagram',
    tagsTr: ['karmaşık sayılar', 'kutupsal gösterim', 'birim çember', 'vektör', 'kalkülüs', 'türev', 'integral', 'matris', 'matematik'],
    tagsEn: ['unit circle', 'polar coordinates', 'vector', 'mathematics', 'calculus'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <circle cx="80" cy="80" r="46" fill="#EEF2FF" stroke="#1E293B" stroke-width="4"/>
      <line x1="28" y1="80" x2="132" y2="80" stroke="#64748B" stroke-width="3"/>
      <line x1="80" y1="28" x2="80" y2="132" stroke="#64748B" stroke-width="3"/>
      <line x1="80" y1="80" x2="112" y2="48" stroke="#F43F5E" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="112" cy="48" r="7.5" fill="#10B981" stroke="#1E293B" stroke-width="3.2"/>
    `),
  },
  {
    id: 'arch_blueprint_compass',
    titleTr: 'Mimari Plan, Kesit & Pergel',
    titleEn: 'Architectural Blueprint & Compass',
    discipline: 'architecture_civil',
    category: 'medical_academic',
    tagsTr: ['plan', 'kesit', 'rölöve', 'perspektif', 'ölçek', 'gönye', 'pergel', 'mimari proje'],
    tagsEn: ['blueprint', 'architectural plan', 'drafting compass', 'floor plan'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="28" y="36" width="104" height="86" rx="10" fill="#0284C7" stroke="#1E293B" stroke-width="4"/>
      <rect x="42" y="50" width="76" height="58" fill="none" stroke="#E0F2FE" stroke-width="3"/>
      <polygon points="88,70 132,126 88,126" fill="#FBBF24" stroke="#1E293B" stroke-width="3.8" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'hum_books_literature',
    titleTr: 'Akademik Kaynaklar, Edebiyat & Felsefe',
    titleEn: 'Academic Books & Literature',
    discipline: 'humanities_social',
    category: 'hand_drawn',
    tagsTr: ['edebiyat', 'kitap', 'felsefe', 'sosyoloji', 'makale', 'tez', 'kaynakça', 'eğitim'],
    tagsEn: ['books', 'literature', 'philosophy', 'education', 'library'],
    svgDataUri: wrapMultiColorDieCutSvg(`
      <rect x="34" y="92" width="92" height="22" rx="6" fill="#0EA5E9" stroke="#1E293B" stroke-width="4"/>
      <rect x="40" y="68" width="84" height="22" rx="6" fill="#10B981" stroke="#1E293B" stroke-width="4"/>
      <rect x="36" y="44" width="88" height="22" rx="6" fill="#F43F5E" stroke="#1E293B" stroke-width="4"/>
      <path d="M98 44 V62 L106 56 L114 62 V44" fill="#FDE047" stroke="#1E293B" stroke-width="3"/>
    `),
  },
];

export function getPackStickerById(id: string): CuratedPackSticker | undefined {
  return SYSTEM_DESIGN_AND_ATLAS_PACK.find((s) => s.id === id);
}
