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
        .nav-link:hover {
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
        .nav-link:hover::after {
          width: 100%;
        }
        .active {
          color: #2596be;
        }
        .active::after {
          width: 100%;
        }
      </style>
      <nav>
        <div class="nav-container">
          <a href="/" class="nav-logo">NARA</a>
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
  }
}
customElements.define('custom-navbar', CustomNavbar);