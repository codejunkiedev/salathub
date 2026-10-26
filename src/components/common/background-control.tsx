import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ColorInput, Label, Slider, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import {
  DEFAULT_CUSTOM_COLOR,
  DEFAULT_GRADIENT_ANGLE,
  DEFAULT_GRADIENT_FROM,
  DEFAULT_GRADIENT_TO,
} from '@/constants';
import { gradientCss } from '@/helpers';
import { useBackgroundImages, useUserBackgrounds } from '@/hooks';
import { deleteUserBackground } from '@/lib/supabase';
import {
  SupabaseBuckets,
  SupabaseFolders,
  type AyatHadithBackground,
  type BackgroundImage,
  type PostOrientation,
} from '@/types';
import { ImageTile } from './image-tile';
import { BackgroundUploadTile } from './background-upload-tile';

export interface BackgroundOverlay {
  enabled: boolean;
  color: string;
  opacity: number;
}

interface BackgroundControlProps {
  background: AyatHadithBackground;
  onBackgroundChange: (background: AyatHadithBackground) => void;
  overlay: BackgroundOverlay;
  onOverlayChange: (overlay: BackgroundOverlay) => void;
  /**
   * Enables the user-upload image source (Library/Upload sub-tabs). Uploads are
   * validated against this orientation. Omit for a library-only picker.
   */
  uploadOrientation?: PostOrientation;
}

const GRID = 'grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1';

/**
 * Background (image / color / gradient) + overlay editor shared by the custom
 * prayer theme and the Ayat/Hadith slide builder. Background is stored as an
 * {@link AyatHadithBackground}; the overlay shape is normalized by callers.
 */
export function BackgroundControl({
  background: bg,
  onBackgroundChange,
  overlay,
  onOverlayChange,
  uploadOrientation,
}: BackgroundControlProps) {
  const overlayId = useId();
  const library = useBackgroundImages();

  const colorValue = bg.type === 'color' ? bg.color : DEFAULT_CUSTOM_COLOR;
  const gradientFrom = bg.type === 'gradient' ? bg.from : DEFAULT_GRADIENT_FROM;
  const gradientTo = bg.type === 'gradient' ? bg.to : DEFAULT_GRADIENT_TO;
  const gradientAngle = bg.type === 'gradient' ? bg.angle : DEFAULT_GRADIENT_ANGLE;

  const selectImage = (url: string) => onBackgroundChange({ type: 'image', url });

  return (
    <>
      <section className='space-y-3'>
        <Label className='text-sm font-semibold'>Background</Label>
        <Tabs
          value={bg.type}
          onValueChange={v => {
            const t = v as AyatHadithBackground['type'];
            if (t === bg.type) return;
            if (t === 'image') {
              selectImage((bg.type === 'image' && bg.url) || library.images[0]?.url || '');
            } else if (t === 'color') {
              onBackgroundChange({ type: 'color', color: colorValue });
            } else {
              onBackgroundChange({
                type: 'gradient',
                from: gradientFrom,
                to: gradientTo,
                angle: gradientAngle,
              });
            }
          }}
        >
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='image'>Image</TabsTrigger>
            <TabsTrigger value='color'>Color</TabsTrigger>
            <TabsTrigger value='gradient'>Gradient</TabsTrigger>
          </TabsList>
        </Tabs>

        {bg.type === 'image' &&
          (uploadOrientation ? (
            <UploadableImagePicker
              library={library}
              selectedUrl={bg.url}
              onSelect={selectImage}
              orientation={uploadOrientation}
            />
          ) : (
            <LibraryGrid library={library} selectedUrl={bg.url} onSelect={selectImage} />
          ))}

        {bg.type === 'color' && (
          <div className='space-y-2'>
            <div
              className='w-full aspect-[3/1] rounded border'
              style={{ backgroundColor: colorValue }}
            />
            <ColorInput
              value={colorValue}
              onChange={v => onBackgroundChange({ type: 'color', color: v })}
              className='h-9 w-full p-1'
            />
          </div>
        )}

        {bg.type === 'gradient' && (
          <div className='space-y-2'>
            <div
              className='w-full aspect-[3/1] rounded border'
              style={{ backgroundImage: gradientCss(gradientFrom, gradientTo, gradientAngle) }}
            />
            <div className='flex items-center gap-3'>
              <div className='space-y-1 flex-1'>
                <Label className='text-[10px] text-muted-foreground uppercase tracking-wide'>
                  From
                </Label>
                <ColorInput
                  value={gradientFrom}
                  onChange={v =>
                    onBackgroundChange({
                      type: 'gradient',
                      from: v,
                      to: gradientTo,
                      angle: gradientAngle,
                    })
                  }
                  className='h-9 w-full p-1'
                />
              </div>
              <div className='space-y-1 flex-1'>
                <Label className='text-[10px] text-muted-foreground uppercase tracking-wide'>
                  To
                </Label>
                <ColorInput
                  value={gradientTo}
                  onChange={v =>
                    onBackgroundChange({
                      type: 'gradient',
                      from: gradientFrom,
                      to: v,
                      angle: gradientAngle,
                    })
                  }
                  className='h-9 w-full p-1'
                />
              </div>
            </div>
            <Label className='text-[10px] text-muted-foreground uppercase tracking-wide'>
              Angle: {gradientAngle}°
            </Label>
            <Slider
              min={0}
              max={360}
              step={1}
              value={[gradientAngle]}
              onValueChange={v =>
                onBackgroundChange({
                  type: 'gradient',
                  from: gradientFrom,
                  to: gradientTo,
                  angle: v[0],
                })
              }
            />
          </div>
        )}
      </section>

      <section className='space-y-3'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-semibold'>Overlay</Label>
          <div className='flex items-center gap-2'>
            <Label htmlFor={overlayId} className='text-xs text-muted-foreground cursor-pointer'>
              Show
            </Label>
            <Switch
              id={overlayId}
              checked={overlay.enabled}
              onCheckedChange={enabled => onOverlayChange({ ...overlay, enabled })}
            />
          </div>
        </div>
        {overlay.enabled && (
          <>
            <ColorInput
              value={overlay.color}
              onChange={color => onOverlayChange({ ...overlay, color })}
              className='h-9 w-full p-1'
            />
            <Label className='text-xs text-muted-foreground'>
              Opacity: {Math.round(overlay.opacity * 100)}%
            </Label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[overlay.opacity * 100]}
              onValueChange={v => onOverlayChange({ ...overlay, opacity: v[0] / 100 })}
            />
          </>
        )}
      </section>
    </>
  );
}

