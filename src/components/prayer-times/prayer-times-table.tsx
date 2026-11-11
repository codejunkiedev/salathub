import { useState } from 'react';
import {
  applySingleAdjustment,
  isFriday,
  getCurrentDay,
  getAdjustedPrayerTime,
  getIshraqTime,
  getChashtTime,
} from '@/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import type {
  AdjustmentCategory,
  AlAdhanPrayerTimes,
  PrayerAdjustments,
  PrayerTimes,
  Settings,
  SolarTimeName,
} from '@/types';

interface PrayerTimesTableProps {
  prayerTimes: AlAdhanPrayerTimes[];
  savedSettings: PrayerTimes | null;
  settings: Settings | null;
}

type JummaPrayer = 'jumma1' | 'jumma2' | 'jumma3';

type PrayerColumn = {
  name: keyof PrayerAdjustments;
  label: string;
  getTime: (day: AlAdhanPrayerTimes) => string;
};

const currentDay = getCurrentDay();

export function PrayerTimesTable({ prayerTimes, savedSettings, settings }: PrayerTimesTableProps) {
  const [category, setCategory] = useState<AdjustmentCategory>('starts');

  const isJummaActive = (jumma: JummaPrayer): boolean => {
    const adj = savedSettings?.prayer_adjustments?.[jumma];
    if (!adj) return false;
    return (
      adj.starts?.type !== 'default' ||
      adj.athan?.type !== 'default' ||
      adj.iqamah?.type !== 'default'
    );
  };

  const basePrayers: PrayerColumn[] = [
    { name: 'fajr', label: 'Fajr', getTime: d => d.timings.Fajr },
    { name: 'dhuhr', label: 'Dhuhr', getTime: d => d.timings.Dhuhr },
  ];

  const jummaColumns: PrayerColumn[] = (['jumma1', 'jumma2', 'jumma3'] as JummaPrayer[])
    .filter(j => isJummaActive(j))
    .map((j, i) => ({
      name: j,
      label: `Jumma ${i + 1}`,
      getTime: (d: AlAdhanPrayerTimes) => d.timings.Dhuhr,
    }));

  const restPrayers: PrayerColumn[] = [
    { name: 'asr', label: 'Asr', getTime: d => d.timings.Asr },
    { name: 'maghrib', label: 'Maghrib', getTime: d => d.timings.Maghrib },
    { name: 'isha', label: 'Isha', getTime: d => d.timings.Isha },
  ];

  const columns = [...basePrayers, ...jummaColumns, ...restPrayers];

  /**
   * The single-time columns, which only appear under Starts — they have no athan
   * or iqamah of their own. Sunrise comes from the API; Ishraq and Chasht are
   * derived from it, so the three slot in between Fajr and Dhuhr in the order the
   * sun reaches them.
   */
  const solarColumns: {
    key: SolarTimeName;
    label: string;
    getTime: (d: AlAdhanPrayerTimes) => string;
  }[] = [
    {
      key: 'sunrise',
      label: 'Sunrise',
      getTime: d => applySingleAdjustment(d.timings.Sunrise, settings?.sunrise_adjustment),
    },
    {
      key: 'ishraq',
      label: 'Ishraq',
      getTime: d =>
        getIshraqTime(d.timings.Sunrise, settings?.sunrise_adjustment, settings?.ishraq_adjustment),
    },
    {
      key: 'chasht',
      label: 'Chasht',
      getTime: d =>
        getChashtTime(
          d.timings.Sunrise,
          d.timings.Dhuhr,
          settings?.sunrise_adjustment,
          settings?.chasht_adjustment
        ),
    },
  ];

  const currentMonth = prayerTimes[0]?.date?.gregorian?.month?.en;
  const currentYear = prayerTimes[0]?.date?.gregorian?.year;
  // Date + Fajr + the solar columns (Starts only) + the rest.
  const columnCount = 2 + (category === 'starts' ? solarColumns.length : 0) + columns.length - 1;

  return (
    <Card className='gap-0 py-0'>
      <CardHeader className='bg-primary/5 py-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle className='text-base'>
            Prayer Times for {currentMonth}, {currentYear}
          </CardTitle>
          <Tabs value={category} onValueChange={v => setCategory(v as AdjustmentCategory)}>
            <TabsList>
              <TabsTrigger value='starts'>Starts</TabsTrigger>
              <TabsTrigger value='athan'>Athan</TabsTrigger>
              <TabsTrigger value='iqamah'>Iqamah</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className='p-0 overflow-auto'>
        {/* Scrolls sideways on narrow screens; the date column stays pinned. */}
        <Table className='table-fixed' style={{ minWidth: `${columnCount * 5.5}rem` }}>
          <TableHeader>
            <TableRow className='bg-muted/50'>
              <TableHead className='sticky left-0 z-10 bg-card text-center font-medium py-3'>
                Date
              </TableHead>
              <TableHead className='text-center font-semibold'>Fajr</TableHead>
              {category === 'starts' &&
                solarColumns.map(col => (
                  <TableHead key={col.key} className='text-center font-semibold'>
                    {col.label}
                  </TableHead>
                ))}
              {columns.slice(1).map(col => (
                <TableHead key={col.name} className='text-center font-semibold'>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {prayerTimes.map((day, index) => {
              const dateStr = `${day.date.gregorian.year}-${day.date.gregorian.month.number.toString().padStart(2, '0')}-${day.date.gregorian.day}`;
              const isJummaDay = isFriday(dateStr);

              return (
                <TableRow
                  key={day.date.gregorian.date}
                  className={
                    index + 1 === currentDay ? 'bg-primary/10' : isJummaDay ? 'bg-secondary/10' : ''
                  }
                >
                  <TableCell className='sticky left-0 z-10 bg-card font-medium text-center'>
                    {day.date.gregorian.day}
                    {isJummaDay && <span className='ml-1 text-xs text-primary'>(Fri)</span>}
                  </TableCell>
                  <TableCell className='text-center'>
                    {getAdjustedPrayerTime('fajr', day.timings.Fajr, savedSettings, category)}
                  </TableCell>
                  {category === 'starts' &&
                    solarColumns.map(col => (
                      <TableCell key={col.key} className='text-center'>
                        {col.getTime(day)}
                      </TableCell>
                    ))}
                  {columns.slice(1).map(col => {
                    const isJumma = ['jumma1', 'jumma2', 'jumma3'].includes(col.name);
                    return (
                      <TableCell key={col.name} className='text-center'>
                        {isJumma && !isJummaDay
                          ? '—'
                          : getAdjustedPrayerTime(
                              col.name,
                              col.getTime(day),
                              savedSettings,
                              category
                            )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
