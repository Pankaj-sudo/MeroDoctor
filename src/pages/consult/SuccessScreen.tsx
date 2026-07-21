import { useNavigate, useParams } from 'react-router-dom';
import { Confetti } from '../../components/consult/Confetti';
import { AnimatedCheck } from '../../components/consult/AnimatedCheck';
import '../../styles/consult.css';

export function SuccessScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const shortId = id.slice(0, 8).toUpperCase();

  return (
    <main className="c-success">
      <Confetti />
      <section className="c-glass c-success__card">
        <AnimatedCheck />
        <h1 className="c-success__title">Consultation submitted</h1>
        <p className="c-success__lead">We’ve received your intake and your payment screenshot.</p>

        <div className="c-success__id">
          <span>Consultation ID</span>
          <strong>{shortId}</strong>
        </div>

        <div className="c-success__status">
          <span className="c-dot-amber" />
          Payment pending verification
        </div>

        <p className="c-success__wait">
          Sit tight — a doctor picks up your case as soon as payment is confirmed. You can watch
          every step happen in real time.
        </p>

        <div className="c-success__actions">
          <button type="button" className="c-btn c-btn--primary" onClick={() => navigate(`/track/${id}`)}>
            Track consultation
          </button>
          <button type="button" className="c-btn c-btn--ghost" onClick={() => navigate('/consultations')}>
            Patient dashboard
          </button>
          <button type="button" className="c-btn c-btn--ghost" onClick={() => navigate('/dashboard')}>
            Back to home
          </button>
        </div>
      </section>
    </main>
  );
}
