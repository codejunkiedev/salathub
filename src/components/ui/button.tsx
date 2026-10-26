import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/utils';
import { buttonVariants } from './button-variants';

/**
 * Button component with multiple variants and sizes, built on Radix UI primitives
 * Supports loading state, asChild composition, and accessibility features
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className='animate-spin h-4 w-4 mr-2' />}
      {props.children}
    </Comp>
  );
}

export { Button };
