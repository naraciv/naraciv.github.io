'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { nav, type NavItem } from '@/lib/site'

/** The parent highlights when a child route is open; only an exact match is
 *  aria-current, because a parent is not the page you are on. */
function isOpen(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true
  return item.children?.some((c) => pathname === c.href) ?? false
}

export function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const linkClass = (item: NavItem) =>
    ['nav-link', item.accent && 'nav-link-gacha', isOpen(pathname, item) && 'nav-current']
      .filter(Boolean)
      .join(' ')

  return (
    <header className="nav-shell fixed inset-x-0 top-0 z-50">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-4 sm:px-8"
      >
        <Link href="/" className="nav-logo relative z-10">
          NARA
        </Link>

        <ul className="ml-4 hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <li key={item.href + item.label} className="group relative">
              <Link
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`${linkClass(item)} flex items-center gap-1`}
              >
                {item.label}
                {item.children && (
                  <ChevronDown
                    aria-hidden
                    className="size-4 transition-transform duration-300 group-hover:rotate-180"
                  />
                )}
              </Link>

              {item.children && (
                <ul className="nav-dropdown-menu invisible absolute top-full left-1/2 z-10 mt-2.5 min-w-35 -translate-x-1/2 py-2 opacity-0 transition-[opacity,visibility] duration-300 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 before:absolute before:inset-x-0 before:-top-2.5 before:h-2.5 before:content-['']">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        aria-current={pathname === child.href ? 'page' : undefined}
                        className="nav-dropdown-item block px-4 py-2"
                        style={pathname === child.href ? { color: '#e040fb' } : undefined}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="relative z-10 ml-auto flex flex-col gap-[3px] p-2 md:hidden"
        >
          <span
            className={`block h-[3px] w-[25px] rounded-[3px] transition-all duration-300 ${open ? 'translate-y-[6px] rotate-45 bg-purple' : 'bg-[#62818f]'}`}
          />
          <span
            className={`block h-[3px] w-[25px] rounded-[3px] bg-[#62818f] transition-all duration-300 ${open ? 'opacity-0' : ''}`}
          />
          <span
            className={`block h-[3px] w-[25px] rounded-[3px] transition-all duration-300 ${open ? '-translate-y-[6px] -rotate-45 bg-purple' : 'bg-[#62818f]'}`}
          />
        </button>
      </nav>

      <div
        id="mobile-nav"
        hidden={!open}
        className="nav-panel border-t border-purple/20 px-6 pt-4 pb-8 md:hidden"
      >
        <ul className="flex flex-col gap-3">
          {nav.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`${linkClass(item)} block py-1 text-[1.25rem]`}
              >
                {item.label}
              </Link>
              {item.children && (
                <ul className="pt-2 pl-4">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={() => setOpen(false)}
                        aria-current={pathname === child.href ? 'page' : undefined}
                        className="nav-dropdown-item block px-2 py-1"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
