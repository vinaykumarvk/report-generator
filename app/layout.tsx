import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './components/sidebar.css';
import './components/page-header.css';
import './components/theme-toggle.css';
import Sidebar from './components/sidebar';

export const metadata: Metadata = {
  title: 'Report Generator',
  description: 'A powerful platform for creating, managing, and generating intelligent reports with AI-powered insights'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  const theme = savedTheme || systemTheme;
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <Sidebar />
        <div className="app-wrapper with-sidebar">
          {children}
        </div>
      </body>
    </html>
  );
}
