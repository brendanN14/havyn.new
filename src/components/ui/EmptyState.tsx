import React from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle } from 'lucide-react';

export interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  description,
  icon,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn('p-12 text-center', className)}>
      {icon ? (
        <div className="flex justify-center mb-4">{icon}</div>
      ) : (
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {message}
      </h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}


