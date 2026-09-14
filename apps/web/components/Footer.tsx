import Link from 'next/link'
import { site, footerColumns } from '@/lib/site'

export function Footer() {
  return (
    <footer className="site-footer px-4 py-12 text-center">
      <div className="mx-auto grid max-w-[1200px] gap-8 text-left sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="footer-heading mb-4 font-bold">About Nara</h2>
          <p className="leading-relaxed text-[#aaa]">{site.description}</p>
        </div>

        {footerColumns.map((col) => (
          <div key={col.title}>
            <h2 className="footer-heading mb-4 font-bold">{col.title}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {col.links.map((link) => (
                <Link key={link.href} href={link.href} className="footer-link py-1">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="footer-copyright mx-auto mt-8 max-w-[1200px] pt-4">
        &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  )
}
