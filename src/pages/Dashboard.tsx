import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/Spinner';
import type { Role } from '../types/auth';

const ROLE_LABEL: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  clinic_staff: 'Clinic Staff',
  admin: 'Administrator',
};

function initialsOf(name: string, email: string): string {
  const base = name.trim() || email.trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (base.slice(0, 2) || '·').toUpperCase();
}

/**
 * Post-login home. Adapts its greeting to the user's role and shows the
 * verified/unverified state. This is the placeholder to grow into the real
 * role dashboards (see HOME_FOR_ROLE in config/roles.ts).
 */
export function Dashboard() {
  const { user, profile, role, isAdmin, isVerified, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  // Clinicians never see the patient dashboard — send them to the EMR. This is a
  // UX redirect; data access is enforced separately by the Firestore rules.
  if (role === 'doctor' || role === 'clinic_staff' || role === 'admin' || isAdmin) {
    return <Navigate to="/doctor" replace />;
  }

  const displayName = profile?.displayName || user?.displayName || 'there';
  const email = profile?.email || user?.email || '';
  const photoURL = profile?.photoURL || user?.photoURL || '';

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="dash">
      <header className="dash__bar">
        <span className="dash__wordmark">MERODOCTOR</span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleLogout}
          disabled={signingOut}
        >
          {signingOut ? <Spinner size={15} /> : null}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>

      <section className="dash__card">
        <div className="dash__identity">
          {photoURL ? (
            <img className="dash__avatar" src={photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="dash__avatar dash__avatar--mono">
              {initialsOf(displayName, email)}
            </div>
          )}
          <div>
            <h1 className="dash__hello">Welcome, {displayName.split(' ')[0]}</h1>
            <p className="dash__email">{email}</p>
          </div>
        </div>

        <div className="dash__badges">
          <span className="badge">{role ? ROLE_LABEL[role] : 'Account'}</span>
          <span className={`badge ${isVerified ? 'badge--ok' : 'badge--pending'}`}>
            {isVerified ? 'Verified' : 'Pending verification'}
          </span>
          <span className="badge badge--muted">via {profile?.provider ?? 'google'}</span>
        </div>

        <dl className="dash__meta">
          <div>
            <dt>User ID</dt>
            <dd className="mono">{user?.uid}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{profile?.status ?? 'active'}</dd>
          </div>
        </dl>

        <p className="dash__note">
          Talk to a doctor in minutes. Answer a few questions, pay via eSewa, and track your
          consultation live.
        </p>

        <div className="dash__cta">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate('/consult')}
            style={{ width: '100%' }}
          >
            Consult now
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate('/consultations')}
            style={{ width: '100%' }}
          >
            My consultations
          </button>
        </div>
      </section>
    </main>
  );
}
