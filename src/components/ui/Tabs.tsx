import React from 'react';
import { cn } from '../../utils/cn';

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <div className={cn('border-b border-gray-200 dark:border-gray-700', className)}>
      <nav className="-mb-px flex space-x-8" role="tablist">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === Tab) {
            return React.cloneElement(child, { active: child.props.value === value, onSelect: onChange });
          }
          return child;
        })}
      </nav>
    </div>
  );
}

export interface TabProps {
  value: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onSelect?: (value: string) => void;
  className?: string;
}

export function Tab({ value, label, icon, active, onSelect, className }: TabProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onSelect?.(value)}
      className={cn(
        'py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2',
        active
          ? 'border-havyn-primary text-havyn-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}



