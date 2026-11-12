import { Link } from 'react-router';
import { PublicRoutes } from '@/constants/routes';
import { LegalLayout } from './legal-layout';

export default function TermsConditions() {
  return (
    <LegalLayout title='Terms & Conditions' lastUpdated='12 November 2026'>
      <p>
        Welcome to <strong>SalatHub</strong>, operated by Collections of Shaykh Rahmat Alam Jan LLC,
        a New Jersey limited liability company ("we", "us", "our"). These Terms &amp; Conditions
        ("Terms") govern your access to and use of the SalatHub application and related services
        (the "Services").
      </p>
      <p>
        By accessing or using the Services, you agree to be bound by these Terms. If you do not
        agree, please do not use the Services.
      </p>

      <h2>1. Definitions</h2>
      <ul>
        <li>
          <strong>"Services"</strong> — the SalatHub web application, display screens, APIs, and
          related features.
        </li>
        <li>
          <strong>"User", "you"</strong> — any person accessing or using the Services, including
          administrators, moderators, and display operators.
        </li>
        <li>
          <strong>"Account"</strong> — the credentials and configuration associated with a masjid on
          SalatHub.
        </li>
        <li>
          <strong>"Content"</strong> — text, images, audio, video, links, designs, and other
          material made available through the Services, including User Content you upload.
        </li>
      </ul>

      <h2>2. Acceptance of Terms</h2>
      <p>
        By accessing or using the Services, you acknowledge that you have read and understood these
        Terms and agree to be legally bound by them. If you are using the Services on behalf of a
        masjid or other organisation, you represent that you have the authority to bind that
        organisation to these Terms.
      </p>

      <h2>3. Eligibility</h2>
      <p>
        You may use the Services only if you are at least the age of majority in your jurisdiction
        and capable of entering into a binding contract. The Services are intended for use by masjid
        administrators and the moderators they appoint.
      </p>

      <h2>4. Accounts</h2>
      <p>To use most features of the Services you must create an account. When you do so:</p>
      <ul>
        <li>You must provide accurate, current, and complete information.</li>
        <li>You are responsible for maintaining the confidentiality of your credentials.</li>
        <li>
          You are responsible for all activity that occurs under your account, including the actions
          of moderators you invite.
        </li>
        <li>You must notify us immediately of any unauthorised use of your account.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these Terms or that we reasonably believe
        pose a risk to other users or to the Services.
      </p>

      <h2>5. Display Screen Codes</h2>
      <p>
        The Services allow you to pair physical or virtual display screens with your account using a
        screen code. You are responsible for keeping these codes private. Anyone with a valid screen
        code can render the public-facing content you have published to that screen. We are not
        responsible for content shown on screens connected through codes that have been shared
        outside your masjid.
      </p>

      <h2>6. Plans, Billing and Automatic Renewal</h2>
      <h3>Plans</h3>
      <p>
        SalatHub is offered per masjid on a Free plan and a paid Pro plan. What each plan includes
        and its current price are shown on the Billing page of the console before you buy. The
        Alkhairia app is free and is not part of any plan.
      </p>
      <h3>Free trial</h3>
      <p>
        A new masjid gets a 30-day Pro trial. No payment card is needed and you are not charged.
        When the trial ends, the masjid moves to the Free plan unless an administrator has upgraded
        to Pro.
      </p>
      <h3>Payment</h3>
      <ul>
        <li>
          Pro is billed yearly in advance, in your masjid's currency (US dollars, Canadian dollars
          or Pakistani rupees). Additional screens beyond those included in Pro are billed yearly
          per screen.
        </li>
        <li>
          Screens added part-way through a year are charged pro rata for the rest of that year.
          Screens removed part-way through a year are credited pro rata against your next charge;
          the credit is not paid out in cash.
        </li>
        <li>
          Prices do not include sales tax. Where we are required to collect it, tax is added at
          checkout and shown separately on your invoice.
        </li>
        <li>
          Payments are processed by Stripe. We do not store your card details. Charges appear on
          your statement as <strong>SALATHUB</strong>. Your bank may add its own fees, for example
          for foreign-currency or international payments.
        </li>
      </ul>
      <h3>Automatic renewal</h3>
      <p>
        <strong>
          Your Pro subscription, including any additional screens, renews automatically each year
          and the payment method on file is charged the then-current yearly price, plus any tax, on
          the renewal date, until you cancel.
        </strong>{' '}
        We email the masjid's administrator about 30 days before each renewal with the date and
        amount. If the price is going to change, we tell you before the renewal at which it applies.
        Screens bought at a launch price keep that price at each renewal for as long as the
        subscription stays active.
      </p>
      <h3>Cancelling</h3>
      <p>
        An administrator can cancel at any time from the Billing page of the console, without
        contacting us. Cancelling stops the next renewal; Pro stays active until the end of the year
        already paid for, and the masjid then moves to the Free plan. Refunds are covered by our{' '}
        <Link to={PublicRoutes.RefundPolicy}>Refund Policy</Link>.
      </p>
      <h3>Failed payments</h3>
      <p>
        If a payment fails, we retry it and email the administrator. If it still hasn't been paid 14
        days after the first failure, the masjid moves to the Free plan.
      </p>
      <h3>Moving to the Free plan</h3>
      <p>
        When a masjid moves to the Free plan, nothing is deleted. Screens above the Free limit are
        paused, Pro-only content is hidden from screens but kept, and moderators lose access.
        Upgrading to Pro again restores them.
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree to use the Services only for lawful purposes and not to:</p>
      <ul>
        <li>Violate any applicable laws, regulations, or third-party rights;</li>
        <li>
          Upload or display Content that is unlawful, defamatory, hateful, obscene, or otherwise
          objectionable;
        </li>
        <li>
          Impersonate any person or misrepresent your affiliation with any masjid or organisation;
        </li>
        <li>
          Attempt to gain unauthorised access to the Services, other users' accounts, or any system
          or network connected to the Services;
        </li>
        <li>
          Interfere with, disrupt, or place an unreasonable load on the Services or the underlying
          infrastructure;
        </li>
        <li>Reverse engineer, decompile, or attempt to extract the source code of the Services;</li>
        <li>
          Use the Services to send unsolicited communications or to violate any individual's
          privacy.
        </li>
      </ul>

      <h2>8. Your Content</h2>
      <p>
        You retain ownership of the Content you upload to the Services ("User Content"). By
        uploading User Content, you grant us a worldwide, non-exclusive, royalty-free licence to
        host, store, reproduce, display, and transmit that User Content solely as needed to operate
        the Services on your behalf — for example, to render it on your screens, sync it between
        devices, or back it up.
      </p>
      <p>You represent and warrant that:</p>
      <ul>
        <li>You own your User Content or have all necessary rights to upload and display it;</li>
        <li>
          Your User Content does not infringe any third-party intellectual property, privacy, or
          other rights;
        </li>
        <li>Your User Content complies with applicable laws and these Terms.</li>
      </ul>
      <p>
        We may remove User Content that, in our reasonable judgement, violates these Terms or
        applicable law.
      </p>

      <h2>9. Third-Party Content and Services</h2>
      <p>
        The Services include Content and integrations provided by third parties — for example,
        Quranic verses, hadith collections, prayer-time calculations, YouTube video embeds, and map
        data. Such Content is provided for your convenience and may be subject to the terms and
        licences of the original provider. We do not warrant the accuracy, completeness, or
        suitability of third-party Content for any particular purpose.
      </p>

      <h2>10. Religious and Educational Content</h2>
      <p>
        Religious, educational, and spiritual Content available through the Services is provided for
        general guidance and reminder. It does not replace personal, tailored religious counsel from
        qualified scholars. You are responsible for reviewing the Content you publish through your
        displays and for ensuring it reflects the values and policies of your masjid.
      </p>

      <h2>11. Intellectual Property</h2>
      <p>
        All rights, title, and interest in and to the Services — including the software, design,
        trademarks, and original Content — are owned by us or our licensors and are protected by
        applicable intellectual property laws. Except for the limited rights expressly granted in
        these Terms, no rights are granted to you.
      </p>
      <p>
        You may not reproduce, distribute, modify, create derivative works of, publicly display, or
        commercially exploit any part of the Services without our prior written consent.
      </p>

      <h2>12. Feedback</h2>
      <p>
        If you provide us with suggestions, ideas, or feedback about the Services, you grant us a
        non-exclusive, royalty-free, perpetual, irrevocable, worldwide licence to use that feedback
        for any purpose, without compensation or attribution.
      </p>

      <h2>13. Service Availability and Modifications</h2>
      <p>
        We strive to keep the Services available and functioning correctly, but we do not guarantee
        uninterrupted or error-free operation. We may modify, suspend, or discontinue any part of
        the Services at any time, with or without notice. We are not liable to you or any third
        party for any modification, suspension, or discontinuation of the Services.
      </p>

      <h2>14. Disclaimers</h2>
      <p>
        The Services and all Content are provided on an <strong>"as is"</strong> and{' '}
        <strong>"as available"</strong> basis. To the fullest extent permitted by law, we disclaim
        all warranties of any kind, whether express or implied, including warranties of
        merchantability, fitness for a particular purpose, non-infringement, and warranties as to
        the accuracy or reliability of any Content (including prayer times and religious material).
      </p>

      <h2>15. Limitation of Liability</h2>
      <p>To the fullest extent permitted by applicable law:</p>
      <ul>
        <li>
          We shall not be liable for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of profits, revenues, data, or goodwill arising out of or related to
          your use of the Services.
        </li>
        <li>
          Our total aggregate liability for any claims arising out of or related to the Services or
          these Terms shall not exceed the greater of (a) the amount you paid us for the Services in
          the twelve months preceding the event giving rise to the claim, or (b) one hundred U.S.
          dollars (US$100).
        </li>
      </ul>
      <p>
        Some jurisdictions do not allow certain limitations of liability; in those jurisdictions the
        above limitations apply only to the extent permitted by law.
      </p>

      <h2>16. Indemnity</h2>
      <p>
        You agree to indemnify, defend, and hold harmless SalatHub, our affiliates, and our
        respective officers, employees, and agents from and against any claims, liabilities,
        damages, losses, and expenses (including reasonable legal fees) arising out of or in any way
        connected with:
      </p>
      <ul>
        <li>Your use of the Services;</li>
        <li>Your User Content;</li>
        <li>Your violation of these Terms;</li>
        <li>Your violation of any rights of another person or entity.</li>
      </ul>

      <h2>17. Termination</h2>
      <p>
        You may stop using the Services at any time. We may suspend or terminate your access to the
        Services at any time, with or without notice, if we reasonably believe you have violated
        these Terms or if we are required to do so by law. Upon termination, the sections of these
        Terms that by their nature should survive (including intellectual property, disclaimers,
        limitation of liability, and indemnity) will continue to apply.
      </p>

      <h2>18. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we will revise the "Last updated"
        date at the top of this page. For material changes, we will take reasonable steps to notify
        you. Your continued use of the Services after such changes constitutes acceptance of the
        updated Terms.
      </p>

      <h2>19. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of New Jersey, United States, without
        regard to its conflict-of-law rules. Nothing in these Terms removes any protection you have
        under the consumer laws of the place where you live.
      </p>

      <h2>20. Contact Us</h2>
      <p>
        If you have any questions about these Terms, please contact us through the in-app Support
        page or by email at{' '}
        <a href='mailto:admin@shaykhrahmatalamjan.com'>admin@shaykhrahmatalamjan.com</a>.
      </p>
    </LegalLayout>
  );
}
