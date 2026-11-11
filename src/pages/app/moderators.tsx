import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getModerators,
  createModerator,
  revokeModerator,
  resetModeratorPassword,
  updateModerator,
} from '@/lib/supabase';
import type { ModeratorWithEmail } from '@/lib/supabase/services/moderators';
import {
  createModeratorSchema,
  type CreateModeratorData,
  resetModeratorPasswordSchema,
  type ResetModeratorPasswordData,
  updateModeratorSchema,
  type UpdateModeratorData,
} from '@/lib/zod';
import { TableSkeleton } from '@/components/skeletons';
import { PageHeader, ErrorAlert, EmptyState, DataTable, type Column } from '@/components/common';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from '@/components/ui';
import { Users, Trash2, KeyRound, Pencil, Eye, EyeOff } from 'lucide-react';
import { useTrigger } from '@/hooks';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function Moderators() {
  const [moderators, setModerators] = useState<ModeratorWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [moderatorToRevoke, setModeratorToRevoke] = useState<ModeratorWithEmail | null>(null);
  const [moderatorToReset, setModeratorToReset] = useState<ModeratorWithEmail | null>(null);
  const [moderatorToEdit, setModeratorToEdit] = useState<ModeratorWithEmail | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  const [trigger, forceUpdate] = useTrigger();

  const createForm = useForm<CreateModeratorData>({
    resolver: zodResolver(createModeratorSchema),
  });

  const resetPasswordForm = useForm<ResetModeratorPasswordData>({
    resolver: zodResolver(resetModeratorPasswordSchema),
  });

  const editForm = useForm<UpdateModeratorData>({
    resolver: zodResolver(updateModeratorSchema),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getModerators();
        setModerators(data);
      } catch (err) {
        setError('Failed to fetch moderators');
        toast.error('Failed to fetch moderators');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger]);

  // Add modal
  const handleAddNew = () => {
    createForm.reset();
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddModalOpen(true);
  };

  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
    createForm.reset();
  };

  const onSubmitCreate = async (data: CreateModeratorData) => {
    try {
      setIsCreating(true);
      await createModerator(data.email, data.password, data.name);
      toast.success('Moderator created successfully');
      handleAddModalClose();
      forceUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create moderator';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke modal
  const handleRevokeClick = (moderator: ModeratorWithEmail) => {
    setModeratorToRevoke(moderator);
    setIsRevokeModalOpen(true);
  };

  const handleRevokeConfirm = async () => {
    if (!moderatorToRevoke) return;
    try {
      setIsRevoking(true);
      await revokeModerator(moderatorToRevoke.user_id);
      toast.success('Moderator revoked successfully');
      setIsRevokeModalOpen(false);
      setModeratorToRevoke(null);
      forceUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke moderator';
      toast.error(message);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRevokeCancel = () => {
    setIsRevokeModalOpen(false);
    setModeratorToRevoke(null);
  };

  // Reset password modal
  const handleResetPasswordClick = (moderator: ModeratorWithEmail) => {
    setModeratorToReset(moderator);
    resetPasswordForm.reset();
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordClose = () => {
    setIsResetPasswordModalOpen(false);
    setModeratorToReset(null);
    resetPasswordForm.reset();
  };

  const onSubmitResetPassword = async (data: ResetModeratorPasswordData) => {
    if (!moderatorToReset) return;
    try {
      setIsResetting(true);
      await resetModeratorPassword(moderatorToReset.user_id, data.password);
      toast.success('Password reset successfully');
      handleResetPasswordClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  };

  // Edit modal
  const handleEditClick = (moderator: ModeratorWithEmail) => {
    setModeratorToEdit(moderator);
    editForm.reset({ name: moderator.name, email: moderator.email });
    setIsEditModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
    setModeratorToEdit(null);
    editForm.reset();
  };

  const onSubmitEdit = async (data: UpdateModeratorData) => {
    if (!moderatorToEdit) return;
    try {
      setIsUpdating(true);
      const updates: { name?: string; email?: string } = {};
      if (data.name !== moderatorToEdit.name) updates.name = data.name;
      if (data.email !== moderatorToEdit.email) updates.email = data.email;

      if (Object.keys(updates).length === 0) {
        handleEditClose();
        return;
      }

      await updateModerator(moderatorToEdit.user_id, updates);
      toast.success('Moderator updated successfully');
      handleEditClose();
      forceUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update moderator';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const columns: Column<ModeratorWithEmail>[] = [
    {
      key: 'name',
      name: 'Name',
      width: 'w-[25%]',
      render: value =>
        value ? (
          <span className='font-medium'>{value as string}</span>
        ) : (
          <span className='text-muted-foreground italic'>—</span>
        ),
    },
    {
      key: 'email',
      name: 'Email',
      width: 'w-[30%]',
      render: value => <span>{value as string}</span>,
    },
    {
      key: 'last_active_at',
      name: 'Last Active',
      width: 'w-[20%]',
      render: value =>
        value ? (
          <span className='text-muted-foreground'>
            {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
          </span>
        ) : (
          <span className='text-muted-foreground italic'>Never</span>
        ),
    },
    {
      key: 'created_at',
      name: 'Added',
      width: 'w-[15%]',
      render: value => (
        <span className='text-muted-foreground'>
          {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
        </span>
      ),
    },
  ];

  return (
    <div className='container mx-auto py-2 md:py-8 space-y-6'>
      <PageHeader
        title='Moderators'
        description='Manage moderators who can help manage your masjid content'
        addButtonText='Add Moderator'
        onAddClick={handleAddNew}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : moderators.length === 0 ? (
        <EmptyState
          icon={<Users className='h-6 w-6 text-muted-foreground' />}
          title='No moderators yet'
          description='Add moderators to help manage your masjid content. Moderators can manage announcements, events, posts, and videos.'
          actionText='Add First Moderator'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={moderators}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[10%]'
          renderActions={item => (
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                className='hover:bg-muted'
                onClick={() => handleEditClick(item)}
                title='Edit moderator'
              >
                <Pencil size={16} />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='hover:bg-muted'
                onClick={() => handleResetPasswordClick(item)}
                title='Reset password'
              >
                <KeyRound size={16} />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='text-destructive hover:text-destructive hover:bg-destructive/10'
                onClick={() => handleRevokeClick(item)}
                title='Revoke moderator'
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}
        />
      )}

      {/* Add Moderator Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={open => !open && handleAddModalClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Moderator</DialogTitle>
            <DialogDescription>
              Create an account for a new moderator. They will be able to manage content but not
              settings, screens, or prayer times.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input id='name' placeholder='Full name' {...createForm.register('name')} />
              {createForm.formState.errors.name && (
                <p className='text-sm text-destructive'>
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                placeholder='moderator@example.com'
                {...createForm.register('email')}
              />
              {createForm.formState.errors.email && (
                <p className='text-sm text-destructive'>
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Minimum 8 characters'
                  {...createForm.register('password')}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {createForm.formState.errors.password && (
                <p className='text-sm text-destructive'>
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>Confirm Password</Label>
              <div className='relative'>
                <Input
                  id='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder='Confirm password'
                  {...createForm.register('confirmPassword')}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {createForm.formState.errors.confirmPassword && (
                <p className='text-sm text-destructive'>
                  {createForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleAddModalClose}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isCreating} loading={isCreating}>
                Create Moderator
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Moderator Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={open => !open && handleEditClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Moderator</DialogTitle>
            <DialogDescription>Update the moderator's name or email address.</DialogDescription>
          </DialogHeader>

          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='editName'>Name</Label>
              <Input id='editName' placeholder='Full name' {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className='text-sm text-destructive'>{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='editEmail'>Email</Label>
              <Input
                id='editEmail'
                type='email'
                placeholder='moderator@example.com'
                {...editForm.register('email')}
              />
              {editForm.formState.errors.email && (
                <p className='text-sm text-destructive'>
                  {editForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleEditClose}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isUpdating} loading={isUpdating}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog
        open={isResetPasswordModalOpen}
        onOpenChange={open => !open && handleResetPasswordClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {moderatorToReset?.name || moderatorToReset?.email}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={resetPasswordForm.handleSubmit(onSubmitResetPassword)}
            className='space-y-4'
          >
            <div className='space-y-2'>
              <Label htmlFor='resetPassword'>New Password</Label>
              <div className='relative'>
                <Input
                  id='resetPassword'
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder='Minimum 8 characters'
                  {...resetPasswordForm.register('password')}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {resetPasswordForm.formState.errors.password && (
                <p className='text-sm text-destructive'>
                  {resetPasswordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='resetConfirmPassword'>Confirm New Password</Label>
              <div className='relative'>
                <Input
                  id='resetConfirmPassword'
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  placeholder='Confirm password'
                  {...resetPasswordForm.register('confirmPassword')}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
                  onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                >
                  {showResetConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {resetPasswordForm.formState.errors.confirmPassword && (
                <p className='text-sm text-destructive'>
                  {resetPasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleResetPasswordClose}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isResetting} loading={isResetting}>
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Modal */}
      <Dialog open={isRevokeModalOpen} onOpenChange={open => !open && handleRevokeCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Moderator</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this moderator? They will lose access immediately and
              their account will be deleted.
            </DialogDescription>
          </DialogHeader>

          {moderatorToRevoke && (
            <div className='mt-2 p-4 bg-muted rounded border'>
              {moderatorToRevoke.name && (
                <p className='font-medium text-foreground'>{moderatorToRevoke.name}</p>
              )}
              <p className='text-sm text-muted-foreground'>{moderatorToRevoke.email}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={handleRevokeCancel} disabled={isRevoking}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleRevokeConfirm}
              disabled={isRevoking}
              loading={isRevoking}
            >
              Revoke Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
