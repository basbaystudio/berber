import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { adminLogin, businessFirstLogin, createBusinessViaAdmin } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

/** Hızlı kurulum: çalışma saatleri, çalışan, vardiya ve hizmet doğrudan veritabanına yazılır. */
async function setupBusiness(login: string) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select business_id from business_users where login = $1", [login]);
    const bid = rows[0].business_id as string;
    for (let d = 1; d <= 7; d++) await pool.query("insert into business_hours (business_id, weekday, start_time, end_time) values ($1,$2,'09:00','19:00')", [bid, d]);
    const st = await pool.query("insert into staff (business_id, name) values ($1, 'Mehmet Usta') returning id", [bid]);
    const sid = st.rows[0].id as string;
    for (let d = 1; d <= 7; d++) await pool.query("insert into staff_shifts (business_id, staff_id, weekday, start_time, end_time) values ($1,$2,$3,'09:00','19:00')", [bid, sid, d]);
    const sv = await pool.query("insert into services (business_id, name, price_kurus, duration_min) values ($1,'Saç Kesimi',45000,30) returning id", [bid]);
    await pool.query("insert into staff_services (business_id, staff_id, service_id) values ($1,$2,$3)", [bid, sid, sv.rows[0].id]);
  } finally {
    await pool.end();
  }
}

const tomorrow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(Date.now() + 86_400_000));

test("panelden randevu: oluştur, takvimde gör, saat değiştir, iptal et", async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const login = `takvim-${suffix}`;
  await adminLogin(page);
  const { tempPassword } = await createBusinessViaAdmin(page, `Takvim Berber ${suffix}`, login);
  await setupBusiness(login);
  const { ctx, bp } = await businessFirstLogin(browser, testInfo, login, tempPassword);
  const day = tomorrow();

  // Yeni randevu
  await bp.goto(`/isletme/panel/randevular/yeni?tarih=${day}`);
  await bp.waitForLoadState("networkidle");
  await bp.getByRole("button", { name: "Oluştur", exact: false }).last().click(); // boş gönderim
  await expect(bp.getByText("Müşteri seçin ya da adını yazın.")).toBeVisible();
  await bp.getByRole("button", { name: "Yeni müşteri" }).click();
  await bp.getByLabel("Ad soyad").fill("Kapıdan Ali");
  await bp.getByLabel("Telefon").fill("0532 111 22 33");
  await bp.getByRole("checkbox", { name: /Saç Kesimi/ }).check();
  const slots = bp.getByRole("radiogroup", { name: "Müsait saatler" }).getByRole("radio");
  await expect(slots.first()).toBeVisible();
  await expect(bp.getByText("Süre 30 dk")).toBeVisible();
  await bp.getByRole("radio", { name: "10:00" }).click();
  await bp.screenshot({ path: testInfo.outputPath("30-yeni-randevu.png"), fullPage: true });
  await bp.getByRole("button", { name: "Randevuyu oluştur" }).click();
  await expect(bp.getByText("Randevu oluşturuldu.")).toBeVisible();
  await expect(bp.getByText("Onaylandı").first()).toBeVisible();
  const detailUrl = bp.url();

  // Aynı saat artık müsait değil
  await bp.goto(`/isletme/panel/randevular/yeni?tarih=${day}`);
  await bp.waitForLoadState("networkidle");
  await bp.getByRole("checkbox", { name: /Saç Kesimi/ }).check();
  await expect(bp.getByRole("radio", { name: "10:30" })).toBeVisible();
  await expect(bp.getByRole("radio", { name: "10:00", exact: true })).toHaveCount(0);

  // Takvim (gün görünümü)
  await bp.goto(`/isletme/panel/takvim?gorunum=gun&tarih=${day}`);
  await expect(bp.getByRole("link", { name: /Kapıdan Ali/ })).toBeVisible();
  await bp.screenshot({ path: testInfo.outputPath("31-takvim-gun.png"), fullPage: true });
  await bp.getByRole("link", { name: "Hafta", exact: true }).click();
  await expect(bp.getByRole("link", { name: /Kapıdan Ali/ })).toBeVisible();
  await bp.getByRole("link", { name: "Ay", exact: true }).click();
  await expect(bp.getByText("1 randevu").first()).toBeVisible();

  // Saat değiştir
  await bp.goto(detailUrl);
  await bp.waitForLoadState("networkidle");
  await bp.getByRole("radio", { name: "15:00" }).click();
  await bp.getByRole("button", { name: "Yeni zamanı kaydet" }).click();
  await expect(bp.getByText("Randevu güncellendi.")).toBeVisible();
  await expect(bp.getByRole("heading", { name: /15:00/ })).toBeVisible();
  await bp.screenshot({ path: testInfo.outputPath("32-randevu-detay.png"), fullPage: true });

  // İptal
  await bp.getByRole("button", { name: "Randevuyu iptal et" }).click();
  await bp.getByLabel("İptal notu").fill("Müşteri aradı");
  await bp.getByRole("button", { name: "Randevuyu iptal et" }).click();
  await expect(bp.getByText("İptal edildi").first()).toBeVisible();

  // Müşteriler
  await bp.goto("/isletme/panel/musteriler");
  await expect(bp.getByRole("link", { name: /Kapıdan Ali/ })).toBeVisible();
  // Randevu ayarları
  await bp.goto("/isletme/panel/ayarlar");
  await bp.getByLabel("Randevular arası tampon (dk)").fill("10");
  await bp.getByRole("button", { name: "Kaydet" }).click();
  await expect(bp.getByText("Randevu ayarları kaydedildi.")).toBeVisible();
  // Genel bakış metrikleri ve güven puanı
  await bp.goto("/isletme/panel");
  await expect(bp.getByText("Güven puanı")).toBeVisible();
  await bp.screenshot({ path: testInfo.outputPath("33-genel-bakis.png"), fullPage: true });
  await ctx.close();
});
