import { useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Sliders } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { updateScreenTheme } from '@/lib/supabase';
import type { DisplayScreen } from '@/types';
import { Theme } from '@/types';
import { AppRoutes } from '@/constants';

interface ThemeSectionProps {
  screen: DisplayScreen;
  onScreenChange: (screen: DisplayScreen) => void;
}

/**
 * Per-screen background theme picker for the prayer timings display.
 * Saves immediately on selection.
 */
export function ThemeSection({ screen, onScreenChange }: ThemeSectionProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(screen.theme);

  // Themes 1-3 ship a static preview image. The custom theme (theme-4) is
  // per-screen, so it gets a generated gradient swatch + label instead.
  const themeImageMap: Partial<Record<Theme, string>> = {
    [Theme.Theme1]: new URL('@/assets/themes/theme-1/background.jpg', import.meta.url).href,
    [Theme.Theme2]: new URL('@/assets/themes/theme-2/background.jpg', import.meta.url).href,
    [Theme.Theme3]: new URL('@/assets/themes/theme-3/background.png', import.meta.url).href,
  };

  const themeLabels: Record<Theme, string> = {
    [Theme.Theme1]: 'Theme 1',
    [Theme.Theme2]: 'Theme 2',
    [Theme.Theme3]: 'Theme 3',
    [Theme.Theme4]: 'Custom',
  };

  const themeOptions = Object.values(Theme);

  const [prevTheme, setPrevTheme] = useState(screen.theme);
  if (prevTheme !== screen.theme) {
    setPrevTheme(screen.theme);
    setSelectedTheme(screen.theme);
  }

  const handleThemeSelect = async (theme: Theme) => {
    if (theme === selectedTheme) return;

    const previous = selectedTheme;
    try {
      setIsSaving(true);
      setSelectedTheme(theme);
      const updated = await updateScreenTheme(screen.id, theme);
      onScreenChange(updated);
      toast.success('Theme updated successfully');
    } catch (error) {
      console.error('Error updating theme:', error);
      setSelectedTheme(previous);
      toast.error('Failed to update theme');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prayer Timings Display Theme</CardTitle>
        <CardDescription>
          Select a background theme for this screen's prayer timings display. Each screen can have
          its own theme. Your choice is saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex flex-row gap-4'>
            {themeOptions.map(theme => {
              const themeKey = theme as Theme;
              const themeName = themeLabels[themeKey];
              const previewSrc = themeImageMap[themeKey];
              return (
                <button
                  key={themeKey}
                  className={clsx(
                    'border-2 rounded-lg overflow-hidden p-1 transition-all',
                    selectedTheme === themeKey
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-border',
                    isSaving && 'opacity-50 pointer-events-none'
                  )}
                  onClick={() => handleThemeSelect(themeKey)}
                  disabled={isSaving}
                  type='button'
                  aria-label={`Select ${themeName}`}
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt={themeName} className='w-32 h-20 object-cover' />
                  ) : (
                    <div className='w-32 h-20 flex items-center justify-center rounded bg-gradient-to-br from-emerald-700 to-emerald-950 text-white text-xs font-semibold'>
                      Custom
                    </div>
                  )}
                  <div className='mt-2 text-center text-xs font-medium text-foreground truncate w-32 capitalize'>
                    {themeName}
                  </div>
                </button>
              );
            })}
          </div>

          {isSaving && (
            <div className='flex items-center justify-center py-2'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <div className='animate-spin h-4 w-4 border-2 border-muted border-t-foreground rounded-full'></div>
                Saving theme...
              </div>
            </div>
          )}

          {selectedTheme === Theme.Theme4 && (
            <div className='flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4'>
              <div>
                <p className='text-sm font-medium text-foreground'>Custom theme</p>
                <p className='text-xs text-muted-foreground'>
                  Set the background, fonts, sizes and colors for this screen.
                </p>
              </div>
              <Button
                type='button'
                onClick={() => navigate(AppRoutes.ScreenCustomTheme.replace(':id', screen.id))}
              >
                <Sliders className='h-4 w-4 mr-2' />
                Customize
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
