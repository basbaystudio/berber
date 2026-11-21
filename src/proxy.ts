import { NextResponse, type NextRequest } from "next/server";

/**
 * İyimser yönlendirme: oturum çerezi hiç yoksa korumalı alt sayfalardan giriş adresine yönlendirir.
 * Bu bir güvenlik sınırı DEĞİLDİR; asıl yetki kontrolü her sayfa ve server action'da sunucuda yapılır.
 * Giriş adresleri: /admin (yönetici) ve /isletme (işletme).
 */
const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin/") && !req.cookies.has(`${prefix}bp_a`)) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  if (pathname.startsWith("/isletme/panel") && !req.cookies.has(`${prefix}bp_b`)) {
    return NextResponse.redirect(new URL("/isletme", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path+", "/isletme/panel/:path*"],
};
