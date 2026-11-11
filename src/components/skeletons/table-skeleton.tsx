import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from '@/components/ui';
import { TABLE_QUERY, type CardRole } from '@/components/common/data-table';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type TableSkeletonProps = {
  columns: Array<{ name: string; width: string; card?: CardRole }>;
  rows?: number;
  showActions?: boolean;
  showRowNumbers?: boolean;
  rowNumberWidth?: string;
  /** Placeholder for one phone card when the page draws its own (DataTable `renderCard`). */
  cardSkeleton?: ReactNode;
};

/**
 * A skeleton loading component that renders a table structure with placeholder content
 * while data is being loaded. Supports customizable columns, row count, optional actions,
 * and row numbering.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  showActions = true,
  showRowNumbers = false,
  rowNumberWidth = 'w-[5%]',
  cardSkeleton,
}: TableSkeletonProps) {
  const showTable = useMediaQuery(TABLE_QUERY);

  if (!showTable) {
    if (cardSkeleton) {
      return (
        <div className='space-y-3'>
          {[...Array(Math.min(rows, 3))].map((_, i) => (
            <div key={i} className='overflow-hidden rounded-xl border bg-card'>
              <div className='p-4'>{cardSkeleton}</div>
              {showActions && (
                <div className='flex items-center justify-between border-t bg-muted/20 px-3 py-2'>
                  <Skeleton className='h-4 w-12' />
                  <div className='flex gap-1'>
                    {[...Array(4)].map((_, j) => (
                      <Skeleton key={j} className='h-8 w-8 rounded-md' />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return <CardSkeletons columns={columns} rows={Math.min(rows, 3)} showActions={showActions} />;
  }

  return (
    <div className='rounded-md overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            {showRowNumbers && <TableHead className={rowNumberWidth}>#</TableHead>}
            {columns.map((column, index) => (
              <TableHead key={index} className={column.width}>
                {column.name}
              </TableHead>
            ))}
            {showActions && <TableHead className='w-[10%] text-center'>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(rows)].map((_, index) => (
            <TableRow key={index}>
              {showRowNumbers && (
                <TableCell>
                  <Skeleton className='h-4 w-4' />
                </TableCell>
              )}
              {columns.map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className='h-4 w-[90%]' />
                </TableCell>
              ))}
              {showActions && (
                <TableCell className='text-center'>
                  <div className='flex justify-center space-x-1'>
                    <Skeleton className='h-8 w-8 rounded-md' />
                    <Skeleton className='h-8 w-8 rounded-md' />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Mirrors the phone cards DataTable renders, using the same column roles. */
function CardSkeletons({
  columns,
  rows,
  showActions,
}: Pick<TableSkeletonProps, 'columns' | 'showActions'> & { rows: number }) {
  const hasTitle = columns.some(c => c.card === 'title');
  const roles = columns.map((c, i) => c.card ?? (i === 0 && !hasTitle ? 'title' : 'field'));
  const count = (role: CardRole) => roles.filter(r => r === role).length;

  return (
    <div className='space-y-3'>
      {[...Array(rows)].map((_, index) => (
        <div key={index} className='overflow-hidden rounded-xl border bg-card'>
          {count('media') > 0 && <Skeleton className='aspect-video w-full rounded-none' />}
          <div className='space-y-3 p-4'>
            <div className='space-y-2'>
              <Skeleton className='h-5 w-2/3' />
              {count('body') > 0 && <Skeleton className='h-4 w-full' />}
            </div>
            {count('meta') > 0 && (
              <div className='flex gap-2'>
                {[...Array(count('meta'))].map((_, i) => (
                  <Skeleton key={i} className='h-5 w-16 rounded-full' />
                ))}
              </div>
            )}
            {[...Array(count('field'))].map((_, i) => (
              <div key={i} className='flex items-center gap-4'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-4 flex-1' />
              </div>
            ))}
          </div>
          {showActions && (
            <div className='flex justify-end gap-1 border-t bg-muted/20 px-3 py-2'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-8 w-8 rounded-md' />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
