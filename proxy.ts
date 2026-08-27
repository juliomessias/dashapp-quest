import { withAuth } from 'next-auth/middleware';
export const proxy = withAuth({ callbacks: { authorized: ({ token }) => Boolean(token) } });
export const config = { matcher: ['/((?!api/auth|api/meta/callback|login|_next/static|_next/image|favicon.ico).*)'] };
