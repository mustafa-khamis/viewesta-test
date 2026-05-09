/**
 * Filmmaker studio layout: studio header + sidebar (Dashboard, My Movies, Upload, Earnings, Profile) + Outlet.
 * Used only for /filmmaker-studio and nested routes.
 */
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { FaFilm, FaTv, FaPlus, FaDollarSign, FaUser, FaBars, FaTimes } from 'react-icons/fa';
import './FilmmakerStudioLayout.css';

const navItems = [
  { path: '/filmmaker-studio', pathExact: true, icon: FaFilm, key: 'dashboard' },
  { path: '/filmmaker-studio/movies', icon: FaTv, key: 'myStudio' },
  { path: '/filmmaker-studio/upload', icon: FaPlus, key: 'upload' },
  { path: '/filmmaker-studio/earnings', icon: FaDollarSign, key: 'earnings' },
  { path: '/filmmaker-studio/profile', icon: FaUser, key: 'profile' },
];

export default function FilmmakerStudioLayout() {
  const { t } = useLocale();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const isActive = (item) =>
    item.pathExact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div className="filmmaker-studio-layout">
      <header className="studio-header">
        <div className="studio-header-inner">
          <button
            type="button"
            className="studio-menu-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <Link to="/filmmaker-studio" className="studio-logo">
            <img src="/viewesta.png" alt="Viewesta" className="studio-logo-img" />
            <span className="studio-logo-text">{t('filmmakerStudio')}</span>
          </Link>
        </div>
      </header>

      <div className="studio-body">
        <aside className={`studio-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="studio-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`studio-nav-link ${isActive(item) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="studio-nav-icon" />
                <span>{t(item.key)}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="studio-main">
          <Outlet />
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="studio-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
