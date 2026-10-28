import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import {
  Canvas,
  ContentPanel,
  DesignPanel,
  type ContentState,
} from '@/components/ayat-hadith-designer';
import { SaveContentButtons } from '@/components/common';
import { useCanvasSnapshot } from '@/hooks';
import { ScreenAssignmentModal } from '@/components/modals';
import { AppRoutes, DEFAULT_STYLE, QURAN_TRANSLATIONS } from '@/constants';
import { getAyatAndHadithById, upsertAyatAndHadith } from '@/lib/supabase';
import type {
  AyatAndHadith,
  AyatHadithCachedText,
  AyatHadithLayerKey,
  AyatHadithStyle,
  AyatSource,
  HadithSource,
  ScreenOrientation,
} from '@/types';
import { formatSlideReference } from '@/utils';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

function makeInitialContentState(initial?: AyatAndHadith | null): ContentState {
  if (!initial) {
    return {
      type: 'ayat',
      surah: 1,
      ayah: 1,
      book: '',
      hadith_number: '',
      showUrdu: true,
      urduEdition: QURAN_TRANSLATIONS.urdu[0].id,
      showEnglish: true,
      englishEdition: QURAN_TRANSLATIONS.english[0].id,
      showReference: true,
    };
  }

  if (initial.type === 'ayat') {
    const src = initial.source as AyatSource;
    return {
      type: 'ayat',
      surah: src.surah,
      ayah: src.ayah,
      book: '',
      hadith_number: '',
      showUrdu: !!initial.cached_text.urdu,
      urduEdition: initial.cached_text.urdu?.edition ?? QURAN_TRANSLATIONS.urdu[0].id,
      showEnglish: !!initial.cached_text.english,
      englishEdition: initial.cached_text.english?.edition ?? QURAN_TRANSLATIONS.english[0].id,
      showReference: !!initial.cached_text.reference,
    };
  }

  const src = initial.source as HadithSource;
  return {
    type: 'hadith',
    surah: 1,
    ayah: 1,
    book: src.book,
    hadith_number: src.hadith_number,
    showUrdu: !!initial.cached_text.urdu,
    urduEdition: 'hadithapi-urdu',
    showEnglish: !!initial.cached_text.english,
    englishEdition: 'hadithapi-english',
    showReference: !!initial.cached_text.reference,
  };
}

