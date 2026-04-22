import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

export interface AnimatedContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  animation?: 'fade-in' | 'fade-in-up' | 'slide-up' | 'scale-in';
  delay?: number;
  stagger?: boolean;
  staggerDelay?: number;
  children: React.ReactNode;
}

export function AnimatedContainer({
  animation = 'fade-in-up',
  delay = 0,
  stagger = false,
  staggerDelay = 50,
  className,
  children,
  ...props
}: AnimatedContainerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animationClasses = {
    'fade-in': 'animate-fade-in',
    'fade-in-up': 'animate-fade-in-up',
    'slide-up': 'animate-slide-up',
    'scale-in': 'animate-scale-in',
  };

  if (stagger && React.Children.count(children) > 0) {
    return (
      <div ref={containerRef} className={cn(className)} {...props}>
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              className: cn(
                child.props.className,
                isVisible && animationClasses[animation],
                isVisible && `animate-stagger-${Math.min(index, 5)}`
              ),
              style: {
                ...child.props.style,
                animationDelay: isVisible ? `${index * staggerDelay}ms` : '0ms',
              },
            });
          }
          return child;
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        isVisible && animationClasses[animation],
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
