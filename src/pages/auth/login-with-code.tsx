import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label, ErrorBox } from '@/components/ui';
import { AuthLegalLinks, AuthHeader } from '@/components/common';
import { cn } from '@/utils';
import { loginWithCodeSchema, type LoginWithCodeData } from '@/lib/zod';
import { Link, useSearchParams } from 'react-router';
import { getDisplaySession } from '@/lib/supabase';
import { AuthRoutes } from '@/constants';
import { useDisplayStore } from '@/store';

export default function LoginWithCode() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchParams] = useSearchParams();
  const hasAutoLoginAttempted = useRef(false);

  const { setLoggedIn, setMasjidProfile, setDisplayScreen } = useDisplayStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginWithCodeData>({
    resolver: zodResolver(loginWithCodeSchema),
    defaultValues: { code: '' },
  });

  const loginWithCode = useCallback(
    async (code: string) => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        // The code is the display's only credential, so it is exchanged for the
        // screen server-side — `display_screens` is not readable by anon.
        const session = await getDisplaySession(code);

        if (!session) {
          setErrorMessage('Invalid screen code. Please check and try again.');
          return;
        }

        setDisplayScreen(session.screen);
        setMasjidProfile(session.masjid_profile);
        setLoggedIn(true);
      } catch (err) {
        console.error('Error during login with code:', err);
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [setLoggedIn, setMasjidProfile, setDisplayScreen]
  );

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !hasAutoLoginAttempted.current) {
      hasAutoLoginAttempted.current = true;
      loginWithCode(code);
    }
  }, [searchParams, loginWithCode]);

  const onSubmit = async (data: LoginWithCodeData) => {
    await loginWithCode(data.code);
  };

  const handleInputChange = () => {
    if (errorMessage) setErrorMessage('');
  };

  return (
    <div className='flex min-h-screen flex-col'>
      <AuthHeader />
      <div className='flex w-full flex-1 flex-col items-center justify-center px-4 py-8 md:px-6'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-4 sm:space-y-6 sm:w-[350px]'>
          <div className='flex flex-col space-y-2 text-center'>
            <h1 className='text-xl sm:text-2xl font-semibold tracking-tight'>
              Login with Screen Code
            </h1>
            <p className='text-sm text-muted-foreground'>
              Enter the screen code to view the display
            </p>
          </div>
          <div className='grid gap-4 sm:gap-6'>
            {errorMessage && <ErrorBox message={errorMessage} />}
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className='grid gap-3 sm:gap-4'>
                <div className='grid gap-1 sm:gap-2'>
                  <Label htmlFor='code'>Screen Code</Label>
                  <Input
                    id='code'
                    type='text'
                    className={cn(errors.code && 'border-red-500')}
                    placeholder='Enter screen code'
                    {...register('code', { onChange: handleInputChange })}
                  />
                  {errors.code && (
                    <p className='text-xs text-red-500 mt-1'>{errors.code.message}</p>
                  )}
                </div>
                <Button type='submit' loading={isLoading} className='mt-2'>
                  {isLoading ? 'Checking...' : 'Continue'}
                </Button>
                <Button type='button' variant='link'>
                  <Link to={AuthRoutes.Login}>Login with email and password</Link>
                </Button>
              </div>
            </form>
            <AuthLegalLinks />
          </div>
        </div>
      </div>
    </div>
  );
}
