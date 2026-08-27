import 'next-auth';
declare module 'next-auth' { interface User { role: 'admin' | 'analyst' | 'viewer' } interface Session { user: { id: string; role: 'admin' | 'analyst' | 'viewer'; name?: string | null; email?: string | null } } }
declare module 'next-auth/jwt' { interface JWT { id?: string; role?: 'admin' | 'analyst' | 'viewer' } }
