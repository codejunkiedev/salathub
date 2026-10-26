import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ErrorBox,
  PasswordStrengthMeter,
} from '@/components/ui';
import {
  changeEmailSchema,
  type ChangeEmailData,
  updatePasswordSchema,
  type UpdatePasswordData,
} from '@/lib/zod';
import {
  getCurrentUser,
  updateUserEmail,
  updateUserPasswordWithVerification,
} from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/utils';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { AppRoutes } from '@/constants';

export default function Account() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isEmailSaving, setIsEmailSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState({ old: false, new: false, confirm: false });
  const [passwordError, setPasswordError] = useState<string>('');

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
    reset: resetEmail,
  } = useForm<ChangeEmailData>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: '' },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    control,
    reset: resetPassword,
  } = useForm<UpdatePasswordData>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { oldPassword: '', password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' });

  useEffect(() => {
    async function fetchUser() {
      try {
        setIsLoading(true);
        const user = await getCurrentUser();
        if (user?.email) {
          setCurrentEmail(user.email);
          setUserEmail(user.email);
          resetEmail({ email: user.email });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [resetEmail]);

  const onEmailSubmit = async (data: ChangeEmailData) => {
    if (data.email === currentEmail) {
      toast.error('New email is the same as your current email');
      return;
    }
    try {
      setIsEmailSaving(true);
      await updateUserEmail(data.email);
      toast.success('A confirmation link has been sent to your new email address');
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error(
        `Failed to update email address: ${error instanceof Error ? error.message : 'Unknown error.'}`
      );
    } finally {
      setIsEmailSaving(false);
    }
  };

  const onPasswordSubmit = async (data: UpdatePasswordData) => {
    if (!userEmail) {
      setPasswordError('User email not found. Please try logging in again.');
      return;
    }
    try {
      setIsPasswordSaving(true);
      setPasswordError('');
      await updateUserPasswordWithVerification(userEmail, data.oldPassword, data.password);
      toast.success('Password updated successfully');
      resetPassword();
    } catch (err) {
      console.error('Error during password update:', err);
      setPasswordError(
        err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      );
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handlePasswordInputChange = () => {
    if (passwordError) setPasswordError('');
  };

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to={AppRoutes.Settings}>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Settings
          </Button>
        </Link>
      </div>
      <PageHeader title='Account Settings' description='Manage your email address and password' />

      {isLoading ? (
        <div className='animate-pulse bg-muted rounded-lg h-96'></div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Change Email Address</CardTitle>
              <CardDescription>
                Update the email address associated with your account. A confirmation link will be
                sent to the new email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailSubmit(onEmailSubmit)} className='space-y-4'>
                <div className='space-y-2'>
                  <label htmlFor='email' className='block text-sm font-medium text-foreground'>
                    Email Address
                  </label>
                  <Input
                    id='email'
                    type='email'
                    {...registerEmail('email')}
                    placeholder='Enter new email address'
                    className={emailErrors.email ? 'border-red-500' : ''}
                  />
                  {emailErrors.email && (
                    <p className='text-red-500 text-sm mt-1'>{emailErrors.email.message}</p>
                  )}
                </div>
                <Button type='submit' loading={isEmailSaving} disabled={isEmailSaving}>
                  {isEmailSaving ? 'Updating...' : 'Update Email'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Password</CardTitle>
              <CardDescription>
                Change your account password. You will need to enter your current password for
                verification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passwordError && <ErrorBox message={passwordError} className='mb-6' />}
              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className='space-y-6'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='oldPassword'>Current Password</Label>
                    <div className='relative'>
                      <Input
                        id='oldPassword'
                        type={showPassword.old ? 'text' : 'password'}
                        className={cn(passwordErrors.oldPassword && 'border-red-500')}
                        {...registerPassword('oldPassword', {
                          onChange: handlePasswordInputChange,
                        })}
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0'
                        onClick={() => setShowPassword(prev => ({ ...prev, old: !prev.old }))}
                        tabIndex={-1}
                      >
                        {showPassword.old ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                    {passwordErrors.oldPassword && (
                      <p className='text-red-500 text-sm mt-1'>
                        {passwordErrors.oldPassword.message}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='password'>New Password</Label>
                    <div className='relative'>
                      <Input
                        id='password'
                        type={showPassword.new ? 'text' : 'password'}
                        className={cn(passwordErrors.password && 'border-red-500')}
                        {...registerPassword('password', {
                          onChange: handlePasswordInputChange,
                        })}
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0'
                        onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                        tabIndex={-1}
                      >
                        {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                    {password && <PasswordStrengthMeter password={password} />}
                    {passwordErrors.password && (
                      <p className='text-red-500 text-sm mt-1'>{passwordErrors.password.message}</p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='confirmPassword'>Confirm New Password</Label>
                    <div className='relative'>
                      <Input
                        id='confirmPassword'
                        type={showPassword.confirm ? 'text' : 'password'}
                        className={cn(passwordErrors.confirmPassword && 'border-red-500')}
                        {...registerPassword('confirmPassword', {
                          onChange: handlePasswordInputChange,
                        })}
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0'
                        onClick={() =>
                          setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))
                        }
                        tabIndex={-1}
                      >
                        {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className='text-red-500 text-sm mt-1'>
                        {passwordErrors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button type='submit' loading={isPasswordSaving} disabled={isPasswordSaving}>
                  {isPasswordSaving ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
