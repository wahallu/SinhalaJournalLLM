import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  LockKeyhole,
  Save,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { getCategories, saveOnboarding, setMyCategory } from '../services/api';
import { useAuth } from '../auth/useAuth';
import { NEWSROOM_ROLES } from './onboarding/options';
import ProfileNav from './profile/ProfileNav';
import AccountPanel from './profile/AccountPanel';
import PreferencesPanel from './profile/PreferencesPanel';
import UsagePanel from './profile/UsagePanel';
import SecurityPanel from './profile/SecurityPanel';

/**
 * Three tabs, down from five.
 *
 * Newsroom and Interests merged into Preferences as collapsible groups, and
 * Personalization went with them — it was a read-only mirror of those two,
 * with Edit links pointing at the very tabs it now lives beside.
 *
 * This component keeps what the panels cannot own individually: the form
 * state, the dirty check, and the single save that writes all four fields
 * together. The panels are presentational.
 */

const PROFILE_TABS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'usage', label: 'Usage', icon: Activity },
  { id: 'security', label: 'Security', icon: LockKeyhole },
];

function PanelHeading({ title, description }) {
  return (
    <div className="border-b border-ink-200/80 px-5 py-5 sm:px-8 sm:py-6">
      <h2 className="text-[20px] font-bold tracking-tight text-ink-950 sm:text-[23px]">{title}</h2>
      {description && <p className="mt-1 text-[12.5px] text-ink-500">{description}</p>}
    </div>
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
        <aside className="shrink-0 border-b border-ink-200/80 bg-white dark:bg-ink-50 sm:w-[15.5rem] sm:border-b-0 sm:border-r lg:w-[18rem]">
          <div className={`flex h-[4.6rem] items-center border-ink-200/80 px-5 sm:border-b ${asDialog ? 'pl-16' : ''}`}>
            <h1 className="text-[18px] font-bold tracking-tight text-ink-950">Profile</h1>
          </div>
          <ProfileNav tabs={PROFILE_TABS} activeTab={activeTab} onChange={setActiveTab} />
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
                <AccountPanel
                  displayName={displayName}
                  initials={initials}
                  accountRole={accountRole}
                  roleLabels={roleLabels}
                  name={name}
                  onNameChange={(value) => { setName(value); setSaveState('idle'); }}
                />
              </>
            )}

            {activeTab === 'preferences' && (
              <>
                <PanelHeading
                  title="Preferences"
                  description="The newsroom context SinAi uses to tailor your workspace."
                />
                <PreferencesPanel
                  roles={roles}
                  onToggleRole={toggleRole}
                  interests={interests}
                  onToggleInterest={toggleInterest}
                  categories={categories}
                  categoryId={categoryId}
                  onCategoryChange={(value) => { setCategoryId(value); setSaveState('idle'); }}
                />
              </>
            )}

            {activeTab === 'usage' && (
              <>
                <PanelHeading
                  title="Usage"
                  description="Today's requests against your plan, and your recent activity."
                />
                <UsagePanel />
              </>
            )}

            {activeTab === 'security' && (
              <>
                <PanelHeading title="Security" description="Account access and verification details." />
                <SecurityPanel email={email} emailVerified={profile?.email_verified} />
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
