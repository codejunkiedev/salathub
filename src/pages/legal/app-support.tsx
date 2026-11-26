import { Link } from 'react-router';
import { AuthRoutes, PublicRoutes } from '@/constants/routes';
import { LegalLayout } from './legal-layout';

const SUPPORT_EMAIL = 'admin@shaykhrahmatalamjan.com';

export default function AppSupport() {
  return (
    <LegalLayout title='Support'>
      <p>
        Need help with the <strong>Alkhairia</strong> app or <strong>SalatHub</strong>? Have a
        question, a suggestion, or found a problem? We would love to hear from you.
      </p>

      <h2>Contact us</h2>
      <p>
        Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Please tell us which
        app you are using, your device and app version, and what happened.
      </p>

      <h2>Common questions</h2>

      <h3>Prayer times for my masjid look wrong</h3>
      <p>
        Each masjid manages its own prayer and iqamah times in SalatHub. If a time looks wrong,
        please contact the masjid directly. If you think it is a problem with the app, email us and
        include the masjid's name.
      </p>

      <h3>My masjid is not in the app</h3>
      <p>
        The app only lists masjids that use SalatHub and have chosen to be listed. Masjid
        administrators can <Link to={AuthRoutes.Register}>register their masjid</Link> for free.
      </p>

      <h3>Why does the app ask for my location?</h3>
      <p>
        Location is optional. It is used to show prayer times where you are, find masjids near you,
        and point to the Qibla. Without it, you can still search for masjids by name. See our{' '}
        <Link to={PublicRoutes.PrivacyPolicy}>Privacy Policy</Link> for details.
      </p>

      <h3>I am not getting prayer reminders or timing-change alerts</h3>
      <p>
        Check that notifications are allowed for Alkhairia in your device settings and that the
        reminders or <strong>Timing changes</strong> setting is turned on in the app.
      </p>

      <h3>How do I delete my data?</h3>
      <p>
        The Alkhairia app has no accounts. Your settings and followed masjids are stored on your
        device and are removed when you uninstall the app. Turning off{' '}
        <strong>Timing changes</strong> deletes the information we store for alerts.
      </p>
    </LegalLayout>
  );
}