export default function AyatHadithDesigner() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = !!params.id;
  const snapshot = useCanvasSnapshot();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const queryOrientation = searchParams.get('orientation');
  const presetOrientation: ScreenOrientation | null =
    queryOrientation === 'landscape' || queryOrientation === 'portrait' ? queryOrientation : null;

  const [initialData, setInitialData] = useState<AyatAndHadith | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loadingInitial = isEdit && loadedId !== params.id;
  const [notFound, setNotFound] = useState(false);

  const [orientation, setOrientation] = useState<ScreenOrientation>(
    presetOrientation ?? 'landscape'
  );
  const [content, setContent] = useState<ContentState>(() => makeInitialContentState(null));
  const [cachedText, setCachedText] = useState<AyatHadithCachedText>({ arabic: '' });
  const [style, setStyle] = useState<AyatHadithStyle>(DEFAULT_STYLE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'design'>('content');
  const [screenAssignTarget, setScreenAssignTarget] = useState<AyatAndHadith | null>(null);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<AyatHadithLayerKey | null>(null);

  // When the user clicks a layer on the canvas, jump to the Design tab so the
  // matching controls become visible immediately.
  const selectLayer = (layer: AyatHadithLayerKey | null) => {
    setSelectedLayer(layer);
    if (layer) setActiveTab('design');
  };

  // Redirect to listing if create mode is missing the orientation query param
  useEffect(() => {
    if (!isEdit && !presetOrientation) {
      navigate(AppRoutes.AyatAndHadith, { replace: true });
    }
  }, [isEdit, presetOrientation, navigate]);

  // Load existing slide in edit mode
  useEffect(() => {
    const id = params.id;
    if (!isEdit || !id) return;
    let cancelled = false;
    getAyatAndHadithById(id)
      .then(slide => {
        if (cancelled) return;
        if (!slide) {
          setNotFound(true);
          return;
        }
        setInitialData(slide);
        setOrientation(slide.orientation);
        setContent(makeInitialContentState(slide));
        setCachedText(slide.cached_text);
        setStyle({
          ...DEFAULT_STYLE,
          ...slide.style,
          arabic: { ...DEFAULT_STYLE.arabic, ...(slide.style.arabic ?? {}) },
          urdu: { ...DEFAULT_STYLE.urdu, ...(slide.style.urdu ?? {}) },
          english: { ...DEFAULT_STYLE.english, ...(slide.style.english ?? {}) },
          reference: { ...DEFAULT_STYLE.reference, ...(slide.style.reference ?? {}) },
          positions: { ...DEFAULT_STYLE.positions, ...(slide.style.positions ?? {}) },
        });
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load slide');
      })
      .finally(() => {
        if (!cancelled) setLoadedId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, params.id]);

  const buildSource = (): AyatSource | HadithSource => {
    if (content.type === 'ayat') {
      return { surah: content.surah, ayah: content.ayah };
    }
    return { book: content.book, hadith_number: content.hadith_number };
  };

  const canSave = (() => {
    if (!cachedText.arabic) return false;
    if (content.type === 'ayat') return content.surah >= 1 && content.ayah >= 1;
    return !!content.book && !!content.hadith_number;
  })();

  const handleCancel = () => navigate(AppRoutes.AyatAndHadith);

  const onSubmit = async (publish = true) => {
    if (!canvasRef.current) {
      setError('Canvas not ready');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      setSnapshotMode(true);
      // Two rAFs: first lets React commit the snapshotMode state, second lets
      // the browser paint the new frame (without selection outlines / handles)
      // before html-to-image samples the DOM.
      await new Promise(r => requestAnimationFrame(() => r(null)));
      await new Promise(r => requestAnimationFrame(() => r(null)));
      const blob = await snapshot(canvasRef.current);
      setSnapshotMode(false);
      const saved = await upsertAyatAndHadith({
        id: initialData?.id,
        type: content.type,
        orientation,
        source: buildSource(),
        cached_text: cachedText,
        style,
        imageBlob: blob,
        previousImagePath: initialData?.image_path,
        publish,
      });
      toast.success(`Slide ${isEdit ? 'updated' : publish ? 'published' : 'saved as draft'}`);
      if (isEdit) {
        navigate(AppRoutes.AyatAndHadith);
      } else {
        setScreenAssignTarget(saved);
      }
    } catch (err) {
      console.error('Error saving slide:', err);
      setError((err as Error).message ?? 'Failed to save slide');
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} slide`);
      setSnapshotMode(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className='container mx-auto py-12 text-center space-y-4'>
        <h1 className='text-2xl font-semibold'>Slide not found</h1>
        <p className='text-muted-foreground'>This slide may have been deleted.</p>
        <Button onClick={handleCancel}>Back to list</Button>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-screen bg-background'>
      <header className='flex items-center justify-between gap-4 px-6 py-4 border-b'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' onClick={handleCancel} aria-label='Back'>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-xl font-semibold'>
              {isEdit ? 'Edit Ayat / Hadith Slide' : 'Create Ayat / Hadith Slide'}
            </h1>
            <p className='text-xs text-muted-foreground capitalize'>Orientation: {orientation}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {error && <span className='text-destructive text-sm'>{error}</span>}
          <Button variant='outline' onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <SaveContentButtons
            isEdit={isEdit}
            isSubmitting={isSubmitting}
            disabled={isFetching || !canSave}
            onSaveDraft={() => onSubmit(false)}
            onSubmit={() => onSubmit()}
          />
        </div>
      </header>

      <div className='flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6'>
        <div className='min-h-[300px] bg-muted rounded-md overflow-hidden'>
          <Canvas
            ref={canvasRef}
            orientation={orientation}
            style={style}
            cachedText={cachedText}
            showUrdu={content.showUrdu}
            showEnglish={content.showEnglish}
            showReference={content.showReference}
            selected={selectedLayer}
            onSelectedChange={selectLayer}
            onPositionsChange={positions => setStyle(prev => ({ ...prev, positions }))}
            snapshotMode={snapshotMode}
          />
        </div>
        <div className='overflow-y-auto pr-2'>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'content' | 'design')}>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='content'>Content</TabsTrigger>
              <TabsTrigger value='design'>Design</TabsTrigger>
            </TabsList>
            <TabsContent value='content' className='pt-4'>
              <ContentPanel
                state={content}
                onChange={setContent}
                onCachedTextChange={setCachedText}
                onFetchingChange={setIsFetching}
              />
            </TabsContent>
            <TabsContent value='design' className='pt-4'>
              <DesignPanel
                style={style}
                onChange={setStyle}
                showUrdu={content.showUrdu}
                showEnglish={content.showEnglish}
                showReference={content.showReference}
                selected={selectedLayer}
                onSelectedChange={selectLayer}
                orientation={orientation}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {screenAssignTarget && (
        <ScreenAssignmentModal
          isOpen={!!screenAssignTarget}
          onClose={() => {
            setScreenAssignTarget(null);
            navigate(AppRoutes.AyatAndHadith);
          }}
          contentId={screenAssignTarget.id}
          isDraft={screenAssignTarget.published_at === null}
          contentType='ayat_and_hadith'
          contentLabel={formatSlideReference(screenAssignTarget)}
          contentOrientation={screenAssignTarget.orientation}
          dismissLabel='Skip'
        />
      )}
    </div>
  );
}
