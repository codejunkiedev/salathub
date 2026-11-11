'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/utils';

const Tabs = TabsPrimitive.Root;

/**
 * Container for tab triggers. Renders a sliding indicator that smoothly
 * animates between the active triggers. This is the app's one segmented
 * control: style it here, and only pass `w-full` from call sites.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = React.useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false });

  React.useEffect(() => {
    const list = innerRef.current;
    if (!list) return;

    const update = () => {
      const active = list.querySelector('[data-state="active"]') as HTMLElement | null;
      if (!active) {
        setIndicator(prev => ({ ...prev, visible: false }));
        return;
      }
      setIndicator({
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
        visible: true,
      });
    };

    update();

    const mo = new MutationObserver(update);
    mo.observe(list, { attributes: true, subtree: true, attributeFilter: ['data-state'] });

    const ro = new ResizeObserver(update);
    ro.observe(list);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  const setRef = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  return (
    <TabsPrimitive.List
      ref={setRef}
      className={cn(
        'relative inline-flex h-9 items-center justify-center rounded-lg border bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute rounded-md bg-background shadow-sm transition-all duration-300 ease-out',
          indicator.visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          left: indicator.left,
          top: indicator.top,
          width: indicator.width,
          height: indicator.height,
        }}
      />
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

/**
 * Clickable tab button. The active background is provided by the sliding
 * indicator in TabsList, so this only handles text color and focus.
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative z-10 inline-flex h-full flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * Content panel that displays when corresponding tab is active
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
