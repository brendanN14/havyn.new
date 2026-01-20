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
    <div className={cn('overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className={cn('bg-gray-50 dark:bg-gray-900', stickyHeader && 'sticky top-0 z-10')}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
                  column.className
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={cn(
                onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white',
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
