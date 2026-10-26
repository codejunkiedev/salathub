import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from '@/utils';
import { buttonVariants } from '@/components/ui';

/**
 * A customizable calendar component with navigation controls and date selection
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn('w-fit', defaults.root),
        months: cn('relative flex flex-col sm:flex-row gap-4', defaults.months),
        month: cn('flex flex-col gap-4', defaults.month),
        nav: cn('absolute inset-x-0 top-0 flex items-center justify-between gap-1', defaults.nav),
        button_previous: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 aria-disabled:opacity-50',
          defaults.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 aria-disabled:opacity-50',
          defaults.button_next
        ),
        month_caption: cn('flex h-8 items-center justify-center px-8', defaults.month_caption),
        caption_label: cn('text-sm font-medium select-none', defaults.caption_label),
        month_grid: cn('w-full border-collapse', defaults.month_grid),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'text-muted-foreground w-8 font-normal text-[0.8rem] select-none',
          defaults.weekday
        ),
        week: cn('flex w-full mt-2', defaults.week),
        day: cn(
          'relative size-8 p-0 text-center text-sm rounded-md focus-within:z-20',
          defaults.day
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 p-0 font-normal aria-selected:opacity-100',
          defaults.day_button
        ),
        selected: cn(
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
          defaults.selected
        ),
        today: cn('[&>button]:bg-accent [&>button]:text-accent-foreground', defaults.today),
        outside: cn('text-muted-foreground', defaults.outside),
        disabled: cn('text-muted-foreground opacity-50', defaults.disabled),
        range_start: cn('bg-accent rounded-l-md', defaults.range_start),
        range_middle: cn('bg-accent rounded-none', defaults.range_middle),
        range_end: cn('bg-accent rounded-r-md', defaults.range_end),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', className)} {...props} />
          ) : (
            <ChevronRight className={cn('size-4', className)} {...props} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
