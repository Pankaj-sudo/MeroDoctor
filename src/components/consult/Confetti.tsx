import { useEffect, useRef } from 'react';

const COLORS = ['#E0A878', '#A05C33', '#3E7A4E', '#F6F1E8', '#D89A6E', '#C0442E'];

interface Particle {
  x: number; y: number; vx: number; vy: number; size: number;
  color: string; rot: number; vr: number; life: number;
}

/** A lightweight one-shot canvas confetti burst (no dependencies). */
export function Confetti({ fire = true }: { fire?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch { /* ignore */ }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const parts: Particle[] = Array.from({ length: 150 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;
      return {
        x: W * 0.5 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.26,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed - 6,
        size: 5 + Math.random() * 7,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
      };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.vy += 0.16;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (t > 1800) p.life -= 0.02;
        if (p.life > 0 && p.y < H + 20) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
          ctx.restore();
        }
      }
      if (alive && t < 4800) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [fire]);

  return <canvas ref={canvasRef} className="c-confetti" aria-hidden="true" />;
}
