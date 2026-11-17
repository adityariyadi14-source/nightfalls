import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, AVATARS } from './Avatar';
import { Icon } from './Icon';
import { Button, Toggle } from './ui';
import { usePrefs, setPrefs, getPrefs } from '../lib/prefs';
import { fileToSource, renderPhoto } from '../lib/photo';
import { send, useOnline } from '../online/socket';
import { ONLINE_AVAILABLE } from '../lib/env';
import { sfx } from '../lib/audio';
import { toast } from '../lib/toast';
import { t } from '../lib/i18n';

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 16-digit resident number derived from the player's id, grouped 4-4-4-4. */
export function residentNumber(id: string) {
  let out = '';
  let h = hash(id || 'guest');
  while (out.length < 16) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    out += String(h % 10000).padStart(4, '0');
  }
  return out.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = hash(seed);
    return Array.from({ length: 46 }, () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      return 1 + (h % 3);
    });
  }, [seed]);
  let x = 0;
  return (
    <svg viewBox="0 0 140 24" className="h-6 w-full" preserveAspectRatio="none" aria-hidden>
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={24} fill="currentColor" /> : null;
        x += w;
        return rect;
      })}
    </svg>
  );
}

function syncProfile() {
  const p = getPrefs();
  send({ t: 'updateProfile', name: p.name, avatar: p.avatar, photo: p.photo ?? null });
}

/**
 * The Resident Card: the player's profile as a town ID card. Front: photo, name, resident number.
 * Back (online only): sign in or register so the card works on other devices.
 */
