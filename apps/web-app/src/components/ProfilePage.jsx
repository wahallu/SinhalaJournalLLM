import { useState } from 'react';
import { User, Camera } from 'lucide-react';

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

export default function ProfilePage() {
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

  const labelClass = "block text-base font-medium text-gray-700 mb-2";
  const inputClass = "w-full px-4 py-3 text-[15px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200";
  const selectClass = `${inputClass} bg-white cursor-pointer`;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1.5">Profile</h1>
      <p className="text-base text-gray-400 mb-7">Manage your account details.</p>

      <div className="space-y-7">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
              <User size={30} className="text-gray-400" />
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-gray-200 rounded-full
                flex items-center justify-center shadow-sm hover:bg-gray-50 cursor-pointer"
              title="Change avatar"
            >
              <Camera size={13} className="text-gray-500" />
            </button>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">{profile.name}</p>
            <p className="text-sm text-gray-400">{profile.role}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Personal Information</h2>
          <div className="space-y-5">
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
              <label htmlFor="profile-email" className={labelClass}>Email</label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass}
              />
            </div>

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
                placeholder="e.g. Daily News, Lankadeepa"
                className={`${inputClass} placeholder-gray-300`}
              />
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        <div className="flex items-center gap-3">
          <button
            id="save-profile"
            onClick={handleSave}
            className="px-6 py-2.5 bg-accent text-white text-base font-medium rounded-lg
              hover:bg-accent-hover active:scale-[0.98] transition-all duration-100 cursor-pointer"
          >
            {saved ? 'Saved ✓' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
