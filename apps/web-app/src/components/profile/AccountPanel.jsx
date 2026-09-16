import { ShieldCheck, UserRound } from 'lucide-react';
import InfoCard from './InfoCard';

/**
 * Identity, and the one account field a user can actually edit.
 *
 * Account ID and "Profile set up" used to sit here as InfoCards. Both were
 * removed: a truncated UUID fragment is not an identifier support ever asks
 * for, and a month-precision setup date is not something a user can act on.
 * The email card went too — Security already shows it as the sign-in email,
 * and stating it twice on one screen made the page look fuller than it is.
 */
export default function AccountPanel({
  displayName, initials, accountRole, roleLabels, name, onNameChange,
}) {
  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[22px] bg-ink-950 text-[27px] font-bold text-white shadow-sm">
          {initials || 'S'}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[22px] font-bold tracking-tight text-ink-950">{displayName}</h3>
          <p className="mt-0.5 truncate text-[13.5px] text-ink-500">
            {roleLabels.length ? roleLabels.join(' · ') : 'SinAi newsroom workspace'}
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-700">
            <ShieldCheck size={12} /> {accountRole}
          </span>
        </div>
      </div>

      <div className="mt-8 max-w-md">
        <InfoCard icon={UserRound} label="Display name">
          <input
            id="profile-name"
            className="mt-0.5 w-full border-0 bg-transparent p-0 text-[14px] font-semibold text-ink-900 outline-none placeholder:text-ink-400 focus:ring-0"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Add your name"
            aria-label="Display name"
            autoComplete="nickname"
            maxLength={60}
            required
          />
        </InfoCard>
      </div>
    </div>
  );
}
