'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { BarChart3, Building2, CircleDollarSign, Database, LogOut, Menu, PlugZap, Settings2, X } from 'lucide-react';
import { Suspense, useState } from 'react';

const nav = [
  { href: '/', label: 'Consolidado', icon: BarChart3 }, { href: '/contas/visao', label: 'Visão por conta', icon: Building2 },
  { href: '/saldos', label: 'Controle de saldos', icon: CircleDollarSign }, { href: '/admin', label: 'Administração', icon: Settings2 },
  { href: '/admin/integracoes/meta', label: 'Integrações', icon: PlugZap },
];

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const params = useSearchParams(); const { data: session } = useSession(); const [mobileOpen, setMobileOpen] = useState(false); const query = params.toString();
  const visibleNav = nav.filter((item) => !item.href.startsWith('/admin') || session?.user.role === 'admin'); const name = session?.user.name ?? 'Usuário'; const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <div className="min-h-screen bg-[#f6f7f9]">
    <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2">Pular para o conteúdo</a>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-[#e8e9ec] bg-white px-4 lg:left-[230px] lg:px-7">
      <button className="mr-3 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir navegação"><Menu size={20} /></button>
      <div className="flex min-w-0 items-center gap-3"><span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-slate-700">Workspace de mídia</span><span className="hidden text-xs text-slate-500 sm:inline">Performance e governança Meta Ads</span></div>
      <div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{name}</p><p className="text-[11px] text-slate-500">{session?.user.role === 'admin' ? 'Administradora' : session?.user.role === 'analyst' ? 'Analista' : 'Visualizadora'}</p></div><button onClick={() => signOut({ callbackUrl: '/login' })} className="group flex h-9 items-center gap-2 rounded-full bg-[#17202a] px-3 text-xs font-bold text-white" aria-label="Sair"><span>{initials || 'U'}</span><LogOut size={13} className="hidden group-hover:block"/></button></div>
    </header>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[230px] flex-col border-r border-slate-800 bg-[#17202a] text-white transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center border-b border-white/10 px-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white"><Database size={18} /></div><div className="ml-3"><p className="text-sm font-bold tracking-tight">META BI</p><p className="text-[10px] uppercase tracking-[.16em] text-slate-400">Performance Ads</p></div><button className="ml-auto rounded p-1 text-slate-300 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={19} /></button></div>
      <nav className="flex-1 px-3 py-6" aria-label="Navegação principal"><p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Análises</p><div className="space-y-1">{visibleNav.map((item) => { const active = item.href === '/' ? pathname === '/' : item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href.split('/').slice(0, item.href === '/admin/integracoes/meta' ? 4 : 2).join('/')); const Icon = item.icon; const base = item.href.startsWith('/contas/') && params.get('accountId') ? `/contas/${params.get('accountId')}` : item.href; const href = query && !item.href.startsWith('/admin') ? `${base}?${query}` : base; return <Link key={item.href} href={href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition ${active ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-300 hover:bg-white/7 hover:text-white'}`}><Icon size={17} />{item.label}</Link>; })}</div></nav>
      <div className="border-t border-white/10 p-3"><div className="flex w-full items-center rounded-lg px-3 py-2 text-xs text-slate-300"><span className="mr-3 h-2 w-2 rounded-full bg-emerald-400"/>Sessão protegida</div></div>
    </aside>
    <main id="conteudo" className="min-h-screen pt-16 lg:pl-[230px]">{children}</main>
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) { return <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]">{children}</div>}><AppShellInner>{children}</AppShellInner></Suspense>; }
