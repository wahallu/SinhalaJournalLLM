import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  Fingerprint,
  Heart,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { getCategories, saveOnboarding, setMyCategory } from '../services/api';
import { useAuth } from '../auth/useAuth';
import { JOURNALISM_INTERESTS, NEWSROOM_ROLES } from './onboarding/options';

const INPUT_CLASS = `w-full min-h-12 px-3.5 rounded-xl border border-ink-200 bg-white dark:bg-ink-50 text-[14px]
  text-ink-900 placeholder:text-ink-400 transition-colors outline-none hover:border-ink-300
  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10`;

const PROFILE_TABS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'newsroom', label: 'Newsroom', icon: BriefcaseBusiness },
  { id: 'interests', label: 'Interests', icon: Heart },
  { id: 'personalization', label: 'Personalization', icon: Brain },
  { id: 'security', label: 'Security', icon: LockKeyhole },
];

function ProfileNav({ activeTab, onChange }) {
  const handleKeyDown = (event, currentIndex) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % PROFILE_TABS.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + PROFILE_TABS.length) % PROFILE_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = PROFILE_TABS.length - 1;
    }

    const nextTab = PROFILE_TABS[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`profile-tab-${nextTab.id}`)?.focus());
  };

  return (
    <nav
      className="flex gap-1 overflow-x-auto px-4 pb-4 sm:flex-col sm:overflow-visible sm:px-5 sm:pb-0"
      aria-label="Profile sections"
      role="tablist"
      aria-orientation="vertical"
    >
      {PROFILE_TABS.map(({ id, label, icon: Icon }, index) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            id={`profile-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`profile-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-left text-[13.5px]
              font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
              ${selected
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}
          >
            <Icon size={18} strokeWidth={1.9} className="shrink-0" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function PanelHeading({ title, description }) {
  return (
    <div className="border-b border-ink-200/80 px-5 py-5 sm:px-8 sm:py-6">
      <h2 className="text-[20px] font-bold tracking-tight text-ink-950 sm:text-[23px]">{title}</h2>
      {description && <p className="mt-1 text-[12.5px] text-ink-500">{description}</p>}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, valueClassName = '', children }) {
  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 dark:bg-ink-50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon size={19} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        {children ?? (
          <p className={`mt-1 truncate text-[14px] font-semibold text-ink-900 ${valueClassName}`} title={value}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptySelection({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-5 text-center text-[12.5px] text-ink-500">
      {children}
    </p>
  );
}

export default function ProfilePage({ onBack, variant = 'page' }) {
  const asDialog = variant === 'dialog';
  const { user, profile, refreshAccount } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [roles, setRoles] = useState(profile?.newsroom_roles ?? []);
  const [interests, setInterests] = useState(profile?.journalism_interests ?? []);
  const [categoryId, setCategoryId] = useState(profile?.category_id ?? '');
  const [saveState, setSaveState] = useState('idle');
  const [error, setError] = useState('');

  const email = user?.email ?? '';
  const accountRole = profile?.role === 'admin' ? 'Administrator' : 'Member';
  const displayName = name.trim() || email.split('@')[0] || 'SinAi member';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    getCategories()
      .then((data) => { if (active) setCategories(data ?? []); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [user]);

  const original = useMemo(() => ({
    name: profile?.full_name ?? '',
    roles: profile?.newsroom_roles ?? [],
    interests: profile?.journalism_interests ?? [],
    categoryId: profile?.category_id ?? '',
  }), [profile]);

  const dirty = name.trim() !== original.name.trim()
    || JSON.stringify(roles) !== JSON.stringify(original.roles)
    || JSON.stringify(interests) !== JSON.stringify(original.interests)
    || categoryId !== original.categoryId;

  const roleLabels = roles
    .map((id) => NEWSROOM_ROLES.find((role) => role.id === id)?.label)
    .filter(Boolean);
  const interestLabels = interests
    .map((id) => JOURNALISM_INTERESTS.find((interest) => interest.id === id)?.label)
    .filter(Boolean);
  const categoryName = categories.find((category) => category.id === categoryId)?.name ?? 'Not specified';
  const shortAccountId = profile?.id ? profile.id.slice(0, 8).toUpperCase() : 'Not available';
  const profileSetUp = profile?.onboarding_completed_at
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
      .format(new Date(profile.onboarding_completed_at))
    : 'Not completed';

  const toggleRole = (id) => {
    setSaveState('idle');
    setRoles((current) => current.includes(id)
      ? current.filter((role) => role !== id)
      : [...current, id]);
  };

  const toggleInterest = (id) => {
    setSaveState('idle');
    setInterests((current) => {
      if (current.includes(id)) return current.filter((interest) => interest !== id);
      if (current.length >= 8) return current;
      return [...current, id];
    });
  };

  const reset = () => {
    setName(original.name);
    setRoles(original.roles);
    setInterests(original.interests);
    setCategoryId(original.categoryId);
    setSaveState('idle');
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (!dirty || !name.trim() || saveState === 'saving') return;
    setSaveState('saving');
    setError('');
    try {
      await Promise.all([
        saveOnboarding({
          full_name: name.trim(),
          newsroom_roles: roles,
          journalism_interests: interests,
        }),
        setMyCategory(categoryId),
      ]);
      await refreshAccount();
      setSaveState('saved');
    } catch (err) {
      setError(err.message || 'We could not save your profile. Please try again.');
      setSaveState('error');
    }
  };

  return (
    <div className={asDialog ? '' : 'mx-auto max-w-6xl'}>
      {!asDialog && (
        <PageHeader
          icon={UserRound}
          title="Your profile"
          description="Personalize how SinAi supports your newsroom work."
          actions={(
            <ActionButton size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
              Dashboard
            </ActionButton>
          )}
        />
      )}

      <form
        onSubmit={save}
        className={`flex flex-col overflow-hidden bg-white dark:bg-ink-50 sm:h-[86vh] sm:min-h-[36rem] sm:max-h-[78rem] sm:flex-row
          ${asDialog ? 'rounded-2xl' : 'rounded-2xl border border-ink-200/80 shadow-card'}`}
      >
        <aside className="shrink-0 border-b border-ink-200/80 bg-white dark:bg-ink-50 sm:w-[15.5rem] sm:border-b-0 sm:border-r lg:w-[24rem]">
          <div className={`flex h-[4.6rem] items-center border-ink-200/80 px-5 sm:border-b ${asDialog ? 'pl-16' : ''}`}>
            <h1 className="text-[18px] font-bold tracking-tight text-ink-950">Profile</h1>
          </div>
          <ProfileNav activeTab={activeTab} onChange={setActiveTab} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-ink-50">
          <div
            id={`profile-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`profile-tab-${activeTab}`}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
          >
            {activeTab === 'account' && (
              <>
                <PanelHeading title="Account" description="Your identity and account information." />
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

                  <div className="mt-8 grid gap-3 lg:grid-cols-2">
                    <InfoCard icon={Mail} label="Email address" value={email || 'Not available'} />
                    <InfoCard icon={Fingerprint} label="Account ID" value={shortAccountId} />
                    <InfoCard icon={CalendarDays} label="Profile set up" value={profileSetUp} />
                    <InfoCard icon={UserRound} label="Display name">
                      <input
                        id="profile-name"
                        className="mt-0.5 w-full border-0 bg-transparent p-0 text-[14px] font-semibold text-ink-900 outline-none placeholder:text-ink-400 focus:ring-0"
                        value={name}
                        onChange={(event) => { setName(event.target.value); setSaveState('idle'); }}
                        placeholder="Add your name"
                        aria-label="Display name"
                        autoComplete="nickname"
                        maxLength={60}
                        required
                      />
                    </InfoCard>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'newsroom' && (
              <>
                <PanelHeading title="Newsroom" description="Choose the roles and community that best describe your work." />
                <div className="space-y-8 p-5 sm:p-8">
                  <section>
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-[14px] font-bold text-ink-900">Your newsroom roles</h3>
                        <p className="mt-1 text-[12px] text-ink-500">Select every role that reflects the work you do.</p>
                      </div>
                      <span className="text-[11px] font-semibold text-ink-400">{roles.length} selected</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2" aria-label="Your newsroom roles">
                      {NEWSROOM_ROLES.map((role) => {
                        const selected = roles.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleRole(role.id)}
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
                  </section>

                  <section>
                    <label htmlFor="profile-category" className="mb-1.5 block text-[12px] font-semibold text-ink-700">
                      Newsroom category
                    </label>
                    <div className="relative max-w-md">
                      <select
                        id="profile-category"
                        className={`${INPUT_CLASS} cursor-pointer appearance-none pr-10`}
                        value={categoryId}
                        onChange={(event) => { setCategoryId(event.target.value); setSaveState('idle'); }}
                      >
                        <option value="">Not specified</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">⌄</span>
                    </div>
                  </section>
                </div>
              </>
            )}

            {activeTab === 'interests' && (
              <>
                <PanelHeading title="Interests" description="Select up to eight beats to personalize your SinAi experience." />
                <div className="p-5 sm:p-8">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <p className="text-[12.5px] leading-relaxed text-ink-500">Choose the topics you report on or follow most closely.</p>
                    <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
                      {interests.length}/8 selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5" aria-label="Your journalism interests">
                    {JOURNALISM_INTERESTS.map((interest) => {
                      const selected = interests.includes(interest.id);
                      const unavailable = !selected && interests.length >= 8;
                      return (
                        <button
                          key={interest.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={unavailable}
                          onClick={() => toggleInterest(interest.id)}
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
                </div>
              </>
            )}

            {activeTab === 'personalization' && (
              <>
                <PanelHeading title="Personalization" description="A clear view of the profile context SinAi uses to tailor your workspace." />
                <div className="space-y-5 p-5 sm:p-8">
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 dark:bg-ink-50">
                        <Brain size={19} />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-bold text-ink-900">Your saved workspace context</h3>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                          SinAi uses the newsroom details you choose here to make the workspace feel more relevant. You can change or remove them at any time.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-2xl border border-ink-200 p-5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-bold text-ink-900">Newsroom context</h3>
                        <button type="button" onClick={() => setActiveTab('newsroom')} className="text-[11.5px] font-semibold text-brand-700 hover:text-brand-800">
                          Edit
                        </button>
                      </div>
                      {roleLabels.length || categoryId ? (
                        <div className="flex flex-wrap gap-2">
                          {roleLabels.map((role) => (
                            <span key={role} className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium text-ink-700">{role}</span>
                          ))}
                          {categoryId && (
                            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-medium text-brand-800">{categoryName}</span>
                          )}
                        </div>
                      ) : (
                        <EmptySelection>No newsroom context selected yet.</EmptySelection>
                      )}
                    </section>

                    <section className="rounded-2xl border border-ink-200 p-5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-bold text-ink-900">Topics you follow</h3>
                        <button type="button" onClick={() => setActiveTab('interests')} className="text-[11.5px] font-semibold text-brand-700 hover:text-brand-800">
                          Edit
                        </button>
                      </div>
                      {interestLabels.length ? (
                        <div className="flex flex-wrap gap-2">
                          {interestLabels.map((interest) => (
                            <span key={interest} className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium text-ink-700">{interest}</span>
                          ))}
                        </div>
                      ) : (
                        <EmptySelection>No journalism interests selected yet.</EmptySelection>
                      )}
                    </section>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'security' && (
              <>
                <PanelHeading title="Security" description="Account access and verification details." />
                <div className="space-y-4 p-5 sm:p-8">
                  <InfoCard icon={AtSign} label="Sign-in email" value={email || 'Not available'} />
                  <InfoCard
                    icon={BadgeCheck}
                    label="Email verification"
                    value={profile?.email_verified ? 'Verified' : 'Verification pending'}
                    valueClassName={profile?.email_verified ? 'text-emerald-700' : 'text-amber-700'}
                  />
                  <InfoCard
                    icon={ShieldCheck}
                    label="Account status"
                    value={profile?.status === 'active' ? 'Active' : (profile?.status || 'Unknown')}
                    valueClassName={profile?.status === 'active' ? 'text-emerald-700' : ''}
                  />
                  <div className="flex items-start gap-3 rounded-2xl bg-ink-50 p-4">
                    <LockKeyhole size={17} className="mt-0.5 shrink-0 text-ink-500" />
                    <p className="text-[12px] leading-relaxed text-ink-600">
                      Your email address, password, and access level are managed securely and cannot be edited from this profile screen.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-ink-200/80 bg-white/95 px-5 py-3.5 backdrop-blur dark:bg-ink-50/95 sm:static sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5">
                {saveState === 'saved' && (
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700" role="status">
                    <CheckCircle2 size={14} /> Profile saved
                  </p>
                )}
                {error && <p className="text-[12px] text-brand-700" role="alert">{error}</p>}
                {!error && saveState !== 'saved' && dirty && (
                  <p className="text-[11.5px] text-ink-500">You have unsaved changes</p>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ActionButton variant="ghost" onClick={reset} disabled={!dirty || saveState === 'saving'}>
                  Discard
                </ActionButton>
                <ActionButton
                  type="submit"
                  variant="primary"
                  icon={Save}
                  loading={saveState === 'saving'}
                  disabled={!dirty || !name.trim()}
                  className="rounded-full px-5"
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save changes'}
                </ActionButton>
              </div>
            </div>
          </footer>
        </div>
      </form>
    </div>
  );
}
