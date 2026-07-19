import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { homeForRole } from './config/roles';
import { isFirebaseConfigured } from './lib/firebase';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';
import { FullPageSpinner } from './components/Spinner';
import { Login } from './pages/Login';

// Login is the unauthenticated entry point, so it loads eagerly. The
// authenticated area and error page are code-split (loaded on demand).
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

/** Sends the visitor to their role home when signed in, otherwise to /login. */
function RootRedirect() {
  const { loading, isAuthenticated, role } = useAuth();
  if (loading) return <FullPageSpinner />;
  return <Navigate to={isAuthenticated ? homeForRole(role) : '/login'} replace />;
}

/** Shown when the Firebase env config is missing, instead of a crash. */
function ConfigNotice() {
  return (
    <main className="auth">
      <section className="auth__card auth__card--center">
        <div className="auth__brand">
          <span className="auth__wordmark">MERODOCTOR</span>
        </div>
        <h1 className="auth__title">Setup needed</h1>
        <p className="auth__subtitle">
          Firebase isn’t configured. Copy <code>.env.example</code> to <code>.env.local</code>,
          paste your web-app config, and restart the dev server.
        </p>
      </section>
    </main>
  );
}

export function App() {
  if (!isFirebaseConfigured) return <ConfigNotice />;

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
