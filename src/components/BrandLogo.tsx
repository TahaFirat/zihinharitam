import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-9 w-9 rounded-[12px]',
  md: 'h-11 w-11 rounded-[14px]',
  lg: 'h-14 w-14 rounded-[18px]',
};

/**
 * ZihinHaritam Official Tactile 3D Mind-Node Brand Emblem.
 * Uses the exact same high-resolution studio icon as iOS AppIcon & Android Launcher.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  return (
    <div
      data-testid="brand-logo"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[#ECEFF3] shadow-md ring-1 ring-slate-900/12 dark:ring-white/20 ${SIZE_MAP[size]} ${className}`}
    >
      <img
        src="/app-icon.png"
        alt="ZihinHaritam"
        draggable={false}
        className="h-full w-full object-cover select-none"
      />
    </div>
  );
};
