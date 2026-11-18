import { useEffect } from 'react';
import { Background } from './components/Background';
import { Toasts } from './components/Toasts';
import { useRoute } from './lib/router';
import { unlockAudio, setMusicMood, setVolume } from './lib/audio';
import { usePrefs } from './lib/prefs';
import { Landing } from './screens/Landing';
import { MainMenu } from './screens/MainMenu';
import { CreateRoom } from './screens/CreateRoom';
import { JoinRoom } from './screens/JoinRoom';
import { OnlineRoom } from './screens/OnlineRoom';
import { LocalSetup } from './screens/LocalSetup';
import { LocalPlay } from './screens/LocalPlay';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RulesScreen } from './screens/RulesScreen';
import { ONLINE_AVAILABLE } from './lib/env';

export default function App() {
  const parsed = useRoute();
  const route = !ONLINE_AVAILABLE && ['create', 'join', 'room'].includes(parsed.name) ? { name: 'menu' as const } : parsed;
  const prefs = usePrefs();
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      setVolume(prefs.volume);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => {
    if (!['room', 'local-play'].includes(route.name)) setMusicMood('menu');
  }, [route.name]);

  const inGame = route.name === 'room' || route.name === 'local-play';
  return (
    <>
      {!inGame && route.name !== 'local-setup' && <Background rain={route.name === 'landing' || route.name === 'menu'} />}
      <Toasts />
        <div key={route.name} className="min-h-full">
          {route.name === 'landing' && <Landing />}
          {route.name === 'menu' && <MainMenu />}
          {route.name === 'create' && <CreateRoom />}
          {route.name === 'join' && <JoinRoom initialCode={route.code} />}
          {route.name === 'room' && <OnlineRoom />}
          {route.name === 'local-setup' && <LocalSetup />}
          {route.name === 'local-play' && <LocalPlay />}
          {route.name === 'stats' && <StatsScreen />}
          {route.name === 'settings' && <SettingsScreen />}
          {route.name === 'rules' && <RulesScreen />}
        </div>
    </>
  );
}
