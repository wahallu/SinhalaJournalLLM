import { useState } from 'react';
import { User, Camera, ArrowLeft, Shield, Building2, CheckCircle2 } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import { Card } from './ui/Card';

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
