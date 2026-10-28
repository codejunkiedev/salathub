import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { deleteAyatAndHadith, getAyatAndHadith } from '@/lib/supabase';
import type { AyatAndHadith } from '@/types';
import { AppRoutes } from '@/constants';
import { TableSkeleton } from '@/components/skeletons';
import {
  DeleteConfirmationModal,
  OrientationPickerModal,
  ScreenAssignmentModal,
} from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  OrientationBadge,
  PublishStatusBadge,
  type Column,
} from '@/components/common';
import { Badge, Popover, PopoverContent, PopoverTrigger, RemoteImage } from '@/components/ui';
import { BookOpen } from 'lucide-react';
import { useTrigger, usePublishToggle } from '@/hooks';
import { toast } from 'sonner';
import { formatSlideReference } from '@/utils';

const SLIDE_ORIENTATIONS = ['landscape', 'portrait'] as const;

export default function AyatAndHadithPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AyatAndHadith[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AyatAndHadith | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenAssignItem, setScreenAssignItem] = useState<AyatAndHadith | null>(null);
  const [orientationPickerOpen, setOrientationPickerOpen] = useState(false);

  const [trigger, forceUpdate] = useTrigger();
  const togglePublish = usePublishToggle('ayat_and_hadith', forceUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getAyatAndHadith();
        setItems(data);
      } catch (err) {
        setError('Failed to fetch slides');
        toast.error('Failed to fetch slides');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [trigger]);

  const handleAddNew = () => setOrientationPickerOpen(true);

  const handleOrientationContinue = (orientation: 'landscape' | 'portrait') => {
    setOrientationPickerOpen(false);
    navigate(`${AppRoutes.AyatAndHadithNew}?orientation=${orientation}`);
  };

  const handleEdit = (item: AyatAndHadith) =>
    navigate(AppRoutes.AyatAndHadithEdit.replace(':id', item.id));

  const handleDeleteClick = (item: AyatAndHadith) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await deleteAyatAndHadith(itemToDelete.id, itemToDelete.image_path);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('Slide deleted successfully');
    } catch (err) {
      console.error('Error deleting slide:', err);
      setError('Failed to delete slide. Please try again.');
      toast.error('Failed to delete slide, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns: Column<AyatAndHadith>[] = [
    {
      key: 'image_url',
      name: 'Preview',
      width: 'w-[120px]',
      render: value => (
        <Popover>
          <PopoverTrigger asChild>
            <button type='button' className='cursor-zoom-in'>
              <RemoteImage
                src={value as string}
                alt='Slide preview'
                containerClassName='h-14 w-24 rounded border'
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className='p-0 border-0 bg-transparent shadow-none'
            style={{ width: 'auto' }}
            side='right'
            align='start'
            collisionPadding={16}
          >
            <img
              src={value as string}
              alt='Slide enlarged'
              style={{ maxHeight: '60vh', maxWidth: 'min(85vw, 300px)', display: 'block' }}
              className='object-contain rounded-md shadow-lg'
            />
          </PopoverContent>
        </Popover>
      ),
    },
    {
      key: 'id',
      name: 'Reference',
      width: 'w-auto',
      render: (_, item) => <span>{formatSlideReference(item)}</span>,
    },
    {
      key: 'orientation',
      name: 'Orientation',
      width: 'w-[130px]',
      render: value => <OrientationBadge orientation={value as AyatAndHadith['orientation']} />,
    },
    {
      key: 'type',
      name: 'Type',
      width: 'w-[100px]',
      render: value => {
        const type = value as AyatAndHadith['type'];
        return (
          <Badge
            className={
              type === 'ayat'
                ? 'bg-emerald-600 text-white border-transparent'
                : 'bg-indigo-600 text-white border-transparent'
            }
          >
            {type === 'ayat' ? 'Ayat' : 'Hadith'}
          </Badge>
        );
      },
    },
    {
      key: 'published_at',
      name: 'Status',
      width: 'w-[110px]',
      render: value => <PublishStatusBadge published={value !== null} />,
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader
        title='Ayat & Hadith'
        description='Design Ayat and Hadith slides for your displays'
        onAddClick={handleAddNew}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className='h-6 w-6 text-muted-foreground' />}
          title='No slides yet'
          description='Create your first Ayat or Hadith slide to get started.'
          actionText='Create First Slide'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={items}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[14%]'
          renderActions={item => (
            <ActionButtons
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDeleteClick(item)}
              onScreens={() => setScreenAssignItem(item)}
              onTogglePublish={() => togglePublish(item)}
              published={item.published_at !== null}
            />
          )}
        />
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='slide'
        itemTitle={itemToDelete ? formatSlideReference(itemToDelete) : undefined}
      />

      {screenAssignItem && (
        <ScreenAssignmentModal
          isOpen={!!screenAssignItem}
          onClose={() => setScreenAssignItem(null)}
          contentId={screenAssignItem.id}
          isDraft={screenAssignItem.published_at === null}
          contentType='ayat_and_hadith'
          contentLabel={formatSlideReference(screenAssignItem)}
          contentOrientation={screenAssignItem.orientation}
        />
      )}

      <OrientationPickerModal
        open={orientationPickerOpen}
        onOpenChange={setOrientationPickerOpen}
        title='New Ayat / Hadith Slide'
        itemLabel='slide'
        orientations={SLIDE_ORIENTATIONS}
        onSelect={handleOrientationContinue}
      />
    </div>
  );
}
