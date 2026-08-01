import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';

export default function VerifyEmail() {
  return (
    <AuthLayout
      title="Check your email"
      footer={
        <Link to="/login" className="text-brand-600 font-semibold">
          Back to sign in
        </Link>
      }
    >
      <p className="text-[13px] text-ink-600">
        We sent you a confirmation link. Click it to activate your account, then sign in.
      </p>
    </AuthLayout>
  );
}
