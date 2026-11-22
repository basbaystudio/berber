/**
 * DEMO verisi: tanıtım ve önizleme için örnek berberler, çalışanlar, hizmetler, müşteriler, yorumlar ve randevular.
 * CANLI VERİTABANINDA ÇALIŞTIRMAYIN. Tekrar çalıştırılırsa demo işletmeleri zaten varsa bir şey yapmaz.
 *
 *   npm run db:seed && npm run db:seed-demo
 *
 * Girişler:
 *   Yönetici  /admin    demo-admin@ornek.local / DemoAdmin2026!
 *   İşletme   /isletme  demo-isletme / DemoIsletme2026
 *   Müşteri   /giris    demo-musteri@ornek.local / DemoMusteri2026
 */
import { loadEnv } from "./env";

loadEnv();
if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_FORCE !== "1") {
  console.error("Canlı ortamda demo verisi yüklenmez (zorlamak için DEMO_SEED_FORCE=1).");
  process.exit(1);
}

const INK = "#1c1917";

async function main() {
  const sharp = (await import("sharp")).default;
  const { eq, sql, and } = await import("drizzle-orm");
  const { db } = await import("../src/server/db/client");
  const s = await import("../src/server/db/schema");
  const { hashPassword } = await import("../src/server/auth/password");
  const { createBusiness } = await import("../src/server/modules/admin/businesses");
  const { processAndStoreImage } = await import("../src/server/storage/images");
  const { recalcRating } = await import("../src/server/modules/reviews/reviews");
  const { recomputeAllTrust } = await import("../src/server/modules/trust/score");

  const [exists] = await db.select().from(s.businessUsers).where(eq(s.businessUsers.login, "demo-isletme"));
  if (exists) {
    console.log("Demo verisi zaten yüklü.");
    process.exit(0);
  }

  // --- Görseller: sıcak tonlu soyut kapak ve harf logolar (gerçek fotoğraf yerine) ---
  const palettes = [
    ["#3f3a36", "#8a6d4b"],
    ["#2b2f33", "#6b7a80"],
    ["#4a3b2f", "#c49a6c"],
    ["#26302b", "#7a8c6e"],
    ["#3b2f35", "#9c7a86"],
    ["#2f2a26", "#b08d57"],
  ];
  const cover = async (i: number) => {
    const [a, b] = palettes[i % palettes.length]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      ${Array.from({ length: 14 }, (_, k) => `<rect x="${k * 120 - 200}" y="-100" width="40" height="1200" fill="#fff" opacity="0.04" transform="rotate(25 800 450)"/>`).join("")}
      <circle cx="1250" cy="250" r="260" fill="#fff" opacity="0.05"/>
    </svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };
  const logo = async (letter: string, i: number) => {
    const [, b] = palettes[i % palettes.length]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${INK}"/>
      <text x="200" y="262" font-family="Georgia, serif" font-size="200" text-anchor="middle" fill="${b}">${letter}</text></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };
  const portfolio = async (i: number) => {
    const [a, b] = palettes[(i + 2) % palettes.length]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><defs><radialGradient id="r"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs>
      <rect width="1000" height="1000" fill="url(#r)"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };

  // --- Yönetici ---
  const [admin] = await db
    .insert(s.platformAdmins)
    .values({ email: "demo-admin@ornek.local", name: "Demo Yönetici", passwordHash: await hashPassword("DemoAdmin2026!") })
    .onConflictDoNothing()
    .returning();
  const adminId = admin?.id ?? (await db.select().from(s.platformAdmins).where(eq(s.platformAdmins.email, "demo-admin@ornek.local")))[0]!.id;

  // --- Banner ---
  const bannerImg = await processAndStoreImage(await cover(5), "banner", "banners");
  await db.insert(s.banners).values({
    title: "İlk randevuna özel, beklemeden koltuğa",
    subtitle: "Yakınındaki berberlerin boş saatlerini gör, saniyeler içinde randevu al.",
    imageKey: bannerImg.key,
    imageUrl: bannerImg.url,
    imageWidth: bannerImg.width,
    imageHeight: bannerImg.height,
    linkUrl: "/ara",
    buttonText: "Berber bul",
  });

  await seedDemoAds(db, s, processAndStoreImage, cover);

  const types = await db.select().from(s.serviceTypes);
  const typeId = (name: string) => types.find((t) => t.name === name)?.id ?? null;
  const district = async (province: string, name: string) => {
    const [d] = await db
      .select({ id: s.districts.id, provinceId: s.districts.provinceId })
      .from(s.districts)
      .innerJoin(s.provinces, eq(s.provinces.id, s.districts.provinceId))
      .where(and(eq(s.provinces.name, province), eq(s.districts.name, name)));
    if (!d) throw new Error(`İlçe yok: ${province}/${name}`);
    return d;
  };

  const BUSINESSES = [
    { name: "Usta Makas Moda", province: "İstanbul", district: "Kadıköy", address: "Caferağa Mah. Moda Cad. No:42", lat: 40.9862, lng: 29.0261, desc: "Moda'nın sakin sokaklarında klasik berberlik ve modern kesimler. Kahveniz bizden.", staff: [["Mehmet Yıldız", "Usta berber"], ["Can Aydın", "Berber"], ["Emre Koç", "Kalfa"]], featured: true },
    { name: "Beşiktaş Erkek Kuaförü", province: "İstanbul", district: "Beşiktaş", address: "Sinanpaşa Mah. Ihlamurdere Cad. No:18", lat: 41.0438, lng: 29.0059, desc: "Çarşının kalbinde, 1998'den beri.", staff: [["Hasan Demir", "Usta berber"], ["Burak Şahin", "Berber"]], featured: true },
    { name: "Nişantaşı Barber Studio", province: "İstanbul", district: "Şişli", address: "Teşvikiye Mah. Abdi İpekçi Cad. No:7", lat: 41.0505, lng: 28.9937, desc: "Randevulu, sakin ve özenli bir deneyim. Sakal tasarımında uzmanız.", staff: [["Kerem Arslan", "Stil uzmanı"], ["Ali Kaya", "Berber"]], featured: false },
    { name: "Üsküdar Sahil Berber", province: "İstanbul", district: "Üsküdar", address: "Mimar Sinan Mah. Hakimiyeti Milliye Cad. No:31", lat: 41.0259, lng: 29.0154, desc: "Mahallenin berberi. Çocuk kesiminde sabırlıyız.", staff: [["Osman Çelik", "Usta berber"]], featured: false },
    { name: "Çankaya Klasik Berber", province: "Ankara", district: "Çankaya", address: "Kızılay Mah. Tunalı Hilmi Cad. No:90", lat: 39.9045, lng: 32.8597, desc: "Ustura tıraşı ve sıcak havlu geleneği.", staff: [["Yusuf Öztürk", "Usta berber"], ["Serkan Polat", "Berber"]], featured: true },
    { name: "Karşıyaka Makas", province: "İzmir", district: "Karşıyaka", address: "Bahariye Mah. Kemalpaşa Cad. No:12", lat: 38.4555, lng: 27.1199, desc: "Çarşı içinde, güler yüzlü hizmet.", staff: [["Murat Güneş", "Usta berber"], ["Deniz Ateş", "Berber"]], featured: false },
  ] as const;

  const SERVICES: [string, number, number, string][] = [
    ["Saç Kesimi", 45000, 30, "Saç Kesimi"],
    ["Sakal Tıraşı", 25000, 20, "Sakal Tıraşı"],
    ["Saç + Sakal", 60000, 45, "Saç ve Sakal"],
    ["Çocuk Saç Kesimi", 30000, 25, "Çocuk Saç Kesimi"],
    ["Ustura ile Tıraş", 35000, 30, "Sakal Tıraşı"],
    ["Cilt Bakımı", 50000, 40, "Cilt Bakımı"],
  ];

  // --- Müşteriler ---
  const customerNames = ["Ahmet Yılmaz", "Barış Kurt", "Cem Erdem", "Doğan Aksoy", "Efe Tunç", "Furkan Yalçın", "Gökhan Uçar", "Hakan Bulut", "İlker Sezer", "Kaan Duman"];
  const custPw = await hashPassword("DemoMusteri2026");
  const custs = await db
    .insert(s.customers)
    .values([
      { name: "Demo Müşteri", email: "demo-musteri@ornek.local", phone: "+905301112233", passwordHash: custPw, kvkkConsentAt: new Date(), emailVerifiedAt: new Date() },
      ...customerNames.map((n, i) => ({
        name: n,
        email: `musteri${i + 1}@ornek.local`,
        phone: `+90532${String(1000000 + i * 7919).slice(0, 7)}`,
        passwordHash: custPw,
        kvkkConsentAt: new Date(),
        emailVerifiedAt: new Date(),
      })),
    ])
    .returning();

  const COMMENTS = [
    [5, "Mehmet usta işini çok iyi biliyor, tam istediğim gibi oldu."],
    [5, "Temiz, düzenli ve zamanında. Kesinlikle tavsiye ederim."],
    [4, "Kesim güzeldi, biraz bekledim ama değdi."],
    [5, "Sakal tasarımı mükemmeldi. Bir dahaki sefere yine buradayım."],
    [5, "Randevu sistemi çok pratik, gittiğimde hemen başladık."],
    [4, "Güler yüzlü ekip, fiyatlar makul."],
    [5, "Uzun zamandır bu kadar memnun kalmamıştım."],
    [3, "Kesim fena değildi ama biraz aceleye geldi."],
    [5, "Çocuğum ilk kez ağlamadan saç kestirdi, teşekkürler!"],
    [5, "Ustura tıraşı ve sıcak havlu harikaydı."],
    [4, null],
    [5, "Her zamanki gibi kusursuz."],
  ] as const;

  const tz = "Europe/Istanbul";
  const dayStr = (offset: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.now() + offset * 86_400_000));
  const at = (offset: number, hhmm: string) => new Date(`${dayStr(offset)}T${hhmm}:00+03:00`);

  let demoBusinessId = "";
  for (const [i, b] of BUSINESSES.entries()) {
    const d = await district(b.province, b.district);
    const login = i === 0 ? "demo-isletme" : `demo-isletme-${i + 1}`;
    const created = await createBusiness(db, { adminId }, {
      name: b.name,
      phone: `+90216${String(3000000 + i * 1234567).slice(0, 7)}`,
      email: `${login}@ornek.local`,
      addressLine: b.address,
      provinceId: d.provinceId,
      districtId: d.id,
      ownerName: b.staff[0]![0],
      login,
    });
    const bid = created!.businessId;
    if (i === 0) demoBusinessId = bid;
    await db.update(s.businessUsers).set({ passwordHash: await hashPassword("DemoIsletme2026"), mustChangePassword: false }).where(eq(s.businessUsers.businessId, bid));

    const cv = await processAndStoreImage(await cover(i), "cover", `businesses/${bid}`);
    const lg = await processAndStoreImage(await logo(b.name[0]!, i), "logo", `businesses/${bid}`);

    // Çalışma saatleri: Pzt–Cmt 09:00–20:00, Pazar 10:00–17:00 (ilk işletme her gün geç saate kadar açık)
    for (let w = 1; w <= 7; w++) {
      const [st, en] = w === 7 ? ["10:00", "17:00"] : ["09:00", i === 0 ? "22:00" : "20:00"];
      await db.insert(s.businessHours).values({ businessId: bid, weekday: w, startTime: st, endTime: en });
    }

    const svcRows = await db
      .insert(s.services)
      .values(SERVICES.slice(0, i % 2 === 0 ? 6 : 4).map(([name, price, dur, type], k) => ({ businessId: bid, name, priceKurus: price + i * 2500, durationMin: dur, serviceTypeId: typeId(type), sortOrder: k })))
      .returning();

    const staffRows = [];
    for (const [k, [name, title]] of b.staff.entries()) {
      const [st] = await db.insert(s.staff).values({ businessId: bid, name, title, sortOrder: k }).returning();
      staffRows.push(st!);
      for (let w = 1; w <= 7; w++) {
        const [a, e] = w === 7 ? ["10:00", "17:00"] : ["09:00", i === 0 ? "22:00" : "20:00"];
        await db.insert(s.staffShifts).values({ businessId: bid, staffId: st!.id, weekday: w, startTime: a, endTime: e });
      }
      await db.insert(s.staffServices).values(svcRows.map((sv) => ({ businessId: bid, staffId: st!.id, serviceId: sv.id })));
    }

    // Dükkan fotoğrafları (dış cephe + iç mekân örnekleri)
    for (const [k, kind] of (["EXTERIOR", "INTERIOR", "INTERIOR", "INTERIOR"] as const).entries()) {
      const img = await processAndStoreImage(await cover(i + k + 1), "portfolio", `businesses/${bid}/shop`);
      await db.insert(s.shopPhotos).values({ businessId: bid, kind, storageKey: img.key, url: img.url, width: img.width, height: img.height, sizeBytes: img.sizeBytes, sortOrder: k, uploadedBy: "ADMIN" });
    }

    // Portfolyo
    for (let p = 0; p < 6; p++) {
      const img = await processAndStoreImage(await portfolio(i + p), "portfolio", `businesses/${bid}/portfolio`);
      await db.insert(s.portfolioPhotos).values({ businessId: bid, storageKey: img.key, url: img.url, width: img.width, height: img.height, sizeBytes: img.sizeBytes, mime: img.mime, sortOrder: p, staffId: staffRows[p % staffRows.length]!.id });
    }

    await db
      .update(s.businesses)
      .set({
        description: b.desc,
        latitude: b.lat,
        longitude: b.lng,
        coverKey: cv.key,
        coverUrl: cv.url,
        logoKey: lg.key,
        logoUrl: lg.url,
        status: "ACTIVE",
        isPublished: true,
        publishedAt: new Date(),
        isFeatured: b.featured,
        featuredRank: b.featured ? i : null,
        photoCount: 6,
        minPriceKurus: Math.min(...svcRows.map((x) => x.priceKurus)),
        lastPanelActivityAt: new Date(),
      })
      .where(eq(s.businesses.id, bid));

    // Geçmiş randevular (tamamlandı) + yorumlar
    const reviewCount = [12, 9, 7, 4, 11, 5][i]!;
    for (let r = 0; r < reviewCount; r++) {
      const c = custs[(r + i) % custs.length]!;
      const st = staffRows[r % staffRows.length]!;
      const sv = svcRows[r % svcRows.length]!;
      const [bc] = await db
        .insert(s.businessCustomers)
        .values({ businessId: bid, customerId: c.id, displayName: c.name, phone: c.phone, email: c.email, visitCount: 1, firstVisitAt: at(-(r + 2), "10:00"), lastVisitAt: at(-(r + 2), "10:00") })
        .onConflictDoNothing()
        .returning();
      const bcId = bc?.id ?? (await db.select().from(s.businessCustomers).where(and(eq(s.businessCustomers.businessId, bid), eq(s.businessCustomers.customerId, c.id))))[0]!.id;
      const start = at(-(r * 2 + 2), `${String(10 + (r % 8)).padStart(2, "0")}:00`);
      const end = new Date(start.getTime() + sv.durationMin * 60_000);
      const [ap] = await db
        .insert(s.appointments)
        .values({ businessId: bid, staffId: st.id, businessCustomerId: bcId, customerId: c.id, startsAt: start, endsAt: end, blockedUntil: end, status: "COMPLETED", source: "ONLINE", confirmedAt: new Date(start.getTime() - 86_400_000 + 25 * 60_000), totalKurus: sv.priceKurus, createdAt: new Date(start.getTime() - 86_400_000) })
        .returning();
      await db.insert(s.appointmentItems).values({ appointmentId: ap!.id, serviceId: sv.id, nameSnapshot: sv.name, priceSnapshotKurus: sv.priceKurus, durationSnapshotMin: sv.durationMin });
      const [rating, comment] = COMMENTS[(r + i * 3) % COMMENTS.length]!;
      await db.insert(s.reviews).values({
        businessId: bid,
        appointmentId: ap!.id,
        customerId: c.id,
        staffId: st.id,
        rating: i === 3 && r === 0 ? 4 : rating,
        comment,
        createdAt: new Date(end.getTime() + 3_600_000),
        ...(r === 0 ? { businessReply: "Güzel yorumunuz için teşekkür ederiz, tekrar bekleriz!", repliedAt: new Date(end.getTime() + 7_200_000) } : {}),
      });
    }
    await recalcRating(db, bid);
  }

  // --- Demo işletmesinin yaklaşan randevuları (takvim ve onay bekleyenler dolu görünsün) ---
  const demoStaff = await db.select().from(s.staff).where(eq(s.staff.businessId, demoBusinessId));
  const demoSvcs = await db.select().from(s.services).where(eq(s.services.businessId, demoBusinessId));
  const upcoming: [number, string, number, number, "CONFIRMED" | "PENDING", "ONLINE" | "PANEL"][] = [
    [0, "11:00", 0, 0, "CONFIRMED", "ONLINE"],
    [0, "12:30", 1, 2, "CONFIRMED", "PANEL"],
    [0, "15:00", 0, 2, "CONFIRMED", "ONLINE"],
    [0, "17:00", 2, 1, "PENDING", "ONLINE"],
    [0, "20:00", 1, 0, "PENDING", "ONLINE"],
    [1, "10:00", 0, 0, "CONFIRMED", "ONLINE"],
    [1, "11:00", 1, 3, "PENDING", "ONLINE"],
    [1, "14:00", 2, 4, "CONFIRMED", "PANEL"],
    [2, "13:00", 0, 2, "CONFIRMED", "ONLINE"],
    [3, "16:00", 1, 0, "PENDING", "ONLINE"],
  ];
  for (const [k, [day, hhmm, si, svi, status, source]] of upcoming.entries()) {
    const start = at(day, hhmm);
    if (start.getTime() < Date.now()) continue;
    const st = demoStaff[si % demoStaff.length]!;
    const sv = demoSvcs[svi % demoSvcs.length]!;
    const c = source === "PANEL" ? null : custs[k % custs.length]!;
    const [bc] = c
      ? await db.select().from(s.businessCustomers).where(and(eq(s.businessCustomers.businessId, demoBusinessId), eq(s.businessCustomers.customerId, c.id)))
      : await db.insert(s.businessCustomers).values({ businessId: demoBusinessId, displayName: ["Selim Bey", "Kapıdan müşteri"][k % 2]!, phone: "+905559998877" }).returning();
    const bcId =
      bc?.id ??
      (await db.insert(s.businessCustomers).values({ businessId: demoBusinessId, customerId: c!.id, displayName: c!.name, phone: c!.phone, email: c!.email }).returning())[0]!.id;
    const end = new Date(start.getTime() + sv.durationMin * 60_000);
    const [ap] = await db
      .insert(s.appointments)
      .values({
        businessId: demoBusinessId,
        staffId: st.id,
        businessCustomerId: bcId,
        customerId: c?.id ?? null,
        startsAt: start,
        endsAt: end,
        blockedUntil: end,
        status,
        source,
        totalKurus: sv.priceKurus,
        confirmDeadline: status === "PENDING" ? new Date(Math.min(Date.now() + 6 * 3_600_000, start.getTime())) : null,
        confirmedAt: status === "CONFIRMED" ? new Date() : null,
        customerNote: k === 3 ? "Yandan kısa, üstten biraz uzun kalsın lütfen." : null,
      })
      .returning();
    await db.insert(s.appointmentItems).values({ appointmentId: ap!.id, serviceId: sv.id, nameSnapshot: sv.name, priceSnapshotKurus: sv.priceKurus, durationSnapshotMin: sv.durationMin });
  }

  await recomputeAllTrust(db);
  await db.execute(sql`select 1`);
  console.log("Demo verisi yüklendi: 6 işletme, 11 müşteri, yorumlar ve randevular.");
  console.log("Yönetici: demo-admin@ornek.local / DemoAdmin2026!  ·  İşletme: demo-isletme / DemoIsletme2026  ·  Müşteri: demo-musteri@ornek.local / DemoMusteri2026");
  process.exit(0);
}

/** Örnek reklam alanları (işletme listelerinin arası): biri herkese, biri yalnızca İstanbul'a. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDemoAds(db: any, s: any, store: any, cover: (i: number) => Promise<Buffer>) {
  const ads = [
    { title: "Erkek bakımında yeni sezon: %20 indirim", subtitle: "Seçili berberlerde sakal bakım paketi bu ay indirimli.", buttonText: "İncele", linkUrl: "/ara?hizmet=sakal-tirasi", provinceId: null, sortOrder: 0, img: 2 },
    { title: "İstanbul'da bugün boş saat var", subtitle: "Beklemeden randevu al, sıra bekleme.", buttonText: "Bugün müsait olanlar", linkUrl: "/ara?bugun=1&il=34", provinceId: 34, sortOrder: 1, img: 3 },
  ];
  for (const a of ads) {
    const img = await store(await cover(a.img), "banner", "banners");
    const { img: _i, ...rest } = a;
    void _i;
    await db.insert(s.banners).values({ ...rest, placement: "LISTING", imageKey: img.key, imageUrl: img.url, imageWidth: img.width, imageHeight: img.height });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
