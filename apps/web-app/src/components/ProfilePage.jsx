import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Newspaper,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { getCategories, saveOnboarding, setMyCategory } from '../services/api';
import { useAuth } from '../auth/useAuth';
import { JOURNALISM_INTERESTS, NEWSROOM_ROLES } from './onboarding/options';

const INPUT_CLASS = `w-full min-h-12 px-3.5 rounded-xl border border-ink-200 bg-white text-[14px]
  text-ink-900 placeholder:text-ink-400 transition-colors outline-none hover:border-ink-300
  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10`;

function ProfileSection({ icon: Icon, title, description, children }) {
  return (
    <section className="px-5 py-5 sm:px-6 sm:py-6 border-b border-ink-100 last:border-b-0">
      <div className="flex items-start gap-3.5 mb-5">
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Icon size={17} className="text-brand-600" strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-ink-900">{title}</h2>
          <p className="text-[12px] leading-relaxed text-ink-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ProfilePage({ onBack, variant = 'page' }) {
  const asDialog = variant === 'dialog';
  const { user, profile, refreshAccount } = useAuth();
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
    <div className={asDialog ? '' : 'max-w-3xl mx-auto'}>
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

      <form onSubmit={save} className={`overflow-hidden bg-white ${asDialog ? 'rounded-2xl' : 'rounded-2xl border border-ink-200/80 shadow-card'}`}>
        <header className="relative overflow-hidden px-5 pt-6 pb-5 sm:px-7 sm:pt-7 sm:pb-6 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white">
          <div className="absolute -right-20 -top-28 w-64 h-64 rounded-full border-[38px] border-white/5 pointer-events-none" />
          <div className="relative flex items-center gap-4 pr-10">
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/15 border border-white/20
              flex items-center justify-center text-[21px] font-bold tracking-tight shadow-lg shadow-brand-950/15 shrink-0">
              {initials || 'S'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[21px] sm:text-[24px] font-bold tracking-tight leading-tight break-words">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/12 border border-white/15 px-2 py-1 text-[10.5px] font-semibold text-white/90">
                  <ShieldCheck size={11} /> {accountRole}
                </span>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/75 break-all">
                <AtSign size={12} className="shrink-0" /> {email}
              </p>
            </div>
          </div>
        </header>

        <div className="bg-white">
          <ProfileSection
            icon={UserRound}
            title="How should we address you?"
            description="This name appears in your workspace greeting and account menu."
          >
            <label htmlFor="profile-name" className="block text-[12px] font-semibold text-ink-700 mb-1.5">
              What your friends call you
            </label>
            <input
              id="profile-name"
              className={INPUT_CLASS}
              value={name}
              onChange={(event) => { setName(event.target.value); setSaveState('idle'); }}
              placeholder="Nickname"
              autoComplete="nickname"
              maxLength={60}
              required
            />
          </ProfileSection>

          <ProfileSection
            icon={BriefcaseBusiness}
            title="Your newsroom roles"
            description="Choose every role that reflects the work you do."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" aria-label="Your newsroom roles">
              {NEWSROOM_ROLES.map((role) => {
                const selected = roles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleRole(role.id)}
                    className={`group min-h-[66px] px-3.5 py-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer
                      transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                      ${selected
                        ? 'border-brand-600 bg-brand-50 shadow-sm'
                        : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/50'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors
                      ${selected ? 'bg-brand-700 border-brand-700 text-white' : 'border-ink-300 text-transparent group-hover:border-brand-300'}`}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-ink-900 leading-tight">{role.label}</span>
                      <span className="block mt-1 text-[11px] leading-snug text-ink-500">{role.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </ProfileSection>

          <ProfileSection
            icon={Sparkles}
            title="Journalism interests"
            description="Select up to eight areas to personalize your SinAi experience."
          >
            <div className="flex flex-wrap gap-2" aria-label="Your journalism interests">
              {JOURNALISM_INTERESTS.map((interest) => {
                const selected = interests.includes(interest.id);
                const unavailable = !selected && interests.length >= 8;
                return (
                  <button
                    key={interest.id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={unavailable}
                    onClick={() => toggleInterest(interest.id)}
                    className={`min-h-10 px-3.5 rounded-full border text-[12.5px] font-semibold cursor-pointer transition-colors
                      focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15
                      ${selected
                        ? 'border-brand-700 bg-brand-50 text-brand-800'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/60'}
                      ${unavailable ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {interest.label}
                  </button>
                );
              })}
            </div>
          </ProfileSection>

          <ProfileSection
            icon={Newspaper}
            title="Newsroom category"
            description="Tell us which community best describes how you use SinAi."
          >
            <label htmlFor="profile-category" className="block text-[12px] font-semibold text-ink-700 mb-1.5">
              Category
            </label>
            <div className="relative">
              <select
                id="profile-category"
                className={`${INPUT_CLASS} appearance-none pr-10 cursor-pointer`}
                value={categoryId}
                onChange={(event) => { setCategoryId(event.target.value); setSaveState('idle'); }}
              >
                <option value="">Not specified</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">⌄</span>
            </div>
          </ProfileSection>

          <section className="px-5 py-4 sm:px-6 bg-ink-50/65">
            <div className="flex items-start gap-2.5">
              <BadgeCheck size={16} className="text-brand-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-ink-700">Account details are protected</p>
                <p className="text-[11px] leading-relaxed text-ink-500 mt-0.5">
                  Your email address and access level are managed securely and cannot be changed here.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="sticky bottom-0 z-10 px-5 py-4 sm:px-6 bg-white/95 backdrop-blur border-t border-ink-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-h-5">
              {saveState === 'saved' && (
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700" role="status">
                  <CheckCircle2 size={14} /> Profile saved
                </p>
              )}
              {error && <p className="text-[12px] text-brand-700" role="alert">{error}</p>}
            </div>
            <div className="flex items-center gap-2 ml-auto">
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
      </form>
    </div>
  );
}
