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
  'unit-occupied': 'bg-gradient-to-r from-status-success-bg to-status-success-bg/80 dark:from-status-success-bg-dark/40 dark:to-status-success-bg-dark/20 text-status-success-text dark:text-status-success-text-dark border border-status-success-text/20',
  'unit-make-ready': 'bg-gradient-to-r from-status-warning-bg to-status-warning-bg/80 dark:from-status-warning-bg-dark/40 dark:to-status-warning-bg-dark/20 text-status-warning-text dark:text-status-warning-text-dark border border-status-warning-text/20',
  'unit-reserved': 'bg-gradient-to-r from-status-info-bg to-status-info-bg/80 dark:from-status-info-bg-dark/40 dark:to-status-info-bg-dark/20 text-status-info-text dark:text-status-info-text-dark border border-status-info-text/20',
  
  // Delinquency category
  'delinquency-current': 'bg-gradient-to-r from-status-success-bg to-status-success-bg/80 dark:from-status-success-bg-dark/40 dark:to-status-success-bg-dark/20 text-status-success-text dark:text-status-success-text-dark border border-status-success-text/20',
  'delinquency-at-risk': 'bg-gradient-to-r from-status-warning-bg to-status-warning-bg/80 dark:from-status-warning-bg-dark/40 dark:to-status-warning-bg-dark/20 text-status-warning-text dark:text-status-warning-text-dark border border-status-warning-text/20',
  'delinquency-delinquent': 'bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-900/20 text-orange-800 dark:text-orange-400 border border-orange-300/30 dark:border-orange-700/30',
  'delinquency-severe': 'bg-gradient-to-r from-status-danger-bg to-status-danger-bg/80 dark:from-status-danger-bg-dark/40 dark:to-status-danger-bg-dark/20 text-status-danger-text dark:text-status-danger-text-dark border border-status-danger-text/20',
  
  // Lease status
  'lease-active': 'bg-gradient-to-r from-status-success-bg to-status-success-bg/80 dark:from-status-success-bg-dark/40 dark:to-status-success-bg-dark/20 text-status-success-text dark:text-status-success-text-dark border border-status-success-text/20',
  'lease-expired': 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  'lease-terminated': 'bg-gradient-to-r from-status-danger-bg to-status-danger-bg/80 dark:from-status-danger-bg-dark/40 dark:to-status-danger-bg-dark/20 text-status-danger-text dark:text-status-danger-text-dark border border-status-danger-text/20',
  
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


