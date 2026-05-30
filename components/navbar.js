class CustomNavbar extends HTMLElement {
  
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
         nav {
          background: rgba(18, 18, 30, 0.95);
          backdrop-filter: blur(16px);
          padding: 1rem 2rem;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          box-shadow: 0 2px 20px rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(224,64,251,0.2);
        }
        .nav-container {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
          gap: 1rem;
          position: relative;
        }
        .nav-logo {
          font-size: 1.7rem;
          font-weight: 900;
          text-decoration: none;
          z-index: 9001;
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
          margin-left: 1rem;
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
          background: rgba(18, 18, 30, 0.98);
          border: 1px solid rgba(224,64,251,0.25);
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
          color: #B0BEC5;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .nav-dropdown-item:hover {
          background: rgba(224,64,251,0.12);
          color: #E040FB;
        }
        
        /* Hamburger Menu */
        .menu-toggle {
          display: none;
          flex-direction: column;
          cursor: pointer;
          z-index: 9001;
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

        /* Mobile Responsive */
        @media (max-width: 768px) {
          nav {
            padding: 1rem;
          }
          
          .nav-logo {
            font-size: 1.35rem;
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
            background: rgba(18, 18, 30, 0.98);
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
            color: #B0BEC5;
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
                        <div class="nav-dropdown">
              <a href="/tools" class="nav-link nav-dropdown-trigger">
                Tools
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </a>
              <div class="nav-dropdown-menu">
                <a href="/snitches" class="nav-dropdown-item">Snitches</a>
                <a href="/stats" class="nav-dropdown-item">Player Stats</a>
              </div>
            </div>
            <a href="/joining" class="nav-link">Join Us</a>
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
  }
}

customElements.define('custom-navbar', CustomNavbar);