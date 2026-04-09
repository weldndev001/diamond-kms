import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
    const token = await getToken({ 
        req: request,
        secret: process.env.NEXTAUTH_SECRET 
    })
    
    const { pathname } = request.nextUrl

    // Protected routes: redirect to login if no token
    if (pathname.startsWith('/dashboard') && !token) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Auth pages: redirect to dashboard if already logged in
    if ((pathname.startsWith('/login') || pathname.startsWith('/register')) && token) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
