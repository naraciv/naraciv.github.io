class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                footer {
                    background-color: rgba(10, 10, 10, 0.95);
                    color: white;
                    padding: 3rem 1rem;
                    text-align: center;
                    border-top: 1px solid rgba(37, 150, 190, 0.2);
                }
                .footer-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 2rem;
                    text-align: left;
                }
                .footer-section h3 {
                    color: #2596be;
                    margin-bottom: 1rem;
                    font-size: 1.25rem;
                }
                .footer-section p {
                    color: #aaa;
                    line-height: 1.6;
                }
                .footer-links {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .footer-links a {
                    color: #aaa;
                    text-decoration: none;
                    transition: color 0.3s;
                }
                .footer-links a:hover {
                    color: #2596be;
                }
                .social-links {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .social-links a {
                    color: white;
                    background: #333;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }
                .social-links a:hover {
                    background: #2596be;
                    transform: translateY(-3px);
                }
                .copyright {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #333;
                    color: #666;
                    font-size: 0.9rem;
                }
                @media (max-width: 768px) {
                    .footer-content {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
            <footer>
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>About Nara</h3>
                        <p>A Japanese-themed nation on CivMC, located in the +,+ on the continent of Alenarith. Founded on vibes and environmentalism.</p>
                    </div>
                    <div class="footer-section">
                        <h3>Quick Links</h3>
                        <div class="footer-links">
                            <a href="/government">Government</a>
                            <a href="/properties">Properties</a>
                            <a href="/shops">Shops</a>
                            <a href="/joining">Joining Nara</a>
                        </div>
                    </div>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nara. All rights reserved.
                </div>
            </footer>
            <script>feather.replace();</script>
        `;
    }
}
customElements.define('custom-footer', CustomFooter);