import { useEffect, useRef } from 'react';
import { applyTheme } from '../lib/themes';
import { usePrefs } from '../lib/prefs';

/** Faint falling glyphs, like a feed being decrypted. Paused when reduced motion is requested. */
function Rain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const glyphs = '01ABCDEF#%$&*+=<>/\\|NIGHTFALLDEADMAFIA'.split('');
    let cols: number[] = [];
    const size = 16;
    const resize = () => {
      c.width = c.clientWidth;
      c.height = c.clientHeight;
      cols = Array.from({ length: Math.ceil(c.width / size) }, () => Math.random() * -60);
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 70) return;
      last = t;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim().split(' ').join(',');
      ctx.fillStyle = 'rgba(6,6,7,0.18)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = `${size - 2}px "JetBrains Mono", monospace`;
      cols.forEach((y, i) => {
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        ctx.fillStyle = Math.random() < 0.04 ? 'rgb(240,235,225)' : `rgb(${accent})`;
        ctx.fillText(ch, i * size, y * size);
        cols[i] = y > c.height / size + Math.random() * 40 ? Math.random() * -20 : y + 1;
      });
    };
    if (!reduce) raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} />;
}

export function Background({ theme, day, inGame, rain }: { theme?: string; day?: boolean; inGame?: boolean; rain?: boolean }) {
  const prefs = usePrefs();
  const id = theme ?? prefs.theme;
  useEffect(() => applyTheme(id), [id]);
  return (
    <>
      <div className={`scene ${day ? 'day' : ''} ${inGame ? 'in-game' : ''}`} aria-hidden>
        <div className="grid" />
        <div className="fog" />
        {rain && <Rain />}
        <div className="vignette" />
      </div>
      <div className="crt" aria-hidden>
        <div className="grain" />
      </div>
    </>
  );
}
