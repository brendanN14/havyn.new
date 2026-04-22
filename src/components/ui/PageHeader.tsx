import React from 'react';
import { cn } from '../../utils/cn';
import { GradientBackground } from './GradientBackground';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass';
}

export function PageHeader({ title, subtitle, actions, className, variant = 'default' }: PageHeaderProps) {
  const content = (
    <div className={cn('flex justify-between items-center w-full', variant === 'gradient' && 'px-6 py-8 -mx-6 -mt-6 mb-6 rounded-lg', className)}>
      <div>
        <h1 className={cn(
          'text-3xl font-bold',
          variant === 'gradient' ? 'text-white' : 'text-gray-900 dark:text-white'
        )}>
          {title}
        </h1>
        {subtitle && (
          <p className={cn(
            'mt-2 text-sm',
            variant === 'gradient' ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
          )}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">{actions}</div>
      )}
    </div>
  );

  if (variant === 'gradient') {
    return (
      <GradientBackground variant="havyn" className="rounded-lg">
        {content}
      </GradientBackground>
    );
  }

  if (variant === 'glass') {
    return (
      <div className={cn('glass dark:glass-dark rounded-lg p-6 mb-6', className)}>
        {content}
      </div>
    );
  }

  return content;
}


