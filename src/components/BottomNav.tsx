import { useLocation, useNavigate } from 'react-router-dom';
import { ar } from '../i18n/ar';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string;
}

const items: NavItem[] = [
  { key: 'home', label: ar.nav.home, path: '/', icon: '◆' },
  { key: 'store', label: ar.nav.store, path: '/store', icon: '✦' },
  { key: 'missions', label: ar.nav.missions, path: '/missions', icon: '◎' },
  { key: 'profile', label: ar.nav.profile, path: '/profile', icon: '◈' },
];

/** Persistent bottom navigation used on hub screens. */
export function BottomNav(): JSX.Element {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="glass sticky bottom-0 z-20 flex items-center justify-around rounded-t-2xl px-2 py-2">
      {items.map((item) => {
        const active = pathname === item.path;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs transition ${
              active ? 'text-brand-cyan' : 'text-white/50'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
