import Link from 'next/link'
import { site, footerColumns } from '@/lib/site'

export function Footer() {
  return (
    <footer className="border-t border-primary-alt/20 bg-[rgba(10,10,10,0.95)] px-4 py-12 text-center text-white">
      <div className="mx-auto grid max-w-[1200px] gap-8 text-left sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="mb-4 text-xl font-bold text-primary-alt">About Nara</h2>
          <p className="leading-relaxed text-[#aaa]">{site.description}</p>
        </div>

        {footerColumns.map((col) => (
          <div key={col.title}>
            <h2 className="mb-4 text-xl font-bold text-primary-alt">{col.title}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {col.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  /* /map redirects off-site; prefetching it makes the browser follow the
                     redirect with fetch(), which the rail map's host refuses (CORS). */
                  prefetch={link.href === '/map' ? false : undefined}
                  className="py-1 text-[#aaa] transition-colors duration-300 hover:text-primary-alt"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-[1200px] border-t border-[#333] pt-4 text-[0.9rem] text-[#797979]">
        &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
      </div>
    </footer>
  )
}
