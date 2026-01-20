import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 
  | 'unit-vacant' 
  | 'unit-occupied' 
  | 'unit-make-ready' 
  | 'unit-reserved'
  | 'delinquency-current'
  | 'delinquency-at-risk'
  | 'delinquency-delinquent'
  | 'delinquency-severe'
  | 'lease-active'
  | 'lease-expired'
  | 'lease-terminated'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  // Unit status
  'unit-vacant': 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  'unit-occupied': 'bg-status-success-bg dark:bg-status-success-bg-dark/30 text-status-success-text dark:text-status-success-text-dark',
  'unit-make-ready': 'bg-status-warning-bg dark:bg-status-warning-bg-dark/30 text-status-warning-text dark:text-status-warning-text-dark',
  'unit-reserved': 'bg-status-info-bg dark:bg-status-info-bg-dark/30 text-status-info-text dark:text-status-info-text-dark',
  
  // Delinquency category
  'delinquency-current': 'bg-status-success-bg dark:bg-status-success-bg-dark/30 text-status-success-text dark:text-status-success-text-dark',
  'delinquency-at-risk': 'bg-status-warning-bg dark:bg-status-warning-bg-dark/30 text-status-warning-text dark:text-status-warning-text-dark',
  'delinquency-delinquent': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
  'delinquency-severe': 'bg-status-danger-bg dark:bg-status-danger-bg-dark/30 text-status-danger-text dark:text-status-danger-text-dark',
  
  // Lease status
  'lease-active': 'bg-status-success-bg dark:bg-status-success-bg-dark/30 text-status-success-text dark:text-status-success-text-dark',
  'lease-expired': 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  'lease-terminated': 'bg-status-danger-bg dark:bg-status-danger-bg-dark/30 text-status-danger-text dark:text-status-danger-text-dark',
  
  // Neutral
  'neutral': 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
};

export function Badge({ variant, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// Helper to map category strings to badge variants
export function getDelinquencyBadgeVariant(category: string): BadgeVariant {
  if (category === 'current') return 'delinquency-current';
  if (category === 'at_risk') return 'delinquency-at-risk';
  if (category === 'delinquent') return 'delinquency-delinquent';
  if (category === 'severe_delinquent') return 'delinquency-severe';
  return 'neutral';
}

export function getUnitStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'vacant') return 'unit-vacant';
  if (status === 'occupied') return 'unit-occupied';
  if (status === 'make-ready') return 'unit-make-ready';
  if (status === 'reserved') return 'unit-reserved';
  return 'neutral';
}

export function getLeaseStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'active') return 'lease-active';
  if (status === 'expired') return 'lease-expired';
  if (status === 'terminated') return 'lease-terminated';
  return 'neutral';
}


