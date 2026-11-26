import React, { useState, useMemo } from 'react';
import { Map, Minimize2 } from 'lucide-react';
import type { MindNode, ViewportTransform } from '../types/mindmap';
import { useI18n } from '../core/i18n/i18n';

interface MiniMapRadarProps {
  nodes: Record<string, MindNode>;
  rootNodeId: string;
  hiddenNodeIds: Set<string>;
  viewport: ViewportTransform;
  stageWidth: number;
  stageHeight: number;
  isObstructedByBottomBar: boolean;
  onJumpToWorldPoint: (worldX: number, worldY: number) => void;
}

export const MiniMapRadar: React.FC<MiniMapRadarProps> = React.memo(({
  nodes,
  rootNodeId,
  hiddenNodeIds,
  viewport,
  stageWidth,
  stageHeight,
  isObstructedByBottomBar,
  onJumpToWorldPoint,
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const visibleNodes = useMemo(
    () => Object.values(nodes).filter((n) => !hiddenNodeIds.has(n.id)),
    [nodes, hiddenNodeIds]
  );

  const worldBounds = useMemo(() => {
    let minX = -500;
    let maxX = 500;
    let minY = -360;
    let maxY = 360;
    for (const n of visibleNodes) {
      minX = Math.min(minX, n.x - 180);
      maxX = Math.max(maxX, n.x + 180);
      minY = Math.min(minY, n.y - 180);
      maxY = Math.max(maxY, n.y + 180);
    }
    return {
      minX,
      maxX,
      minY,
      maxY,
      w: Math.max(600, maxX - minX),
      h: Math.max(420, maxY - minY),
    };
  }, [visibleNodes]);

  if (isObstructedByBottomBar || visibleNodes.length < 4) {
    return null;
  }

  const radarW = 156;
  const radarH = 102;
  const scale = Math.min(radarW / worldBounds.w, radarH / worldBounds.h);
  const padX = (radarW - worldBounds.w * scale) * 0.5;
  const padY = (radarH - worldBounds.h * scale) * 0.5;

  const toRadar = (wx: number, wy: number) => ({
    rx: padX + (wx - worldBounds.minX) * scale,
    ry: padY + (wy - worldBounds.minY) * scale,
  });

  // Current viewport world rectangle
  const vpWorldLeft = -viewport.x / viewport.scale;
  const vpWorldTop = -viewport.y / viewport.scale;
  const vpWorldW = stageWidth / viewport.scale;
  const vpWorldH = stageHeight / viewport.scale;
  const vpTopLeft = toRadar(vpWorldLeft, vpWorldTop);
  const vpRectW = Math.max(14, vpWorldW * scale);
  const vpRectH = Math.max(10, vpWorldH * scale);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title={t('Harita Radarını Aç', 'Open Minimap Radar')}
        style={{
          backgroundColor: 'var(--hud-bg)',
          borderColor: 'var(--hud-border)',
          bottom: 'max(24px, calc(var(--safe-bottom) + 22px))',
          right: 'calc(var(--safe-right) + 14px)',
        }}
        className="fixed z-20 hidden items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition-transform hover:scale-103 active:scale-95 sm:flex"
      >
        <Map className="h-3.5 w-3.5 text-sky-500" />
        <span>{t('Radar', 'Map')} ({visibleNodes.length})</span>
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--hud-bg)',
        borderColor: 'var(--hud-border)',
        bottom: 'max(24px, calc(var(--safe-bottom) + 22px))',
        right: 'calc(var(--safe-right) + 14px)',
      }}
      className="fixed z-20 hidden flex-col overflow-hidden rounded-2xl border p-2 shadow-xl backdrop-blur-md sm:flex"
    >
      <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-extrabold opacity-70">
        <span>{t('Harita Radarı', 'Minimap Radar')}</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="rounded p-0.5 hover:bg-slate-500/15"
          title={t('Küçült', 'Minimize')}
        >
          <Minimize2 className="h-3 w-3" />
        </button>
      </div>

      <svg
        width={radarW}
        height={radarH}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const worldX = (clickX - padX) / scale + worldBounds.minX;
          const worldY = (clickY - padY) / scale + worldBounds.minY;
          onJumpToWorldPoint(Math.round(worldX), Math.round(worldY));
        }}
        className="cursor-pointer rounded-xl bg-slate-500/5"
      >
        {visibleNodes.map((n) => {
          if (!n.parentId || !nodes[n.parentId]) return null;
          const p = toRadar(nodes[n.parentId].x, nodes[n.parentId].y);
          const c = toRadar(n.x, n.y);
          return (
            <line
              key={`rl_${n.id}`}
              x1={p.rx}
              y1={p.ry}
              x2={c.rx}
              y2={c.ry}
              stroke={n.branchColor}
              strokeWidth={1.3}
              strokeOpacity={0.65}
            />
          );
        })}

        {visibleNodes.map((n) => {
          const pt = toRadar(n.x, n.y);
          const isRoot = n.id === rootNodeId;
          return (
            <circle
              key={`rn_${n.id}`}
              cx={pt.rx}
              cy={pt.ry}
              r={isRoot ? 4 : 2.5}
              fill={n.branchColor}
            />
          );
        })}

        <rect
          x={Math.max(0, Math.min(radarW - 8, vpTopLeft.rx))}
          y={Math.max(0, Math.min(radarH - 8, vpTopLeft.ry))}
          width={Math.min(radarW, vpRectW)}
          height={Math.min(radarH, vpRectH)}
          rx={3}
          fill="rgba(14, 165, 233, 0.12)"
          stroke="#0EA5E9"
          strokeWidth={1.4}
        />
      </svg>
    </div>
  );
});
