class CustomNavbar extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        nav {
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          padding: 1rem 2rem;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        .nav-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }
        .nav-logo {
          font-size: 1.5rem;
          font-weight: bold;
          color: #2596be;
          text-decoration: none;
          z-index: 1001;
        }
        .nav-links {
          display: flex;
          gap: 1.5rem;
        }
        .nav-link {
          color: white;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s;
          position: relative;
        }
        .nav-link:hover:not(.active) {
          color: #2596be;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          width: 0;
          height: 2px;
          background: #2596be;
          transition: width 0.3s;
        }
        .nav-link:hover:not(.active)::after {
          width: 100%;
        }
        .active {
          color: #2596be;
        }
        .active::after {
          width: 100%;
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          height: 2px;
          background: #2596be;
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
          background: white;
          margin: 3px 0;
          transition: all 0.3s ease;
          border-radius: 3px;
        }
        .menu-toggle.active span:nth-child(1) {
          transform: rotate(45deg) translate(8px, 8px);
          background: #2596be;
        }
        .menu-toggle.active span:nth-child(2) {
          opacity: 0;
        }
        .menu-toggle.active span:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -7px);
          background: #2596be;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          nav {
            padding: 1rem;
          }
          
          .nav-logo {
            font-size: 1.25rem;
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
            background: rgba(0, 0, 0, 0.98);
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2rem;
            transition: right 0.3s ease;
            box-shadow: -5px 0 15px rgba(0, 0, 0, 0.5);
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
            <a href="/government" class="nav-link">Government</a>
            <a href="/properties" class="nav-link">Properties</a>
            <a href="/shops" class="nav-link">Shops</a>
            <a href="/joining" class="nav-link">Join Us</a>
          </div>
        </div>
      </nav>
    `;
    
    // Add event listeners after creating shadow DOM
    const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
    const navLinks = this.shadowRoot.querySelector('.nav-links');
    const links = this.shadowRoot.querySelectorAll('.nav-link');
    
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