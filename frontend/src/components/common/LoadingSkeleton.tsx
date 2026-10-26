import React from 'react';
import { cn } from '../../lib/utils';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-muted/70',
        className
      )}
    />
  );
};
