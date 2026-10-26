import { cn } from '@/utils';
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { CalendarIcon, Clock } from 'lucide-react';
import { formatDateTimePickerDate, getHours, getMinutes, setHours, setMinutes } from '@/utils';

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date) => void;
  disabled?: boolean;
}

const HOURS = [12, ...Array.from({ length: 11 }, (_, i) => i + 1)];
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);

const pad = (n: number) => n.toString().padStart(2, '0');

/**
 * A date and time picker: calendar for the day, dropdowns for hour, minute and AM/PM
 */
export function DateTimePicker({ date, setDate, disabled }: DateTimePickerProps) {
  const hours = date ? getHours(date) : undefined;
  const minutes = date ? getMinutes(date) : undefined;
  const isPM = hours !== undefined && hours >= 12;

  // Keep an existing off-step minute (e.g. 07) selectable instead of showing blank
  const minuteOptions =
    minutes !== undefined && !MINUTE_STEPS.includes(minutes)
      ? [...MINUTE_STEPS, minutes].sort((a, b) => a - b)
      : MINUTE_STEPS;

  function handleDateSelect(selectedDate: Date | undefined) {
    if (!selectedDate) return;
    const newDate = new Date(selectedDate);
    if (date) {
      newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
    }
    setDate(newDate);
  }

  function handleTimeChange(type: 'hour' | 'minute' | 'ampm', value: string) {
    // With nothing picked yet, start from today on the hour rather than the current minute
    let updated = date ? new Date(date) : new Date(new Date().setMinutes(0, 0, 0));
    const current = getHours(updated);

    if (type === 'hour') {
      const hour12 = parseInt(value, 10) % 12;
      updated = setHours(updated, current >= 12 ? hour12 + 12 : hour12);
    } else if (type === 'minute') {
      updated = setMinutes(updated, parseInt(value, 10));
    } else if (value === 'AM' && current >= 12) {
      updated = setHours(updated, current - 12);
    } else if (value === 'PM' && current < 12) {
      updated = setHours(updated, current + 12);
    }

    setDate(updated);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn('w-full pl-3 text-left font-normal', !date && 'text-muted-foreground')}
          disabled={disabled}
        >
          {date ? formatDateTimePickerDate(date) : <span>MM/DD/YYYY hh:mm AA</span>}
          <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-auto p-0'
        align='start'
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <Calendar mode='single' selected={date} onSelect={handleDateSelect} autoFocus />
        <div className='flex items-center gap-2 border-t p-3'>
          <Clock className='size-4 shrink-0 text-muted-foreground' aria-hidden />
          <Select
            value={hours !== undefined ? String(hours % 12 || 12) : undefined}
            onValueChange={v => handleTimeChange('hour', v)}
          >
            <SelectTrigger size='sm' className='flex-1 min-w-0 gap-1 px-2' aria-label='Hour'>
              <SelectValue placeholder='--' />
            </SelectTrigger>
            <SelectContent className='max-h-60'>
              {HOURS.map(h => (
                <SelectItem key={h} value={String(h)}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className='text-muted-foreground'>:</span>
          <Select
            value={minutes !== undefined ? String(minutes) : undefined}
            onValueChange={v => handleTimeChange('minute', v)}
          >
            <SelectTrigger size='sm' className='flex-1 min-w-0 gap-1 px-2' aria-label='Minute'>
              <SelectValue placeholder='--' />
            </SelectTrigger>
            <SelectContent className='max-h-60'>
              {minuteOptions.map(m => (
                <SelectItem key={m} value={String(m)}>
                  {pad(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={date ? (isPM ? 'PM' : 'AM') : undefined}
            onValueChange={v => handleTimeChange('ampm', v)}
          >
            <SelectTrigger size='sm' className='flex-1 min-w-0 gap-1 px-2' aria-label='AM or PM'>
              <SelectValue placeholder='--' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='AM'>AM</SelectItem>
              <SelectItem value='PM'>PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
