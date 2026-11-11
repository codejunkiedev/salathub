import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ReactNode } from 'react';
import { useRef, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/** Where a column goes on the phone card. */
export type CardRole = 'media' | 'title' | 'body' | 'meta' | 'field' | 'hidden';

export type Column<T> = {
  key: string;
  name: string;
  width: string;
  render?: (value: unknown, item: T) => ReactNode;
  className?: string;
  /**
   * Phone card placement: `media` full width on top, `title` the heading, `body`
   * muted text under it, `meta` unlabelled in one inline row, `field` a labelled
   * row. Defaults to the first column as title and the rest as fields.
   */
  card?: CardRole;
  /** Used instead of `render` on the phone card. */
  renderCard?: (value: unknown, item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  renderActions?: (item: T) => ReactNode;
  actionsWidth?: string;
  showRowNumbers?: boolean;
  rowNumberWidth?: string;
  isDraggable?: boolean;
  onOrderChange?: (items: T[]) => void;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
};

function SortableRow<T>({
  item,
  index,
  columns,
  keyField,
  renderActions,
  showRowNumbers,
  isDraggable,
  rowClassName,
}: {
  item: T;
  index: number;
  columns: Column<T>[];
  keyField: keyof T;
  renderActions?: (item: T) => ReactNode;
  showRowNumbers?: boolean;
  isDraggable?: boolean;
  rowClassName?: (item: T) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(item[keyField]),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const extraClass = rowClassName ? rowClassName(item) : '';

  return (
    <TableRow ref={setNodeRef} style={style} className={`hover:bg-muted/30 ${extraClass}`}>
      {isDraggable && (
        <TableCell className='w-[40px]'>
          <button
            type='button'
            className='cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground'
            {...attributes}
            {...listeners}
          >
            <GripVertical className='h-4 w-4' />
          </button>
        </TableCell>
      )}
      {showRowNumbers && <TableCell className='text-muted-foreground'>{index + 1}</TableCell>}
      {columns.map(column => (
        <TableCell key={column.key}>
          {column.render
            ? column.render(item[column.key as keyof T], item)
            : (item[column.key as keyof T] as ReactNode)}
        </TableCell>
      ))}
      {renderActions && <TableCell>{renderActions(item)}</TableCell>}
    </TableRow>
  );
}

// Below this width rows render as cards: the table would otherwise scroll sideways.
export const TABLE_QUERY = '(min-width: 1024px)';

function renderCell<T>(column: Column<T>, item: T): ReactNode {
  return column.render
    ? column.render(item[column.key as keyof T], item)
    : (item[column.key as keyof T] as ReactNode);
}

type RowCardProps<T> = {
  item: T;
  index: number;
  columns: Column<T>[];
  renderActions?: (item: T) => ReactNode;
  showRowNumbers?: boolean;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  dragHandle?: ReactNode;
};

function RowCard<T>({
  item,
  index,
  columns,
  renderActions,
  showRowNumbers,
  rowClassName,
  onRowClick,
  dragHandle,
}: RowCardProps<T>) {
  const hasTitle = columns.some(c => c.card === 'title');
  const roleOf = (column: Column<T>, i: number): CardRole =>
    column.card ?? (i === 0 && !hasTitle ? 'title' : 'field');
  const byRole = (role: CardRole) => columns.filter((c, i) => roleOf(c, i) === role);
  const cell = (column: Column<T>) =>
    column.renderCard
      ? column.renderCard(item[column.key as keyof T], item)
      : renderCell(column, item);

  const media = byRole('media');
  const title = byRole('title');
  const body = byRole('body');
  const meta = byRole('meta');
  const fields = byRole('field');

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card ${rowClassName ? rowClassName(item) : ''} ${onRowClick ? 'cursor-pointer hover:bg-muted/30' : ''}`}
      onClick={() => onRowClick?.(item)}
    >
      {media.map(column => (
        <div key={column.key} className='border-b bg-muted'>
          {cell(column)}
        </div>
      ))}

      <div className='space-y-3 p-4'>
        <div className='flex items-start gap-2'>
          {dragHandle}
          {showRowNumbers && (
            <span className='pt-0.5 text-sm text-muted-foreground tabular-nums'>{index + 1}.</span>
          )}
          <div className='min-w-0 flex-1 space-y-1'>
            {title.map(column => (
              <div key={column.key} className='font-medium'>
                {cell(column)}
              </div>
            ))}
            {body.map(column => (
              <div key={column.key} className='text-sm text-muted-foreground'>
                {cell(column)}
              </div>
            ))}
          </div>
        </div>

        {meta.length > 0 && (
          <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
            {meta.map(column => (
              <div key={column.key}>{cell(column)}</div>
            ))}
          </div>
        )}

        {fields.length > 0 && (
          <dl className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm'>
            {fields.map(column => (
              <div key={column.key} className='contents'>
                <dt className='text-muted-foreground'>{column.name}</dt>
                <dd className='min-w-0'>{cell(column)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {renderActions && (
        <div
          className='flex justify-end border-t bg-muted/20 px-3 py-2'
          onClick={e => e.stopPropagation()}
        >
          {renderActions(item)}
        </div>
      )}
    </div>
  );
}

function SortableRowCard<T>(props: RowCardProps<T> & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <RowCard
        {...props}
        dragHandle={
          <button
            type='button'
            aria-label='Drag to reorder'
            className='-m-1 cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing'
            {...attributes}
            {...listeners}
          >
            <GripVertical className='h-4 w-4' />
          </button>
        }
      />
    </div>
  );
}

/**
 * A generic data table component with optional drag-and-drop reordering
 */
export function DataTable<T>({
  columns,
  data,
  keyField,
  renderActions,
  actionsWidth = 'w-[10%]',
  showRowNumbers = false,
  rowNumberWidth = 'w-[5%]',
  isDraggable = false,
  onOrderChange,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = data.findIndex(item => String(item[keyField]) === String(active.id));
      const newIndex = data.findIndex(item => String(item[keyField]) === String(over.id));

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(data, oldIndex, newIndex);

      if (onOrderChange) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onOrderChange(reordered);
        }, 100);
      }
    },
    [data, keyField, onOrderChange]
  );

  const showTable = useMediaQuery(TABLE_QUERY);

  if (!showTable) {
    const cards = data.map((item, index) =>
      isDraggable ? (
        <SortableRowCard
          key={String(item[keyField])}
          id={String(item[keyField])}
          item={item}
          index={index}
          columns={columns}
          renderActions={renderActions}
          showRowNumbers={showRowNumbers}
          rowClassName={rowClassName}
        />
      ) : (
        <RowCard
          key={String(item[keyField])}
          item={item}
          index={index}
          columns={columns}
          renderActions={renderActions}
          showRowNumbers={showRowNumbers}
          rowClassName={rowClassName}
          onRowClick={onRowClick}
        />
      )
    );

    return isDraggable ? (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={data.map(item => String(item[keyField]))}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-3'>{cards}</div>
        </SortableContext>
      </DndContext>
    ) : (
      <div className='space-y-3'>{cards}</div>
    );
  }

  const headerContent = (
    <TableHeader>
      <TableRow className='bg-muted/50'>
        {isDraggable && <TableHead className='w-[40px]' />}
        {showRowNumbers && <TableHead className={rowNumberWidth}>#</TableHead>}
        {columns.map(column => (
          <TableHead key={column.key} className={column.width}>
            {column.name}
          </TableHead>
        ))}
        {renderActions && <TableHead className={`${actionsWidth} text-center`}>Actions</TableHead>}
      </TableRow>
    </TableHeader>
  );

  if (isDraggable) {
    return (
      <div className='overflow-x-auto'>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.map(item => String(item[keyField]))}
            strategy={verticalListSortingStrategy}
          >
            <Table>
              {headerContent}
              <TableBody>
                {data.map((item, index) => (
                  <SortableRow
                    key={String(item[keyField])}
                    item={item}
                    index={index}
                    columns={columns}
                    keyField={keyField}
                    renderActions={renderActions}
                    showRowNumbers={showRowNumbers}
                    isDraggable
                    rowClassName={rowClassName}
                  />
                ))}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <div className='overflow-x-auto'>
      <Table>
        {headerContent}
        <TableBody>
          {data.map((item, index) => (
            <TableRow
              key={String(item[keyField])}
              className={`hover:bg-muted/30 ${rowClassName ? rowClassName(item) : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(item)}
            >
              {showRowNumbers && (
                <TableCell className='text-muted-foreground'>{index + 1}</TableCell>
              )}
              {columns.map(column => (
                <TableCell key={column.key}>
                  {column.render
                    ? column.render(item[column.key as keyof T], item)
                    : (item[column.key as keyof T] as ReactNode)}
                </TableCell>
              ))}
              {renderActions && (
                <TableCell onClick={e => e.stopPropagation()}>{renderActions(item)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
