import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center space-x-2 text-sm', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
            {isLast ? (
              <span className="text-gray-900 dark:text-white font-medium">{item.label}</span>
            ) : item.href || item.onClick ? (
              <a
                href={item.href}
                onClick={(e) => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}



