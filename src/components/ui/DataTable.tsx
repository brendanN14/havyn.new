import React from 'react';
import { cn } from '../../utils/cn';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

export interface DataTableColumn {
  key: string;
  label: string;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  stickyHeader?: boolean;
  className?: string;
  onRowClick?: (row: any) => void;
}

export function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  emptyDescription,
  emptyIcon,
  emptyAction,
  stickyHeader = false,
  className,
  onRowClick
}: DataTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        message={emptyMessage}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn('overflow-x-auto border border-gray-200/50 dark:border-gray-700/50 rounded-lg shadow-soft bg-white dark:bg-gray-800/50 backdrop-blur-sm', className)}>
      <table className="min-w-full divide-y divide-gray-200/50 dark:divide-gray-700/50">
        <thead className={cn('bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50', stickyHeader && 'sticky top-0 z-10')}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800/30 divide-y divide-gray-200/30 dark:divide-gray-700/30">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-all duration-200',
                onRowClick && 'cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-700/30 hover:shadow-soft'
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
                    column.className
                  )}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key] || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
