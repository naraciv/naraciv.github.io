class CustomNavbar extends HTMLElement {
  
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        nav {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          padding: 1rem 2rem;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          box-shadow: 0 2px 20px rgba(224,64,251,0.08);
          border-bottom: 1px solid rgba(224,64,251,0.12);
        }
        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          gap: 1rem;
          position: relative;
        }
        .nav-logo {
          font-size: 1.5rem;
          font-weight: 900;
          text-decoration: none;
          z-index: 1001;
          position: relative;
          background: linear-gradient(90deg, #FF6B35, #E040FB, #00BCD4, #FF6B35);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: navShimmer 4s ease-in-out infinite;
          letter-spacing: 3px;
        }
        @keyframes navShimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .nav-logo::after {
          display: none;
        }
        .nav-links {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }
        .nav-link {
          color: #546E7A;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.3s;
          position: relative;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
        }
        .nav-link:hover:not(.active) {
          color: #E040FB;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #E040FB, #FF6B35);
          transition: width 0.3s;
        }
        .nav-link:hover:not(.active)::after {
          width: 100%;
        }
        .active {
          color: #FF6B35;
        }
        .active::after {
          width: 100%;
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, #FF6B35, #E040FB);
        }
        /* Gacha nav link special glow */
        .nav-link-gacha {
          color: #FF6B35 !important;
          text-shadow: 0 0 8px rgba(255,107,53,0.3);
        }
        .nav-link-gacha:hover {
          text-shadow: 0 0 12px rgba(255,107,53,0.5);
        }
        
        /* Dropdown Menu */
        .nav-dropdown {
          position: relative;
        }
        .nav-dropdown-trigger {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .nav-dropdown-trigger svg {
          width: 16px;
          height: 16px;
          transition: transform 0.3s;
        }
        .nav-dropdown:hover .nav-dropdown-trigger svg {
          transform: rotate(180deg);
        }
        .nav-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid rgba(224,64,251,0.15);
          border-radius: 8px;
          padding: 0.5rem 0;
          min-width: 140px;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s, visibility 0.3s;
          margin-top: 10px;
          box-shadow: 0 4px 20px rgba(224,64,251,0.1);
        }
        .nav-dropdown-menu::before {
          content: '';
          position: absolute;
          top: -10px;
          left: 0;
          right: 0;
          height: 10px;
        }
        .nav-dropdown:hover .nav-dropdown-menu {
          opacity: 1;
          visibility: visible;
        }
        .nav-dropdown-item {
          display: block;
          padding: 0.5rem 1rem;
          color: #546E7A;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .nav-dropdown-item:hover {
          background: rgba(224, 64, 251, 0.08);
          color: #E040FB;
        }
        
        /* Hamburger Menu */
        .menu-toggle {
          display: none;
          flex-direction: column;
          cursor: pointer;
          z-index: 1001;
          background: none;
          border: none;
          padding: 0.5rem;
        }
        .menu-toggle span {
          width: 25px;
          height: 3px;
          background: #546E7A;
          margin: 3px 0;
          transition: all 0.3s ease;
          border-radius: 3px;
        }
        .menu-toggle.active span:nth-child(1) {
          transform: rotate(45deg) translate(8px, 8px);
          background: #E040FB;
        }
        .menu-toggle.active span:nth-child(2) {
          opacity: 0;
        }
        .menu-toggle.active span:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -7px);
          background: #E040FB;
        }

        /* ─── Theme Switch (sliding toggle) ─── */
        .theme-switch-wrap {
          margin-left: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          z-index: 1001;
        }
        .theme-switch {
          display: flex;
          align-items: center;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
        }
        .theme-switch-track {
          width: 52px;
          height: 28px;
          border-radius: 14px;
          background: linear-gradient(135deg, #87CEEB, #FFD700);
          position: relative;
          transition: background 0.4s ease;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.15);
        }
        .theme-switch.dark .theme-switch-track {
          background: linear-gradient(135deg, #1a1a3e, #3a2d6e);
        }
        .theme-switch-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.4s;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .theme-switch.dark .theme-switch-thumb {
          transform: translateX(24px);
          background: #2a2a4a;
        }
        .theme-switch-thumb svg {
          width: 14px;
          height: 14px;
          position: absolute;
          transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        .theme-switch-thumb .icon-sun {
          color: #FF9800;
          opacity: 1;
          transform: rotate(0deg);
        }
        .theme-switch-thumb .icon-moon {
          color: #B39DDB;
          opacity: 0;
          transform: rotate(-90deg);
        }
        .theme-switch.dark .theme-switch-thumb .icon-sun {
          opacity: 0;
          transform: rotate(90deg);
        }
        .theme-switch.dark .theme-switch-thumb .icon-moon {
          opacity: 1;
          transform: rotate(0deg);
        }

        /* ─── Dark mode overrides ─── */
        nav.dark {
          background: rgba(18, 18, 30, 0.95);
          box-shadow: 0 2px 20px rgba(0,0,0,0.3);
          border-bottom-color: rgba(224,64,251,0.2);
        }
        nav.dark .nav-link {
          color: #B0BEC5;
        }
        nav.dark .nav-link:hover:not(.active) {
          color: #E040FB;
        }
        nav.dark .active {
          color: #FF6B35;
        }
        nav.dark .menu-toggle span {
          background: #B0BEC5;
        }
        nav.dark .nav-dropdown-menu {
          background: rgba(18, 18, 30, 0.98);
          border-color: rgba(224,64,251,0.25);
        }
        nav.dark .nav-dropdown-item {
          color: #B0BEC5;
        }
        nav.dark .nav-dropdown-item:hover {
          color: #E040FB;
          background: rgba(224,64,251,0.12);
        }
        nav.dark .theme-switch-track {
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
        }
        @media (max-width: 768px) {
          nav.dark .nav-links {
            background: rgba(18, 18, 30, 0.98);
          }
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          nav {
            padding: 1rem;
          }
          
          .nav-logo {
            font-size: 1.25rem;
          }
          
          .theme-switch-wrap {
            order: 3;
            margin-left: 0;
            margin-right: 0.5rem;
          }
          
          .menu-toggle {
            display: flex;
          }
          
          .nav-links {
            position: fixed;
            top: 0;
            right: -100%;
            height: 100vh;
            width: 70%;
            max-width: 300px;
            background: rgba(255, 255, 255, 0.98);
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2rem;
            transition: right 0.3s ease;
            box-shadow: -5px 0 20px rgba(224,64,251,0.08);
          }
          
          .nav-links.active {
            right: 0;
          }
          
          .nav-link {
            font-size: 1.25rem;
            padding: 0.5rem 1rem;
          }
          
          .nav-link::after {
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
          }
          
          /* Mobile dropdown */
          .nav-dropdown-menu {
            position: static;
            transform: none;
            opacity: 1;
            visibility: visible;
            background: transparent;
            border: none;
            box-shadow: none;
            margin-top: 0;
            padding: 0.5rem 0 0 1rem;
          }
          .nav-dropdown-item {
            font-size: 1rem;
            padding: 0.25rem 0.5rem;
            color: #aaa;
          }
        }
      </style>
      <nav>
        <div class="nav-container">
          <a href="/" class="nav-logo">NARA</a>
          <button class="menu-toggle" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="nav-links">
            <a href="/" class="nav-link">Home</a>
            <a href="/collect" class="nav-link nav-link-gacha">🎰 Collect</a>
            <a href="/government" class="nav-link">Government</a>
            <a href="/properties" class="nav-link">Properties</a>
            <div class="nav-dropdown">
              <a href="/shops" class="nav-link nav-dropdown-trigger">
                Shops
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </a>
              <div class="nav-dropdown-menu">
                <a href="/shops" class="nav-dropdown-item">All Shops</a>
                <a href="/heads" class="nav-dropdown-item">Head Shop</a>
              </div>
            </div>
            <a href="/joining" class="nav-link">Join Us</a>
          </div>
          <div class="theme-switch-wrap">
            <button class="theme-switch" aria-label="Toggle theme" id="theme-toggle">
              <div class="theme-switch-track">
                <div class="theme-switch-thumb">
                  <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                  <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                </div>
              </div>
            </button>
          </div>
        </div>
      </nav>
    `;
    
    // Add event listeners after creating shadow DOM
    const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
    const navLinks = this.shadowRoot.querySelector('.nav-links');
    const links = this.shadowRoot.querySelectorAll('.nav-link');
    const dropdownItems = this.shadowRoot.querySelectorAll('.nav-dropdown-item');
    
    // Add active class to current page link
    const currentPath = window.location.pathname;
    const cleanCurrentPath = currentPath.replace('index.html', '').replace(/\/$/, '');

    links.forEach(link => {
      const href = link.getAttribute('href');
      const cleanHref = href.replace(/\/$/, '');
      
      if (cleanCurrentPath === cleanHref) {
        link.classList.add('active');
      }
    });

    // Also check dropdown items for active state
    dropdownItems.forEach(item => {
      const href = item.getAttribute('href');
      const cleanHref = href.replace(/\/$/, '');
      
      if (cleanCurrentPath === cleanHref) {
        item.style.color = '#E040FB';
        // Also highlight the parent dropdown trigger
        const dropdown = item.closest('.nav-dropdown');
        if (dropdown) {
          const trigger = dropdown.querySelector('.nav-dropdown-trigger');
          if (trigger) {
            trigger.classList.add('active');
          }
        }
      }
    });

    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });
    
    // Close menu when clicking a link
    links.forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        menuToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });

    // ── Theme switch ──
    const themeSwitch = this.shadowRoot.querySelector('#theme-toggle');
    const navEl = this.shadowRoot.querySelector('nav');
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) { themeSwitch.classList.add('dark'); navEl.classList.add('dark'); }

    // Observe html.dark changes so nav stays in sync (e.g. on page load or external toggle)
    const darkObserver = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      navEl.classList.toggle('dark', dark);
      themeSwitch.classList.toggle('dark', dark);
    });
    darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    themeSwitch.addEventListener('click', () => {
      const goingDark = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', goingDark);
      themeSwitch.classList.toggle('dark', goingDark);
      navEl.classList.toggle('dark', goingDark);
      localStorage.setItem('nara_theme', goingDark ? 'dark' : 'light');
    });
  }
}

customElements.define('custom-navbar', CustomNavbar);