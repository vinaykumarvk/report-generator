import type { Metadata } from 'next';
import ReportsStudioClient from './reports-studio-client';

export const metadata: Metadata = {
  title: 'Reports Studio',
};

export default function ReportsStudioPage() {
  return <ReportsStudioClient />;
}
