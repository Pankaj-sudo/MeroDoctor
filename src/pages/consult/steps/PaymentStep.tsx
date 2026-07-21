import { useRef, useState } from 'react';
import { CONSULTATION_FEE, ESEWA_ID, ESEWA_NAME, ESEWA_QR_SRC, formatNpr } from '../../../config/payment';

/** Decorative QR-style placeholder shown until a real eSewa QR image is set. */
function QrPlaceholder() {
  const N = 21;
  const cells: { x: number; y: number }[] = [];
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        if (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))
          cells.push({ x: ox + x, y: oy + y });
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inFinder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (!inFinder && rnd() > 0.58) cells.push({ x, y });
    }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="c-qr__svg" aria-label="eSewa QR placeholder">
      <rect width={N} height={N} fill="#FBF7F0" />
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#241C15" />
      ))}
    </svg>
  );
}

export function PaymentStep({
  screenshot,
  onScreenshot,
}: {
  screenshot: File | null;
  onScreenshot: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    onScreenshot(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : '');
  }

  return (
    <div className="c-pay">
      <div className="c-pay__grid">
        <div className="c-pay__qrcol">
          <div className="c-pay__amount">
            <span>Consultation fee</span>
            <strong>{formatNpr(CONSULTATION_FEE)}</strong>
          </div>
          <div className="c-qr">
            {ESEWA_QR_SRC ? <img className="c-qr__img" src={ESEWA_QR_SRC} alt="eSewa QR code" /> : <QrPlaceholder />}
          </div>
          <div className="c-pay__esewa">
            <span className="c-pay__esewa-k">Pay to eSewa</span>
            <strong className="c-pay__esewa-id">{ESEWA_ID}</strong>
            <span className="c-pay__esewa-name">{ESEWA_NAME}</span>
          </div>
        </div>

        <div className="c-pay__upcol">
          <ol className="c-pay__steps">
            <li>Open eSewa and scan the QR — or pay to the ID.</li>
            <li>Send exactly {formatNpr(CONSULTATION_FEE)}.</li>
            <li>Upload the payment screenshot below.</li>
          </ol>

          <div
            className={`c-upload${preview ? ' has-img' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
            }}
          >
            {preview ? (
              <img className="c-upload__img" src={preview} alt="Your payment screenshot" />
            ) : (
              <div className="c-upload__empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <span>Upload payment screenshot</span>
                <em>PNG or JPG</em>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </div>
          {screenshot ? (
            <button type="button" className="c-upload__clear" onClick={() => pick(null)}>
              Choose a different image
            </button>
          ) : null}

          <p className="c-pay__pending">
            <span className="c-dot-amber" />
            Your payment stays <strong>Pending verification</strong> until our team confirms it —
            we never auto-approve.
          </p>
        </div>
      </div>
    </div>
  );
}
