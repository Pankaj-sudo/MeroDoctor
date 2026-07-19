import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="auth">
      <section className="auth__card auth__card--center">
        <h1 className="auth__title">Page not found</h1>
        <p className="auth__subtitle">The page you’re looking for doesn’t exist.</p>
        <Link to="/" className="btn btn--primary">
          Back to safety
        </Link>
      </section>
    </main>
  );
}
