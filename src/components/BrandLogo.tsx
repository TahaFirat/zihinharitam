import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-9 w-9 rounded-[13px]',
  md: 'h-11 w-11 rounded-[15px]',
  lg: 'h-14 w-14 rounded-[18px]',
};

/**
 * ZihinHaritam Signature Radiant Mind-Tree Emblem
 * Crafted as a high-contrast squircle app mark that looks unmistakably native
 * on iOS, iPadOS, Android tablets, and desktop screens.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const bgId = `zh-bg-${uid}`;
  const sheenId = `zh-sheen-${uid}`;
  const topBranchId = `zh-top-${uid}`;
  const midBranchId = `zh-mid-${uid}`;
  const botBranchId = `zh-bot-${uid}`;
  const coreId = `zh-core-${uid}`;

  return (
    <div
      data-testid="brand-logo"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden shadow-md ring-1 ring-slate-900/10 dark:ring-white/15 ${SIZE_MAP[size]} ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={bgId} x1="6" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="52%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={sheenId} x1="32" y1="2" x2="32" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={topBranchId} x1="22" y1="31" x2="49" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <linearGradient id={midBranchId} x1="24" y1="32" x2="51" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id={botBranchId} x1="22" y1="33" x2="49" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#FACC15" />
          </linearGradient>
          <radialGradient id={coreId} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </radialGradient>
        </defs>

        {/* Rich Squircle Background */}
        <rect width="64" height="64" rx="16" fill={`url(#${bgId})`} />
        <rect x="2" y="2" width="60" height="28" rx="14" fill={`url(#${sheenId})`} />

        {/* Subtle Orbital Halo Ring */}
        <circle
          cx="22"
          cy="32"
          r="14.5"
          stroke="#38BDF8"
          strokeOpacity="0.18"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* 3 Organic Tapered Mind-Map Branches */}
        <path
          d="M23 29.5 C31 28.5, 34 17, 46 16.5"
          stroke={`url(#${topBranchId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M25 32 C34 32, 39 32, 48.5 32"
          stroke={`url(#${midBranchId})`}
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <path
          d="M23 34.5 C31 35.5, 34 47, 46 47.5"
          stroke={`url(#${botBranchId})`}
          strokeWidth="4.2"
          strokeLinecap="round"
        />

        {/* Branch Leaf Nodes with Specular Dots */}
        <circle cx="47.5" cy="16.5" r="5.5" fill="#22D3EE" />
        <circle cx="46" cy="15" r="1.8" fill="#ECFEFF" fillOpacity="0.85" />

        <circle cx="50" cy="32" r="4.8" fill="#34D399" />
        <circle cx="48.8" cy="30.8" r="1.5" fill="#ECFDF5" fillOpacity="0.85" />

        <circle cx="47.5" cy="47.5" r="5.5" fill="#FBBF24" />
        <circle cx="46" cy="46" r="1.8" fill="#FEFCE8" fillOpacity="0.9" />

        {/* Central Radiant Mind Hub */}
        <circle cx="19.5" cy="32" r="9.2" fill="#38BDF8" fillOpacity="0.22" />
        <circle cx="19.5" cy="32" r="6.8" fill={`url(#${coreId})`} />
        <circle cx="17.6" cy="30.1" r="2.1" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
