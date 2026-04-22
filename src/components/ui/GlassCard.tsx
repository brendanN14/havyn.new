import React from 'react';
import { cn } from '../../utils/cn';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'medium' | 'strong';
  children: React.ReactNode;
  hover?: boolean;
}

export function GlassCard({
  variant = 'medium',
  hover = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'subtle':
        return 'glass dark:glass-dark';
      case 'strong':
        return 'glass-strong dark:glass-dark-strong';
      case 'medium':
      default:
        return 'glass dark:glass-dark';
    }
  };

  return (
    <div
      className={cn(
        getVariantClasses(),
        'rounded-lg shadow-glass-sm',
        hover && 'transition-all duration-300 hover:shadow-glass hover:scale-[1.02]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
