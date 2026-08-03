import { useEffect, useState } from 'react';
import { User, ArrowLeft, Shield, CheckCircle2, Tags } from 'lucide-react';
import PageHeader from './ui/PageHeader';
import ActionButton from './ui/ActionButton';
import Dropdown from './ui/Dropdown';
import { Card } from './ui/Card';
import { getCategories, setMyCategory } from '../services/api';
import { useAuth } from '../auth/useAuth';

/**
 * Account page.
 *
 * Everything shown here comes from the session or the profiles row. The
 * previous version kept name/email/role/organization in localStorage with
 * placeholder defaults, so it looked like account settings while persisting
 * nothing to the account — only the category below ever reached Supabase.
 */
const LABEL_CLASS = 'block text-[12.5px] font-semibold text-ink-700 mb-1.5';

export default function ProfilePage({ onBack, variant = 'page' }) {
  const asDialog = variant === 'dialog';
  const { user, profile: accountProfile, refreshAccount } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryState, setCategoryState] = useState('idle'); // idle | saving | saved | error
  const [categoryError, setCategoryError] = useState(null);

  // Derived rather than synced into state: the account profile is the source
  // of truth, and `pendingCategory` only holds the optimistic value between
  // the user picking one and the save landing.
  const [pendingCategory, setPendingCategory] = useState(null);
  const categoryId = pendingCategory ?? accountProfile?.category_id ?? '';

  const email = user?.email ?? '';
  const role = accountProfile?.role === 'admin' ? 'Administrator' : 'Journalist';
  const initials = (email.split('@')[0] || 'S').slice(0, 2).toUpperCase();

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
    // Goes through the backend, which scopes the update to the caller and
    // writes only this column. It used to be a direct Supabase write from
    // the browser relying on RLS; there is no browser database access now.
    try {
      await setMyCategory(nextId);
      await refreshAccount();
      setCategoryState('saved');
      setTimeout(() => setCategoryState('idle'), 2000);
    } catch (err) {
      setCategoryState('error');
      setCategoryError(err.message);
    }
  };

  const categoryOptions = [
    { id: '', label: 'Not specified' },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];

  return (
    <div>
      {/* In a dialog the surrounding chrome already carries the title and a
          close button, so the page header would be a second one. */}
      {!asDialog && (
        <PageHeader
          icon={User}
          title="Profile"
          description="Your account and how you use SinAi."
          actions={
            <ActionButton id="profile-back" size="sm" variant="ghost" icon={ArrowLeft} onClick={onBack}>
              Dashboard
            </ActionButton>
          }
        />
      )}

      <div className="space-y-4">
        {/* Account — read-only, from the session */}
        <Card className={`flex items-center gap-5 ${asDialog ? 'p-4' : 'p-5 sm:p-6'}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800
            flex items-center justify-center text-white text-[20px] font-bold shadow-sm shadow-brand-600/25 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-ink-900 truncate">{email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield size={12} className="text-brand-600 shrink-0" />
              <p className="text-[12.5px] text-ink-600">{role}</p>
            </div>
            <p className="text-[11.5px] text-ink-400 mt-1.5">
              Your email and role are managed by your account and cannot be edited here.
            </p>
          </div>
        </Card>

        {/* Category — the one field on this page that reaches the account */}
        {user && (
          <Card className={asDialog ? 'p-4' : 'p-5 sm:p-6'}>
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

            <label className={LABEL_CLASS}>Category</label>
            <Dropdown
              id="user-category"
              label="Category"
              variant="full"
              options={categoryOptions}
              value={categoryId}
              onChange={saveCategory}
            />

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
      </div>
    </div>
  );
}
