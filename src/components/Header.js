import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaUser, FaHeart, FaBars, FaTimes, FaChevronDown, FaFilm, FaDownload, FaBell } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useNotification } from '../context/NotificationContext';
import './Header.css';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileCountryOpen, setIsMobileCountryOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const location = useLocation();
  const isWatchPage = location.pathname.startsWith('/watch/');
  const [isVisible, setIsVisible] = useState(!isWatchPage);
  const [autoHideEnabled, setAutoHideEnabled] = useState(isWatchPage);
  const lastScrollY = useRef(0);
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    if (isWatchPage) {
      setIsVisible(false);
      setAutoHideEnabled(true);
    } else {
      setIsVisible(true);
      setAutoHideEnabled(false);
    }
    lastScrollY.current = window.scrollY;
  }, [isWatchPage]);

  useEffect(() => {
    const activationOffset = 80;
    const scrollDelta = 6;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY - lastScrollY.current > scrollDelta;
      const scrollingUp = lastScrollY.current - currentScrollY > scrollDelta;

      if (!autoHideEnabled && currentScrollY > activationOffset) {
        setAutoHideEnabled(true);
      }

      if (scrollingUp || currentScrollY <= activationOffset) {
        setIsVisible(true);
      } else if (autoHideEnabled && scrollingDown) {
        setIsVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [autoHideEnabled]);

  const countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'India',
    'France', 'Germany', 'Japan', 'South Korea', 'Brazil', 'Mexico', 'Spain',
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (isMenuOpen) {
      setIsMobileCountryOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.mobile-menu-drawer') && !event.target.closest('.mobile-menu-button')) {
        setIsMenuOpen(false);
        setIsMobileCountryOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const toggleMobileSearch = () => setIsMobileSearchOpen(!isMobileSearchOpen);

  const handleLogout = () => {
    logout();
    setTimeout(() => navigate('/'), 0);
  };

  return (
    <header className={`header ${isVisible ? '' : 'header-hidden'}`} role="navigation" aria-label="Primary navigation">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="logo">
          <img src="/viewesta.png" alt="Viewesta" className="logo-img" />
        </Link>

        {/* Search Bar */}
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-input-container">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button">
              <FaSearch />
            </button>
          </div>
        </form>

        {/* Navigation */}
        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>{t('navHome')}</Link>
          <Link to="/watch" className={`nav-link ${location.pathname === '/watch' || location.pathname === '/movies' ? 'active' : ''}`}>{t('navMovies')}</Link>
          <Link to="/series" className={`nav-link ${location.pathname === '/series' ? 'active' : ''}`}>{t('navShows')}</Link>
          <Link to="/genres" className={`nav-link ${location.pathname.startsWith('/genres') ? 'active' : ''}`}>{t('navGenres')}</Link>
          <Link to="/watchlist" className={`nav-link ${location.pathname.startsWith('/watchlist') ? 'active' : ''}`}>
            <FaHeart />
            <span>{t('navWishlist')}</span>
          </Link>
          <Link to="/downloads" className={`nav-link ${location.pathname.startsWith('/downloads') ? 'active' : ''}`}>
            <FaDownload />
            <span>{t('navDownloads')}</span>
          </Link>

          {/* Language Toggle */}
          <button
            className="lang-toggle"
            onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
            title="Switch language"
            aria-label="Switch language"
          >
            <span className={locale === 'en' ? 'lang-opt lang-active' : 'lang-opt'}>EN</span>
            <span className="lang-sep">|</span>
            <span className={locale === 'fr' ? 'lang-opt lang-active' : 'lang-opt'}>FR</span>
          </button>

          {user ? (
            <>
              {(user.role || user.user_type || '').toLowerCase() === 'filmmaker' && (
                <Link to="/filmmaker-studio" className={`nav-link ${location.pathname.startsWith('/filmmaker-studio') ? 'active' : ''}`}>
                  <FaFilm />
                  <span>{t('navStudio')}</span>
                </Link>
              )}

              {/* ── Notification Bell ─────────────────────────────────── */}
              <Link
                to="/notifications"
                className={`nav-link notification-bell-link ${location.pathname === '/notifications' ? 'active' : ''}`}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                id="header-notification-bell"
              >
                <span className="notification-bell-wrap">
                  <FaBell />
                  {unreadCount > 0 && (
                    <span className="header-notification-badge" aria-live="polite">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              </Link>

              <div className="user-menu">
                <button className="user-button">
                  <FaUser />
                  <span className="user-name">{user.name}</span>
                </button>
                <div className="user-dropdown">
                  <Link to="/profile" className={`dropdown-link ${location.pathname.startsWith('/profile') ? 'active' : ''}`}>Profile</Link>
                  {(user.role || user.user_type || '').toLowerCase() === 'filmmaker' && (
                    <Link to="/filmmaker-studio" className="dropdown-link">Filmmaker Studio</Link>
                  )}
                  <Link to="/notifications" className="dropdown-link">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="dropdown-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </Link>
                  <Link to="/subscription" className="dropdown-link">Subscription</Link>
                  <Link to="/wallet" className="dropdown-link">Wallet</Link>
                  <button onClick={handleLogout} className="dropdown-link">Logout</button>
                </div>
              </div>
            </>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-ghost">{t('auth.login')}</Link>
              <Link to="/register" className="btn btn-primary">{t('auth.register')}</Link>
            </div>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button className="mobile-menu-button" onClick={toggleMenu} aria-label="Toggle menu">
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>

        {/* Mobile Search Icon */}
        <button className="mobile-search-button" onClick={toggleMobileSearch} aria-label="Search">
          <FaSearch />
        </button>

        {/* Mobile Notification Bell */}
        {user && (
          <Link
            to="/notifications"
            className="mobile-notification-bell"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            id="header-mobile-notification-bell"
          >
            <span className="notification-bell-wrap">
              <FaBell />
              {unreadCount > 0 && (
                <span className="header-notification-badge" aria-live="polite">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </Link>
        )}
      </div>

      {/* Mobile Search Bar */}
      {isMobileSearchOpen && (
        <div className="mobile-search-container">
          <form className="mobile-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mobile-search-input"
              autoFocus
            />
            <button type="submit" className="mobile-search-submit">
              <FaSearch />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      <div className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu}></div>

      {/* Mobile Menu Drawer */}
      <div className={`mobile-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <h3>Menu</h3>
          <button className="mobile-menu-close" onClick={toggleMenu} aria-label="Close menu">
            <FaTimes />
          </button>
        </div>

        <nav className="mobile-menu-nav">
          <Link to="/" className="mobile-menu-link" onClick={toggleMenu}>{t('navHome')}</Link>
          <Link to="/watch" className="mobile-menu-link" onClick={toggleMenu}>{t('navMovies')}</Link>
          <Link to="/series" className="mobile-menu-link" onClick={toggleMenu}>{t('navShows')}</Link>
          <Link to="/genres" className="mobile-menu-link" onClick={toggleMenu}>{t('navGenres')}</Link>
          <Link to="/watchlist" className="mobile-menu-link" onClick={toggleMenu}>{t('navWishlist')}</Link>
          <Link to="/downloads" className="mobile-menu-link" onClick={toggleMenu}>{t('navDownloads')}</Link>

          <button
            className="mobile-menu-link mobile-lang-toggle"
            onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
          >
            <span>Language</span>
            <span className="mobile-lang-badge">{locale === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}</span>
          </button>

          {/* Mobile Country Dropdown */}
          <div className="mobile-menu-dropdown">
            <button
              className="mobile-menu-link mobile-menu-dropdown-toggle"
              onClick={() => setIsMobileCountryOpen(!isMobileCountryOpen)}
            >
              <span>Country</span>
              <FaChevronDown className={`mobile-chevron ${isMobileCountryOpen ? 'open' : ''}`} />
            </button>
            {isMobileCountryOpen && (
              <div className="mobile-menu-dropdown-content">
                <div className="mobile-country-list">
                  {countries.map((country) => (
                    <Link
                      key={country}
                      to={`/search?country=${encodeURIComponent(country.toLowerCase())}`}
                      className="mobile-country-link"
                      onClick={toggleMenu}
                    >
                      {country}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {user ? (
            <>
              {(user.role || user.user_type || '').toLowerCase() === 'filmmaker' && (
                <Link to="/filmmaker-studio" className="mobile-menu-link" onClick={toggleMenu}>Studio</Link>
              )}
              <Link to="/notifications" className="mobile-menu-link" onClick={toggleMenu}>
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="mobile-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </Link>
              <Link to="/profile" className="mobile-menu-link" onClick={toggleMenu}>Profile</Link>
              <Link to="/subscription" className="mobile-menu-link" onClick={toggleMenu}>Subscription</Link>
              <Link to="/wallet" className="mobile-menu-link" onClick={toggleMenu}>Wallet</Link>
              <button onClick={() => { handleLogout(); toggleMenu(); }} className="mobile-menu-link mobile-menu-button-link">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-menu-link" onClick={toggleMenu}>Login</Link>
              <Link to="/register" className="mobile-menu-link" onClick={toggleMenu}>Sign Up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
