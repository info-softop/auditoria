import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

// Proxy (antes "middleware"). Usa solo la config base de NextAuth, sin Prisma.
// Desde Next 16 el Proxy corre en el runtime de Node.js por defecto; mantenemos
// la config base separada (auth.config.ts) para que siga siendo ligera.
const { auth } = NextAuth(authConfig);

// Rutas públicas (sin login): el link de registro de traslados que usan las
// asesoras y su endpoint. Igualdad exacta o prefijo "ruta/" para no abrir
// rutas hermanas por coincidencia de substring.
const PUBLIC_ROUTES = ["/traslados/registrar", "/api/public"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isPublic) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const isOnLogin = pathname.startsWith("/login");

  if (isOnLogin) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Excluye API de auth, assets de Next, y cualquier archivo estático
  // (rutas con extensión: .png, .ico, .svg, etc.) — incl. /brand y /uploads.
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