type Library = ReturnType<typeof useBackgroundImages>;

interface LibraryGridProps {
  library: Library;
  selectedUrl: string;
  onSelect: (url: string) => void;
}

function LibraryGrid({ library, selectedUrl, onSelect }: LibraryGridProps) {
  const { images, loading, error } = library;
  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='aspect-video rounded bg-muted animate-pulse' />
        ))}
      </div>
    );
  }
  if (error) return <p className='text-xs text-destructive'>{error}</p>;
  if (images.length === 0) {
    return (
      <p className='text-xs text-muted-foreground'>
        No images available. Upload images to the{' '}
        <span className='font-mono'>{SupabaseFolders.AyatHadithBackgrounds}</span> folder in the{' '}
        <span className='font-mono'>{SupabaseBuckets.Assets}</span> bucket.
      </p>
    );
  }
  return (
    <div className={GRID}>
      {images.map(img => (
        <ImageTile
          key={img.url}
          image={img}
          selected={selectedUrl === img.url}
          onSelect={() => onSelect(img.url)}
        />
      ))}
    </div>
  );
}

interface UploadableImagePickerProps {
  library: Library;
  selectedUrl: string;
  onSelect: (url: string) => void;
  orientation: PostOrientation;
}

function UploadableImagePicker({
  library,
  selectedUrl,
  onSelect,
  orientation,
}: UploadableImagePickerProps) {
  const { images: userImages, loading, error, refetch } = useUserBackgrounds();
  // Open on the Upload tab if the saved image is one of the masjid's uploads.
  const [pickedSource, setPickedSource] = useState<'library' | 'upload' | null>(null);
  if (pickedSource === null && !loading) {
    setPickedSource(
      selectedUrl && userImages.some(img => img.url === selectedUrl) ? 'upload' : 'library'
    );
  }
  const source = pickedSource ?? 'library';

  const handleDelete = async (image: BackgroundImage) => {
    try {
      await deleteUserBackground(image.name);
      // If the deleted image was selected, fall back to the first library image.
      if (selectedUrl === image.url) onSelect(library.images[0]?.url || '');
      await refetch();
      toast.success('Image deleted');
    } catch (err) {
      console.error('Failed to delete background:', err);
      toast.error('Failed to delete image');
    }
  };

  return (
    <div className='space-y-3'>
      <Tabs value={source} onValueChange={v => setPickedSource(v as 'library' | 'upload')}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='library'>Library</TabsTrigger>
          <TabsTrigger value='upload'>Upload</TabsTrigger>
        </TabsList>
      </Tabs>

      {source === 'library' && (
        <LibraryGrid library={library} selectedUrl={selectedUrl} onSelect={onSelect} />
      )}

      {source === 'upload' && (
        <div className='space-y-2'>
          {error && <p className='text-xs text-destructive'>{error}</p>}
          <div className={GRID}>
            <BackgroundUploadTile
              orientation={orientation}
              onUploaded={async url => {
                await refetch();
                onSelect(url);
              }}
            />
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className='aspect-video rounded bg-muted animate-pulse' />
                ))
              : userImages.map(img => (
                  <ImageTile
                    key={img.url}
                    image={img}
                    selected={selectedUrl === img.url}
                    onSelect={() => onSelect(img.url)}
                    onDelete={() => handleDelete(img)}
                  />
                ))}
          </div>
          <p className='text-[10px] text-muted-foreground'>
            Images are validated for {orientation === 'portrait' ? '9:16' : '16:9'} and must be
            under 5MB.
          </p>
        </div>
      )}
    </div>
  );
}