export function ResidentCard({ editable = true }: { editable?: boolean }) {
  const prefs = usePrefs();
  const online = useOnline();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [name, setName] = useState(prefs.name);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = prefs.guestId ?? prefs.localId;
  const issued = useMemo(() => {
    const ts = prefs.issuedAt ?? Date.now();
    if (!prefs.issuedAt) setTimeout(() => setPrefs({ issuedAt: ts }), 0);
    return new Date(ts).toLocaleDateString(prefs.lang === 'id' ? 'id-ID' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [prefs.issuedAt, prefs.lang]);

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const src = await fileToSource(f);
      const photo = await renderPhoto(src, prefs.photoPixel);
      setPrefs({ photoSrc: src, photo });
      syncProfile();
      sfx.reveal();
    } catch (e) {
      toast(t((e as Error).message), 'error');
    }
  };
  const setPixel = async (pixel: boolean) => {
    setPrefs({ photoPixel: pixel });
    if (prefs.photoSrc) {
      setPrefs({ photo: await renderPhoto(prefs.photoSrc, pixel) });
      syncProfile();
    }
  };
  const saveName = () => {
    const n = name.trim() || prefs.name;
    setName(n);
    setPrefs({ name: n });
    syncProfile();
  };

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[27rem]" style={{ perspective: 1200 }}>
        <motion.div
          className="relative w-full"
          style={{ transformStyle: 'preserve-3d', aspectRatio: '1.586' }}
          animate={{ rotateY: side === 'back' ? 180 : 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 overflow-hidden border border-accent/70 bg-panel" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 24px 50px -24px rgb(0 0 0 / 0.95), 0 0 40px -18px rgb(var(--c-accent) / 0.7)' }}>
            <div className="absolute inset-0 opacity-[0.07]" style={{ background: 'repeating-linear-gradient(135deg, rgb(var(--c-accent)) 0 2px, transparent 2px 9px)' }} />
            <div className="relative flex items-center justify-between bg-accent px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-ink sm:text-[10px]">
              <span>{t('Town of Nightfall')}</span>
              <span>{t('Resident card')}</span>
            </div>
            <div className="relative grid h-[calc(100%-1.9rem)] grid-cols-[34%_1fr] gap-3 p-3">
              <div className="flex flex-col gap-2">
                <button type="button" disabled={!editable} onClick={() => fileRef.current?.click()} className="group relative aspect-[3/4] w-full overflow-hidden border border-line bg-ink" aria-label={t('Change photo')}>
                  {prefs.photo ? (
                    <img src={prefs.photo} alt="" className="h-full w-full object-cover" style={{ imageRendering: prefs.photo.startsWith('data:image/png') ? 'pixelated' : 'auto' }} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Avatar index={prefs.avatar} size={72} ring={false} /></div>
                  )}
                  <span className="shimmer pointer-events-none absolute inset-0" />
                  <span className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: 'linear-gradient(120deg, transparent 30%, rgb(120 255 220 / 0.18) 45%, rgb(255 120 220 / 0.18) 55%, transparent 70%)' }} />
                  {editable && <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-fg opacity-0 transition group-hover:opacity-100">{t('Change photo')}</span>}
                </button>
                <div className="text-center font-mono text-[8px] tracking-wider text-muted">{t('Thumbprint on file')}</div>
              </div>
              <div className="flex min-w-0 flex-col text-[10px] leading-tight sm:text-[11px]">
                <div className="text-[8px] uppercase tracking-[0.2em] text-muted">{t('Resident no.')}</div>
                <div className="font-mono text-[11px] font-bold tabular-nums tracking-wider text-fg sm:text-[12px]">{residentNumber(id)}</div>
                <div className="mt-1.5 text-[8px] uppercase tracking-[0.2em] text-muted">{t('Name')}</div>
                <div className="title truncate text-2xl text-fg sm:text-3xl">{prefs.name}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span className="text-[8px] uppercase tracking-[0.2em] text-muted">{t('Status')}</span>
                  <span className="text-[8px] uppercase tracking-[0.2em] text-muted">{t('Issued')}</span>
                  <span className="truncate font-bold uppercase text-accent2">{online.username ? online.username : t('Guest')}</span>
                  <span className="font-bold tabular-nums">{issued}</span>
                  <span className="mt-1 text-[8px] uppercase tracking-[0.2em] text-muted">{t('Valid until')}</span>
                  <span className="mt-1 text-[8px] uppercase tracking-[0.2em] text-muted">{t('Signature')}</span>
                  <span className="font-bold uppercase text-danger">{t('Death')}</span>
                  <span className="truncate font-serif text-[12px] italic text-fg/80">{prefs.name}</span>
                </div>
                <div className="mt-auto text-fg/70"><Barcode seed={id} /></div>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-6 right-3 -rotate-12 border-2 border-danger/80 px-2 py-0.5 font-display text-sm uppercase tracking-widest text-danger/80">{t('Curfew')}</div>
          </div>

          {/* BACK: account */}
          <div className="absolute inset-0 overflow-hidden border border-line bg-panel p-3" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div className="mb-2 h-6 bg-ink" />
            <CardLogin onDone={() => setSide('front')} />
          </div>
        </motion.div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {editable && (
        <div className="mx-auto w-full max-w-[27rem] space-y-2">
          <div className="flex gap-2">
            <input className="input !py-2" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && saveName()} aria-label={t('Display name')} placeholder={t('Display name')} />
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Icon name="photo" size={14} /> {t('Photo')}</Button>
          </div>
          <Toggle checked={prefs.photoPixel} onChange={setPixel} label="Pixelate my photo" hint="Turns your photo into a pixel portrait" />
          <div className="flex flex-wrap gap-2">
            {prefs.photo && <Button size="sm" variant="ghost" onClick={() => { setPrefs({ photo: undefined, photoSrc: undefined }); syncProfile(); }}>Remove photo</Button>}
            {!prefs.photo && <Button size="sm" variant="ghost" onClick={() => setPicking((v) => !v)}>Choose a portrait</Button>}
            {ONLINE_AVAILABLE && <Button size="sm" variant="ghost" onClick={() => { sfx.whoosh(); setSide(side === 'front' ? 'back' : 'front'); }}><Icon name="refresh" size={14} /> {side === 'front' ? t('Flip card: account') : t('Flip card: front')}</Button>}
          </div>
          {picking && !prefs.photo && (
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((i) => (
                <button key={i} aria-label={`Portrait ${i + 1}`} onClick={() => { sfx.select(); setPrefs({ avatar: i }); syncProfile(); }} className={`p-0.5 ${prefs.avatar === i ? 'outline outline-1 outline-accent' : ''}`}><Avatar index={i} size={36} /></button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Sign in / register on the back of the card. */
function CardLogin({ onDone }: { onDone: () => void }) {
  const online = useOnline();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const offline = online.status !== 'online';
  if (online.username) {
    return (
      <div className="flex h-[calc(100%-2rem)] flex-col justify-between text-[12px]">
        <p>{t('Registered as')} <strong className="text-accent">{online.username}</strong>. {t('Sign in with this card on any device to keep your name, photo and history.')}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => send({ t: 'logout' })}>Log out</Button>
          <Button size="sm" onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="flex h-[calc(100%-2rem)] flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        send({ t: mode, username: username.trim(), password });
        setPassword('');
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{mode === 'login' ? t('Sign in with your card') : t('Register this card')}</div>
      <input className="input !py-1.5 text-[12px]" placeholder={t('Username')} autoComplete="username" value={username} maxLength={20} onChange={(e) => setUsername(e.target.value)} />
      <input className="input !py-1.5 text-[12px]" type="password" placeholder={t('Password')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={offline || username.trim().length < 3 || password.length < 6}>{mode === 'register' ? 'Create account' : 'Log in'}</Button>
        <button type="button" className="text-[11px] text-accent2 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? t('No account? Create one') : t('Have an account? Log in')}</button>
      </div>
      {offline && <span className="text-[10px] text-muted">{t('Connect to the server to use accounts.')}</span>}
    </form>
  );
}
