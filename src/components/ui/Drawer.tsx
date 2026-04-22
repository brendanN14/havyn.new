import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../utils/cn';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'w-96',
  md: 'w-full md:w-2/3 lg:w-1/2',
  lg: 'w-full md:w-4/5 lg:w-2/3',
  xl: 'w-full md:w-5/6 lg:w-3/4',
  full: 'w-full'
};

export function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  side = 'right',
  size = 'md',
  className 
}: DrawerProps) {
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 transition-opacity',
          'backdrop-blur-sm bg-black/40 dark:bg-black/60',
          'animate-fade-in'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 h-full z-50 overflow-y-auto',
          'glass-strong dark:glass-dark-strong shadow-glass-lg',
          'transition-transform duration-300 ease-out',
          side === 'left' 
            ? 'left-0 translate-x-0' 
            : 'right-0 translate-x-0',
          sizeClasses[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 glass dark:glass-dark border-b border-white/20 dark:border-gray-700/50 p-6 z-10 flex items-center justify-between backdrop-blur-md">
            <h2 id="drawer-title" className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <Button
              variant="icon"
              size="sm"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </>
  );
}



