import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: { default: 'Dashboard de Performance Meta Ads', template: '%s | Meta BI' },
  description: 'Business Intelligence para metas, mídia e controle orçamentário de contas Meta Ads.',
  openGraph: {
    type: 'website',
    siteName: 'Meta BI',
    title: 'Dashboard de Performance Meta Ads',
    description: 'Metas, mídia e orçamento em um só lugar.',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Dashboard de Performance Meta Ads' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard de Performance Meta Ads',
    description: 'Metas, mídia e orçamento em um só lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
