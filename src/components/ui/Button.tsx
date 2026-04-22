import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon' | 'gradient' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-havyn-primary text-white hover:bg-havyn-hover focus:ring-havyn-primary dark:bg-havyn-primary dark:text-white dark:hover:bg-havyn-hover hover:scale-105 active:scale-95',
    secondary: 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500 hover:scale-105 active:scale-95',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500 hover:scale-105 active:scale-95',
    danger: 'bg-status-danger text-white hover:bg-red-700 focus:ring-red-500 hover:scale-105 active:scale-95',
    icon: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500 hover:scale-105 active:scale-95',
    gradient: 'bg-gradient-havyn text-white hover:opacity-90 focus:ring-havyn-primary hover:scale-105 active:scale-95 shadow-soft',
    glass: 'glass dark:glass-dark text-gray-900 dark:text-white hover:glass-strong dark:hover:glass-dark-strong focus:ring-gray-500 hover:scale-105 active:scale-95'
  };

  const sizeStyles = {
    sm: variant === 'icon' ? 'p-1.5' : 'px-3 py-1.5 text-sm',
    md: variant === 'icon' ? 'p-2' : 'px-4 py-2 text-sm',
    lg: variant === 'icon' ? 'p-3' : 'px-6 py-3 text-base'
  };

  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}


