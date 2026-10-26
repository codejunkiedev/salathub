import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, ErrorBox, PasswordStrengthMeter } from '@/components/ui';
import { AuthLegalLinks } from '@/components/common';
import { cn } from '@/utils';
import { Eye, EyeOff } from 'lucide-react';
import { registerFormSchema, type RegisterFormData } from '@/lib/zod';
import { Link } from 'react-router';
import { signUpWithEmail } from '@/lib/supabase';
import { toast } from 'sonner';
import { AuthRoutes } from '@/constants';

export default function Register() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState({ new: false, confirm: false });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const watchedPassword = useWatch({ control, name: 'password' });

  if (watchedPassword !== password) {
    setPassword(watchedPassword);
  }

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      await signUpWithEmail(data.email, data.password);
      toast.success('Account created and logged in successfully');
    } catch (err) {
      console.error('Error during sign up:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = () => {
    if (errorMessage) setErrorMessage('');
  };

  return (
    <div className='flex h-screen w-full flex-col items-center justify-center px-4 md:px-6'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-4 sm:space-y-6 sm:w-[350px]'>
        <div className='flex flex-col space-y-2 text-center'>
          <h1 className='text-xl sm:text-2xl font-semibold tracking-tight'>Create an account</h1>
          <p className='text-sm text-muted-foreground'>Enter your details to create your account</p>
        </div>
        <div className='grid gap-4 sm:gap-6'>
          {errorMessage && <ErrorBox message={errorMessage} />}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className='grid gap-3 sm:gap-4'>
              <div className='grid gap-1 sm:gap-2'>
                <Label htmlFor='email'>Email</Label>
                <Input
                  id='email'
                  type='email'
                  className={cn(errors.email && 'border-red-500')}
                  placeholder='name@example.com'
                  {...register('email', {
                    onChange: handleInputChange,
                  })}
                />
                {errors.email && (
                  <p className='text-xs text-red-500 mt-1'>{errors.email.message}</p>
                )}
              </div>
              <div className='grid gap-1 sm:gap-2'>
                <Label htmlFor='password'>Password</Label>
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
                    className='absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0'
                    onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                    tabIndex={-1}
                  >
                    {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {password && <PasswordStrengthMeter password={password} />}
                {errors.password && (
                  <p className='text-xs text-red-500 mt-1'>{errors.password.message}</p>
                )}
              </div>
              <div className='grid gap-1 sm:gap-2'>
                <Label htmlFor='confirmPassword'>Confirm Password</Label>
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
                    className='absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0'
                    onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                    tabIndex={-1}
                  >
                    {showPassword.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className='text-xs text-red-500 mt-1'>{errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type='submit' loading={isLoading} className='mt-2'>
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </div>
          </form>
          <div className='text-center text-sm'>
            Already have an account?{' '}
            <Link to={AuthRoutes.Login} className='underline underline-offset-4 hover:text-primary'>
              Sign in
            </Link>
          </div>
          <AuthLegalLinks />
        </div>
      </div>
    </div>
  );
}
