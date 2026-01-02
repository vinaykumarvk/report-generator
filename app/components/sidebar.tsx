'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import ThemeToggle from './theme-toggle';

type NavItem = {
  href: Route;
  label: string;
  icon?: string;
};

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/reports-studio', label: 'Reports Studio', icon: '📊' },
  { href: '/runs', label: 'Runs', icon: '🚀' },
 ] satisfies NavItem[];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        className="hamburger-btn"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
      >
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'open' : ''}`}></span>
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar-nav ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="sidebar-brand" onClick={closeSidebar}>
            <span className="brand-icon">📊</span>
            <span className="brand-text">Report Generator</span>
          </Link>
        </div>

        <nav className="sidebar-menu">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                {item.icon && <span className="sidebar-icon">{item.icon}</span>}
                <span className="sidebar-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <div className="sidebar-version">v0.1.0</div>
        </div>
      </aside>
    </>
  );
}
