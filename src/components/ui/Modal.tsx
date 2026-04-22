import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl'
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  className
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'backdrop-blur-sm bg-black/40 dark:bg-black/60',
        'animate-fade-in'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'glass-strong dark:glass-dark-strong',
          'rounded-xl shadow-glass-lg w-full flex flex-col max-h-[90vh]',
          'animate-scale-in',
          sizeStyles[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center p-6 border-b border-white/20 dark:border-gray-700/50">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
            <Button
              variant="icon"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
        {footer && (
          <div className="p-6 border-t border-white/20 dark:border-gray-700/50">{footer}</div>
        )}
      </div>
    </div>
  );
}


