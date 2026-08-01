import { useEffect, useState } from 'react';
import { User, Camera, ArrowLeft, Shield, Building2, CheckCircle2, Tags } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { Card } from './ui/Card';
import { getCategories } from '../services/api';
import { useAuth } from '../auth/useAuth';
import supabase from '../auth/supabaseClient';

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem('sinai_profile') || '{}');
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem('sinai_profile', JSON.stringify(profile));
}

const DEFAULT_PROFILE = {
  name: 'Journalist',
  email: 'journalist@sinai.lk',
  role: 'Editor',
  organization: '',
};

const LABEL_CLASS = 'block text-[12.5px] font-semibold text-ink-700 mb-1.5';
const INPUT_CLASS = `w-full px-3.5 py-2.5 text-[14px] text-ink-800 border border-ink-200 rounded-xl bg-white
  placeholder:text-ink-400 transition-all duration-150
  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]`;
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer`;

export default function ProfilePage({ onBack }) {
  const [profile, setProfile] = useState(() => ({
    ...DEFAULT_PROFILE,
    ...getProfile(),
  }));
  const [saved, setSaved] = useState(false);

  const { user, profile: accountProfile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryState, setCategoryState] = useState('idle'); // idle | saving | saved | error
  const [categoryError, setCategoryError] = useState(null);

  // Derived rather than synced into state: the account profile is the source
  // of truth, and `pendingCategory` only holds the optimistic value between
  // the user picking one and the save landing.
  const [pendingCategory, setPendingCategory] = useState(null);
  const categoryId = pendingCategory ?? accountProfile?.category_id ?? '';

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    getCategories()
      .then((data) => active && setCategories(data))
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, [user]);

  const saveCategory = async (nextId) => {
    setPendingCategory(nextId);
    setCategoryState('saving');
    setCategoryError(null);
    // Written straight to Supabase: RLS lets a user update their own row,
    // and the guard_profile_privileges trigger blocks role/status changes
    // through this same path.
    const { error } = await supabase
      .from('profiles')
      .update({ category_id: nextId || null })
      .eq('id', user.id);

    if (error) {
      setCategoryState('error');
      setCategoryError(error.message);
      return;
    }
    setCategoryState('saved');
    setTimeout(() => setCategoryState('idle'), 2000);
  };

  const update = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = (profile.name || 'J')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div>
      <PageHeader
        icon={User}
        title="Profile"
        description="Manage your account details. Stored locally in this browser."
        actions={
          <ActionButton id="profile-back" size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
            Dashboard
          </ActionButton>
        }
      />

      <div className="space-y-4">
        {/* Category — synced to the account, unlike the fields below */}
        {user && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8.5 h-8.5 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Tags size={15} className="text-brand-600" strokeWidth={2.25} />
              </div>
              <div>
                <h2 className="text-[13.5px] font-bold text-ink-900">Your category</h2>
                <p className="text-[11.5px] text-ink-500 mt-0.5">
                  How you use SinAi. Saved to your account and visible to administrators.
                </p>
              </div>
            </div>

            <label htmlFor="user-category" className={LABEL_CLASS}>
              Category
            </label>
            <select
              id="user-category"
              value={categoryId}
              onChange={(e) => saveCategory(e.target.value)}
              disabled={categoryState === 'saving'}
              className={SELECT_CLASS}
            >
              <option value="">Not specified</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {categoryState === 'saving' && (
              <p className="text-[11.5px] text-ink-500 mt-2">Saving…</p>
            )}
            {categoryState === 'saved' && (
              <p className="flex items-center gap-1.5 text-[11.5px] text-emerald-600 mt-2">
                <CheckCircle2 size={12} /> Saved
              </p>
            )}
            {categoryState === 'error' && (
              <p role="alert" className="text-[11.5px] text-brand-700 mt-2">
                Could not save: {categoryError}
              </p>
            )}
          </Card>
        )}

        {/* Identity card */}
        <Card className="flex items-center gap-5 p-5 sm:p-6">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800
              flex items-center justify-center text-white text-[20px] font-bold shadow-sm shadow-brand-600/25">
              {initials}
            </div>
            <button
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white border border-ink-200 rounded-full
                flex items-center justify-center shadow-card hover:bg-ink-50 hover:border-ink-300
                cursor-pointer transition-all duration-150"
              title="Change avatar"
              aria-label="Change avatar"
            >
              <Camera size={12} className="text-ink-500" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-ink-900 truncate">{profile.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield size={12} className="text-brand-600 shrink-0" />
              <p className="text-[12.5px] text-ink-600">{profile.role}</p>
            </div>
            {profile.organization && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={12} className="text-ink-400 shrink-0" />
                <p className="text-[12.5px] text-ink-500 truncate">{profile.organization}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Personal information */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-[13.5px] font-bold text-ink-900 mb-4">Personal information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className={LABEL_CLASS}>Full name</label>
              <input
                id="profile-name"
                type="text"
                value={profile.name}
                onChange={(e) => update('name', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="profile-email" className={LABEL_CLASS}>Email address</label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(e) => update('email', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-role" className={LABEL_CLASS}>Role</label>
                <select
                  id="profile-role"
                  value={profile.role}
                  onChange={(e) => update('role', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="Journalist">Journalist</option>
                  <option value="Editor">Editor</option>
                  <option value="Content Creator">Content Creator</option>
                  <option value="Sub-editor">Sub-editor</option>
                  <option value="Correspondent">Correspondent</option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-org" className={LABEL_CLASS}>Organization</label>
                <input
                  id="profile-org"
                  type="text"
                  value={profile.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder="e.g. Daily News"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-2.5 pt-1">
          <ActionButton
            id="save-profile"
            variant="primary"
            size="lg"
            icon={saved ? CheckCircle2 : undefined}
            onClick={handleSave}
            className={saved ? '!bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-500/25' : ''}
          >
            {saved ? 'Saved' : 'Save profile'}
          </ActionButton>
          <ActionButton variant="ghost" size="lg" onClick={onBack}>
            Cancel
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
