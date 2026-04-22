import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'gradient';
  hover?: boolean;
}

export function Card({ variant = 'default', hover = false, className, children, ...props }: CardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'glass':
        return 'glass dark:glass-dark shadow-glass-sm';
      case 'gradient':
        return 'bg-gradient-havyn-subtle dark:bg-gradient-havyn-dark border-havyn-primary/20';
      case 'default':
      default:
        return 'bg-white dark:bg-gray-800 shadow-soft border border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg transition-all duration-300',
        getVariantClasses(),
        hover && 'hover:shadow-soft-lg hover:scale-[1.02]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('p-6 border-b border-gray-200 dark:border-gray-700', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div
      className={cn('p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('p-6 border-t border-gray-200 dark:border-gray-700', className)}
      {...props}
    >
      {children}
    </div>
  );
}


