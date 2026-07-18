import { useState } from 'react';
import { User, Camera, ArrowLeft, Shield, Building2, Mail } from 'lucide-react';

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

  const labelClass = 'block text-sm font-medium text-gray-600 mb-1.5';
  const inputClass =
    'w-full px-4 py-3 text-[15px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#cd191a]/50 focus:ring-2 focus:ring-[#cd191a]/10 transition-all duration-150 bg-white';
  const selectClass = `${inputClass} cursor-pointer`;

  return (
    <div className="max-w-xl">
      {/* Back button header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          id="profile-back"
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-gray-400
            hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50
            transition-all duration-150 cursor-pointer shrink-0"
          title="Back to Dashboard"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">Profile</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your account details</p>
        </div>
      </div>

      <div className="space-y-7">
        {/* Avatar card */}
        <div className="flex items-center gap-5 p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#cd191a]/15 to-[#cd191a]/5
              border-2 border-[#cd191a]/20 flex items-center justify-center">
              <User size={30} className="text-[#cd191a]/60" />
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-gray-200 rounded-full
                flex items-center justify-center shadow-sm hover:bg-gray-50 hover:border-gray-300
                cursor-pointer transition-all duration-150"
              title="Change avatar"
            >
              <Camera size={13} className="text-gray-500" />
            </button>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">{profile.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield size={12} className="text-[#cd191a]" />
              <p className="text-sm text-gray-500">{profile.role}</p>
            </div>
            {profile.organization && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={12} className="text-gray-400" />
                <p className="text-sm text-gray-400">{profile.organization}</p>
              </div>
            )}
          </div>
        </div>

        {/* Personal information */}
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className={labelClass}>Full Name</label>
              <input
                id="profile-name"
                type="text"
                value={profile.name}
                onChange={(e) => update('name', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="profile-email" className={labelClass}>
                <span className="flex items-center gap-1.5">
                  <Mail size={12} />
                  Email Address
                </span>
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-role" className={labelClass}>Role</label>
                <select
                  id="profile-role"
                  value={profile.role}
                  onChange={(e) => update('role', e.target.value)}
                  className={selectClass}
                >
                  <option value="Journalist">Journalist</option>
                  <option value="Editor">Editor</option>
                  <option value="Content Creator">Content Creator</option>
                  <option value="Sub-editor">Sub-editor</option>
                  <option value="Correspondent">Correspondent</option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-org" className={labelClass}>Organization</label>
                <input
                  id="profile-org"
                  type="text"
                  value={profile.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder="e.g. Daily News"
                  className={`${inputClass} placeholder-gray-300`}
                />
              </div>
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        <div className="flex items-center gap-3">
          <button
            id="save-profile"
            onClick={handleSave}
            className={`px-6 py-2.5 text-white text-sm font-semibold rounded-xl
              active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm
              ${saved
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-[#cd191a] hover:bg-[#b01517]'}`}
          >
            {saved ? '✓ Saved' : 'Save Profile'}
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 text-sm font-medium text-gray-400 rounded-xl
              hover:text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200
              transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
