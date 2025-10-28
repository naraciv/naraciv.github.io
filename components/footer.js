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

                /* Quick Links Grid */
                .footer-links {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.5rem 1.5rem;
                }

                .footer-links a {
                    color: #aaa;
                    text-decoration: none;
                    transition: color 0.3s;
                    padding: 0.25rem 0;
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
                            <a href="/privacy">Privacy Policy</a>
                            <a href="/map">Map</a>
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
