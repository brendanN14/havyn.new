import React from 'react';
import { Card, CardBody } from './Card';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  helperText?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, helperText, icon, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
            {helperText && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{helperText}</p>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 ml-4">
              <div className="w-12 h-12 text-gray-400 dark:text-gray-500">
                {icon}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}



