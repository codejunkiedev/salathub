import { Link } from 'react-router';
import { PublicRoutes } from '@/constants/routes';
import { LegalLayout } from './legal-layout';

export default function RefundPolicy() {
  return (
    <LegalLayout title='Refund Policy' lastUpdated='12 November 2026'>
      <p>
        This policy explains when you can get your money back for a SalatHub Pro subscription. It
        forms part of our <Link to={PublicRoutes.TermsConditions}>Terms &amp; Conditions</Link>.
        SalatHub is operated by Collections of Shaykh Rahmat Alam Jan LLC.
      </p>

      <h2>1. Full refund within 14 days</h2>
      <p>
        You can ask for a full refund of any charge within <strong>14 days</strong> of the date it
        was made. This applies to:
      </p>
      <ul>
        <li>the first payment for Pro;</li>
        <li>each yearly renewal;</li>
        <li>additional screens bought part-way through a year.</li>
      </ul>
      <p>
        When a Pro payment or renewal is refunded, the subscription is cancelled and the masjid
        moves to the Free plan straight away. When a charge for additional screens is refunded,
        those screens are removed from the subscription. Nothing is deleted in either case.
      </p>

      <h2>2. After 14 days</h2>
      <p>
        After 14 days, charges are not refundable. You can still cancel at any time from the Billing
        page of the console: Pro stays active until the end of the year already paid for, and it is
        not renewed or charged again.
      </p>
      <p>
        If you remove additional screens part-way through a year, the unused part is credited
        against your next charge. Credits are not paid out in cash.
      </p>

      <h2>3. Free trial</h2>
      <p>
        The 30-day Pro trial is free and needs no card, so there is nothing to refund. When it ends
        without an upgrade, the masjid moves to the Free plan and is not charged.
      </p>

      <h2>4. Renewal reminders</h2>
      <p>
        We email the masjid's administrator about 30 days before each yearly renewal, so there is
        time to cancel before you are charged.
      </p>

      <h2>5. How to ask for a refund</h2>
      <p>
        Email <a href='mailto:admin@shaykhrahmatalamjan.com'>admin@shaykhrahmatalamjan.com</a> from
        the administrator's email address, with the masjid's name and the date of the charge.
        Refunds go back to the original payment method, in the currency you paid in, usually within
        5 to 10 business days of approval. Any sales tax charged is refunded with it. Fees your own
        bank added, such as foreign-transaction fees, are outside our control and can't be refunded
        by us.
      </p>

      <h2>6. Your legal rights</h2>
      <p>
        This policy does not affect any right to a refund that you have under the law of the place
        where you live.
      </p>
    </LegalLayout>
  );
}
