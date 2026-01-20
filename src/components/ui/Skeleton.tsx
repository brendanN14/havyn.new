import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded'
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      aria-busy="true"
      aria-live="polite"
    />
  );
}



