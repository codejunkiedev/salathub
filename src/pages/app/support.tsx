import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/common';
import { getCurrentUser, getMasjidProfile } from '@/lib/supabase';

const BASE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdKY71Asa0cpHc05t6L796hBDmgVyd_pXyS2PqoZuYoOjrckA/viewform';

export default function Support() {
  const [formUrl, setFormUrl] = useState(`${BASE_FORM_URL}?embedded=true`);

  useEffect(() => {
    async function prefillForm() {
      const [user, profile] = await Promise.all([getCurrentUser(), getMasjidProfile()]);

      const params = new URLSearchParams({ embedded: 'true' });
      if (user?.email) params.set('entry.392865440', user.email);
      if (profile?.name) params.set('entry.1962451425', profile.name);

      setFormUrl(`${BASE_FORM_URL}?${params.toString()}`);
    }

    prefillForm();
  }, []);

  return (
    <div className='container mx-auto pb-6 space-y-4'>
      <PageHeader
        title='Support'
        description='Have a question, suggestion, or issue? Fill out the form below and we will get back to you.'
      />

      <div className='rounded-lg border bg-card overflow-hidden'>
        <iframe src={formUrl} width='100%' height='800' className='border-0' title='Support Form'>
          Loading…
        </iframe>
      </div>
    </div>
  );
}
