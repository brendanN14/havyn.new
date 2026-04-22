import React from 'react';
import { cn } from '../../utils/cn';

export interface GradientBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'havyn' | 'havyn-subtle' | 'havyn-dark' | 'radial' | 'custom';
  animated?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  gradientVia?: string;
  children?: React.ReactNode;
}

export function GradientBackground({
  variant = 'subtle',
  animated = false,
  gradientFrom,
  gradientTo,
  gradientVia,
  className,
  children,
  ...props
}: GradientBackgroundProps) {
  const getGradientClasses = () => {
    if (variant === 'custom' && gradientFrom && gradientTo) {
      const via = gradientVia ? `via-${gradientVia}` : '';
      return `bg-gradient-to-br from-${gradientFrom} ${via} to-${gradientTo}`;
    }
    
    switch (variant) {
      case 'havyn':
        return 'bg-gradient-havyn';
      case 'havyn-subtle':
        return 'bg-gradient-havyn-subtle';
      case 'havyn-dark':
        return 'bg-gradient-havyn-dark';
      case 'radial':
        return 'bg-gradient-radial from-havyn-primary/20 via-transparent to-transparent';
      case 'subtle':
      default:
        return 'bg-gradient-subtle dark:bg-gradient-subtle-dark';
    }
  };

  return (
    <div
      className={cn(
        getGradientClasses(),
        animated && 'animate-gradient-shift bg-[length:200%_200%]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
