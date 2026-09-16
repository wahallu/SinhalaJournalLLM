import { Check } from 'lucide-react';
import CollapsibleGroup from './CollapsibleGroup';
import { JOURNALISM_INTERESTS, NEWSROOM_ROLES } from '../onboarding/options';

/**
 * Everything SinAi uses to tailor the workspace, on one panel.
 *
 * Replaces three tabs. Newsroom and Interests were separate screens, and
 * "Personalization" was a third that held no state of its own — it mirrored
 * the other two as read-only chips with Edit links pointing back at them.
 * Once those two merge, a mirror of them inside the merged panel is circular,
 * so it was deleted rather than moved.
 */

const INPUT_CLASS = `w-full min-h-12 px-3.5 rounded-xl border border-ink-200 bg-white dark:bg-ink-50 text-[14px]
  text-ink-900 placeholder:text-ink-400 transition-colors outline-none hover:border-ink-300
  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10`;

const MAX_INTERESTS = 8;

export default function PreferencesPanel({
  roles, onToggleRole,
  interests, onToggleInterest,
  categories, categoryId, onCategoryChange,
}) {
  const roleLabels = roles
    .map((id) => NEWSROOM_ROLES.find((role) => role.id === id)?.label)
    .filter(Boolean);
  const categoryName = categories.find((category) => category.id === categoryId)?.name;
  const interestLabels = interests
    .map((id) => JOURNALISM_INTERESTS.find((interest) => interest.id === id)?.label)
    .filter(Boolean);

  return (
    <div className="space-y-3 p-5 sm:p-8">
      <CollapsibleGroup
        id="roles"
        title="Newsroom roles"
        defaultOpen
        summary={roleLabels.length ? roleLabels.join(' · ') : 'None selected yet'}
      >
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-500">
          Select every role that reflects the work you do.
        </p>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" aria-label="Your newsroom roles">
          {NEWSROOM_ROLES.map((role) => {
            const selected = roles.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleRole(role.id)}
                className={`group flex min-h-[66px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left
                  transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                  ${selected
                    ? 'border-brand-600 bg-brand-50 shadow-sm'
                    : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 dark:bg-ink-50'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors
                  ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 text-transparent group-hover:border-brand-300'}`}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-tight text-ink-900">{role.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-ink-500">{role.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        id="category"
        title="Newsroom category"
        summary={categoryName ?? 'Not specified'}
      >
        <label htmlFor="profile-category" className="mb-1.5 block text-[12px] font-semibold text-ink-700">
          Choose the community closest to your work
        </label>
        <div className="relative max-w-md">
          <select
            id="profile-category"
            className={`${INPUT_CLASS} cursor-pointer appearance-none pr-10`}
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">Not specified</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">⌄</span>
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        id="interests"
        title="Interests"
        summary={
          interestLabels.length
            ? `${interestLabels.length} of ${MAX_INTERESTS} · ${interestLabels.join(', ')}`
            : 'None selected yet'
        }
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[12.5px] leading-relaxed text-ink-500">
            Choose the topics you report on or follow most closely.
          </p>
          <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
            {interests.length}/{MAX_INTERESTS} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5" aria-label="Your journalism interests">
          {JOURNALISM_INTERESTS.map((interest) => {
            const selected = interests.includes(interest.id);
            const unavailable = !selected && interests.length >= MAX_INTERESTS;
            return (
              <button
                key={interest.id}
                type="button"
                aria-pressed={selected}
                disabled={unavailable}
                onClick={() => onToggleInterest(interest.id)}
                className={`min-h-11 cursor-pointer rounded-full border px-4 text-[12.5px] font-semibold transition-colors
                  focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                  disabled:cursor-not-allowed disabled:opacity-40
                  ${selected
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/60 dark:bg-ink-50'}`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      </CollapsibleGroup>
    </div>
  );
}
