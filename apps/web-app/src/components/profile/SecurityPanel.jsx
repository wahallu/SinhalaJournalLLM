import { AtSign, BadgeCheck } from 'lucide-react';
import InfoCard from './InfoCard';

/**
 * Account access facts.
 *
 * "Account status" was removed: it read "Active" for every user who could
 * reach this screen, because a suspended account cannot. So was the lock-icon
 * paragraph explaining which fields are not editable — on a panel where
 * nothing is editable, it explained the obvious.
 */
export default function SecurityPanel({ email, emailVerified }) {
  return (
    <div className="space-y-4 p-5 sm:p-8">
      <InfoCard icon={AtSign} label="Sign-in email" value={email || 'Not available'} />
      <InfoCard
        icon={BadgeCheck}
        label="Email verification"
        value={emailVerified ? 'Verified' : 'Verification pending'}
        valueClassName={emailVerified ? 'text-emerald-700' : 'text-amber-700'}
      />
    </div>
  );
}
