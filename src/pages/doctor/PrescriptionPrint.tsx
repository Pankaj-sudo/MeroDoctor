import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeConsultation } from '../../services/consultationService';
import type { Consultation } from '../../types/consultation';
import '../../styles/doctor.css';

function Block({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rx-block">
      <div className="rx-block__t">{title}</div>
      <div className="rx-block__b">{children}</div>
    </div>
  );
}

/** Print-optimised prescription + consultation summary. Auto-opens the print
 *  dialog (where the browser offers "Save as PDF"). */
export function PrescriptionPrint() {
  const { id = '' } = useParams();
  const [c, setC] = useState<Consultation | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return subscribeConsultation(id, setC, () => setC(null));
  }, [id]);

  useEffect(() => {
    if (c) {
      const t = window.setTimeout(() => window.print(), 500);
      return () => window.clearTimeout(t);
    }
  }, [Boolean(c)]);

  if (!c) return <div className="rx-doc"><p style={{ padding: 40 }}>Loading…</p></div>;
  const cl = c.clinical;

  return (
    <div className="rx-doc">
      <button type="button" className="rx-print no-print" onClick={() => window.print()}>
        Print / Save as PDF
      </button>

      <div className="rx-sheet">
        <header className="rx-head">
          <div>
            <div className="rx-brand">MERODOCTOR</div>
            <div className="rx-tag">Private Telemedicine</div>
          </div>
          <div className="rx-id">
            Consultation #{c.id.slice(0, 8).toUpperCase()}
            <br />
            {c.assignedDoctorName ? `Seen by ${c.assignedDoctorName}` : ''}
          </div>
        </header>

        <div className="rx-patient">
          <strong>{c.patient.fullName || 'Patient'}</strong>
          <span>
            {[c.patient.age && `${c.patient.age} yrs`, c.patient.gender, c.patient.phone]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>

        <Block title="Chief complaint">
          {c.symptoms.map((s) => s.label).join(', ') || c.customComplaint || '—'}
        </Block>
        {cl?.diagnosis ? <Block title="Diagnosis">{cl.diagnosis}</Block> : null}
        {cl?.differential ? <Block title="Differential">{cl.differential}</Block> : null}

        <div className="rx-rx">
          <span className="rx-symbol">℞</span>
          <div className="rx-rx__body">
            {cl && cl.prescription.medications.length > 0 ? (
              <ol className="rx-meds">
                {cl.prescription.medications.map((m, i) => (
                  <li key={i}>
                    <strong>{m.name}</strong>
                    {[m.dose, m.frequency, m.duration].filter(Boolean).length
                      ? ` — ${[m.dose, m.frequency, m.duration].filter(Boolean).join(', ')}`
                      : ''}
                  </li>
                ))}
              </ol>
            ) : (
              <em>No medications prescribed.</em>
            )}
            {cl?.prescription.advice ? <p className="rx-advice">{cl.prescription.advice}</p> : null}
          </div>
        </div>

        {cl?.investigations ? <Block title="Investigations">{cl.investigations}</Block> : null}
        {cl?.patientInstructions ? <Block title="Instructions">{cl.patientInstructions}</Block> : null}
        {cl?.followUpDate ? <Block title="Follow-up">{cl.followUpDate}</Block> : null}

        <footer className="rx-foot">
          <div className="rx-signer">
            {c.assignedDoctorName || '—'}
            <span>Physician · MeroDoctor</span>
          </div>
          <div className="rx-sign">Signature</div>
        </footer>
      </div>
    </div>
  );
}
