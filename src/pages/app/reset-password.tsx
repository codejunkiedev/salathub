import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, ErrorBox, PasswordStrengthMeter } from '@/components/ui';
import { cn } from '@/utils';
import { Eye, EyeOff } from 'lucide-react';
import { updateUserPassword } from '@/lib/supabase';
import { toast } from 'sonner';
import { AppRoutes } from '@/constants';
import { resetPasswordSchema, type ResetPasswordData } from '@/lib/zod';
import { AutoRedirectNotice } from '@/components/auto-redirect-notice';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState({ new: false, confirm: false });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' });

  const onSubmit = async (data: ResetPasswordData) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      await updateUserPassword(data.password);
      setIsSuccess(true);
      toast.success('Password reset successfully');
    } catch (err) {
      console.error('Error during password reset:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to reset password. Make sure you're using the link from your email."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = () => {
    if (errorMessage) setErrorMessage('');
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-2xl'>
      <h1 className='text-2xl font-bold mb-6'>Reset Password</h1>

      {errorMessage && <ErrorBox message={errorMessage} className='mb-6' />}

      {isSuccess ? (
        <AutoRedirectNotice
          to={AppRoutes.Home}
          delaySeconds={5}
          message={'Your password has been reset successfully.'}
          buttonLabel='Go to Home'
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='password'>New Password</Label>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword.new ? 'text' : 'password'}
                className={cn(errors.password && 'border-red-500')}
                {...register('password', {
                  onChange: handleInputChange,
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
            {errors.password && (
              <p className='text-red-500 text-sm mt-1'>{errors.password.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>Confirm New Password</Label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                type={showPassword.confirm ? 'text' : 'password'}
                className={cn(errors.confirmPassword && 'border-red-500')}
                {...register('confirmPassword', {
                  onChange: handleInputChange,
                })}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0'
                onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                tabIndex={-1}
              >
                {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className='text-red-500 text-sm mt-1'>{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type='submit' loading={isLoading}>
            {isLoading ? 'Resetting password...' : 'Reset Password'}
          </Button>
        </form>
      )}
    </div>
  );
}
