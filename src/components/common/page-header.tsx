import type { ReactNode } from 'react';
import { Button, Card, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Plus, Settings } from 'lucide-react';

type PageHeaderProps = {
  title: string;
  description: string;
  showAddButton?: boolean;
  addButtonText?: string;
  addButtonDisabled?: boolean;
  onAddClick?: () => void;
  showSettingsButton?: boolean;
  onSettingsClick?: () => void;
  actions?: ReactNode;
};

/**
 * Page header component with title, description, and optional action buttons
 * Supports add and settings functionality
 * @param props Component props containing header content and button configurations
 */
export function PageHeader({
  title,
  description,
  showAddButton = true,
  addButtonText = 'Add New',
  addButtonDisabled = false,
  onAddClick,
  showSettingsButton = false,
  onSettingsClick,
  actions,
}: PageHeaderProps) {
  const isRightContent = !!actions || showAddButton || showSettingsButton;

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-1'>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isRightContent && (
            <div className='flex flex-wrap gap-2'>
              {actions}
              {showSettingsButton && onSettingsClick && (
                <Button onClick={onSettingsClick}>
                  <Settings className='mr-2 h-4 w-4' />
                  Settings
                </Button>
              )}
              {showAddButton && onAddClick && (
                <Button onClick={onAddClick} disabled={addButtonDisabled}>
                  <Plus className='mr-2 h-4 w-4' /> {addButtonText}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
