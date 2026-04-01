class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                footer {
                    background-color: rgba(255, 255, 255, 0.95);
                    color: #334155;
                    padding: 3rem 1rem;
                    text-align: center;
                    border-top: 1px solid rgba(224, 64, 251, 0.12);
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
                    color: #E040FB;
                    margin-bottom: 1rem;
                    font-size: 1.25rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                }
                .footer-section p {
                    color: #78909C;
                    line-height: 1.6;
                }

                /* Quick Links Grid */
                .footer-links {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.5rem 1.5rem;
                }

                .footer-links a {
                    color: #78909C;
                    text-decoration: none;
                    transition: color 0.3s;
                    padding: 0.25rem 0;
                }
                .footer-links a:hover {
                    color: #FF6B35;
                }

                .social-links {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }
                .social-links a {
                    color: white;
                    background: #B0BEC5;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }
                .social-links a:hover {
                    background: linear-gradient(135deg, #E040FB, #FF6B35);
                    transform: translateY(-3px);
                }

                .copyright {
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(224,64,251,0.1);
                    color: #B0BEC5;
                    font-size: 0.9rem;
                    text-align: center;
                }

                /* Mobile Responsive */
                @media (max-width: 768px) {
                    footer {
                        padding: 2rem 1rem;
                    }
                    
                    .footer-content {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                        text-align: center;
                    }
                    
                    .footer-section h3 {
                        font-size: 1.125rem;
                    }
                    
                    .footer-section p {
                        font-size: 0.9rem;
                    }
                    
                    .footer-links {
                        grid-template-columns: 1fr;
                        gap: 0.75rem;
                        text-align: center;
                    }
                    
                    .footer-links a {
                        display: block;
                        padding: 0.5rem;
                    }
                    
                    .social-links {
                        justify-content: center;
                    }
                    
                    .copyright {
                        font-size: 0.8rem;
                    }
                }
                
                @media (max-width: 480px) {
                    .footer-section h3 {
                        font-size: 1rem;
                    }
                    
                    .footer-section p {
                        font-size: 0.85rem;
                    }
                }

                /* ─── Dark mode ─── */
                footer.dark {
                    background-color: rgba(18, 18, 30, 0.95);
                    color: #B0BEC5;
                    border-top-color: rgba(224, 64, 251, 0.2);
                }
                footer.dark .footer-section p {
                    color: #78909C;
                }
                footer.dark .footer-links a {
                    color: #78909C;
                }
                footer.dark .footer-links a:hover {
                    color: #FF6B35;
                }
                footer.dark .copyright {
                    color: #546E7A;
                    border-top-color: rgba(224,64,251,0.15);
                }
            </style>
            <footer>
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>About Nara</h3>
                        <p>A Japanese-themed nation on CivMC, located in the +,+ on the continent of Alenarith. Collect all the Narans! 🎰</p>
                    </div>

                    <div class="footer-section">
                        <h3>Quick Links</h3>
                        <div class="footer-links">
                            <a href="/collect" style="color:#FF6B35;">🎰 Collect-a-Naran</a>
                            <a href="/government">Government</a>
                            <a href="/properties">Properties</a>
                            <a href="/shops">Shops</a>
                            <a href="/joining">Joining Nara</a>
                            <a href="/privacy">Privacy Policy</a>
                        </div>
                    </div>

                    <div class="footer-section">
                        <h3>Tools</h3>
                        <div class="footer-links">
                            <a href="/stats">Playtime Statistics</a>
                            <a href="/snitches">Snitch Viewer</a>
                        </div>
                    </div>

                    <div class="footer-section">
                        <h3>Tools</h3>
                        <div class="footer-links">
                            <a href="/stats">Playtime Statistics</a>
                            <a href="/snitches">Snitch Viewer</a>
                        </div>
                    </div>
                </div>

                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Nara. All rights reserved.
                </div>
            </footer>
            <script>feather.replace();</script>
        `;

        // Sync dark class from html to footer element
        const footerEl = this.shadowRoot.querySelector('footer');
        const syncDark = () => {
          footerEl.classList.toggle('dark', document.documentElement.classList.contains('dark'));
        };
        syncDark();
        new MutationObserver(syncDark).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
}

customElements.define('custom-footer', CustomFooter);
