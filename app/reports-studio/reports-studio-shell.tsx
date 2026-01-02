'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Sidebar from '../components/sidebar';

type ReportsStudioShellProps = {
  children: ReactNode;
};

export default function ReportsStudioShell({ children }: ReportsStudioShellProps) {
  useEffect(() => {
    document.body.classList.add('reports-studio-mode');
    return () => {
      document.body.classList.remove('reports-studio-mode');
    };
  }, []);

  return (
    <div className="reports-studio-shell">
      <Sidebar />
      <div className="reports-studio-content">{children}</div>
    </div>
  );
}
