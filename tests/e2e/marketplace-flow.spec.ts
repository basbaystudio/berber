import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { adminLogin, createBusinessViaAdmin } from "./helpers";

const DB = process.env.E2E_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_e2e";

async function publishReadyBusiness(login: string) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select business_id from business_users where login = $1", [login]);
    const bid = rows[0].business_id as string;
    for (let d = 1; d <= 7; d++) await pool.query("insert into business_hours (business_id, weekday, start_time, end_time) values ($1,$2,'00:05','23:55')", [bid, d]);
    const st = await pool.query("insert into staff (business_id, name, title) values ($1, 'Mehmet Usta', 'Usta berber') returning id", [bid]);
    const sid = st.rows[0].id as string;
    for (let d = 1; d <= 7; d++) await pool.query("insert into staff_shifts (business_id, staff_id, weekday, start_time, end_time) values ($1,$2,$3,'00:05','23:55')", [bid, sid, d]);
    const sv = await pool.query("insert into services (business_id, name, price_kurus, duration_min) values ($1,'Saç Kesimi',45000,30) returning id", [bid]);
    await pool.query("insert into staff_services (business_id, staff_id, service_id) values ($1,$2,$3)", [bid, sid, sv.rows[0].id]);
    await pool.query("update business_settings set min_lead_min = 0 where business_id = $1", [bid]);
    await pool.query("update businesses set status = 'ACTIVE', min_price_kurus = 45000 where id = $1", [bid]);
    await pool.query("update businesses set is_published = true, published_at = now() where id = $1", [bid]);
  } finally {
    await pool.end();
  }
}

async function verificationToken(email: string) {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("select payload from notifications where \"to\" = $1 and template = 'customer.verify_email' order by created_at desc limit 1", [email]);
    return (rows[0].payload.text as string).match(/token=([A-Za-z0-9_-]+)/)![1]!;
  } finally {
    await pool.end();
  }
}

const tomorrow = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date(Date.now() + 86_400_000));

test("misafir seçim yapar → kayıt olur → seçimler korunur → doğrular → randevu alır → iptal eder", async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const name = `Pazar Berber ${suffix}`;
  const login = `pazar-${suffix}`;
  await adminLogin(page);
  await createBusinessViaAdmin(page, name, login);
  await publishReadyBusiness(login);

  const ctx = await browser.newContext({ ...testInfo.project.use });
  const c = await ctx.newPage();
  // Ana sayfa ve arama
  await c.goto("/");
  await expect(c.getByRole("heading", { name: /Yakınındaki berberi bul/ })).toBeVisible();
  await c.screenshot({ path: testInfo.outputPath("40-ana-sayfa.png"), fullPage: true });
  await c.goto(`/ara?q=${encodeURIComponent(suffix)}`);
  await expect(c.getByText("1 berber bulundu")).toBeVisible();
  await c.screenshot({ path: testInfo.outputPath("41-arama.png"), fullPage: true });
  await c.getByRole("link", { name: new RegExp(name) }).click();

  // Profil
  await expect(c.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(c.getByText("Saç Kesimi").first()).toBeVisible();
  await c.screenshot({ path: testInfo.outputPath("42-profil.png"), fullPage: true });
  await c.getByRole("link", { name: "Seç" }).first().click();

  // Sihirbaz: hizmet ön seçili, yarın 10:00
  await expect(c.getByRole("heading", { name: "Randevu al" })).toBeVisible();
  await c.waitForLoadState("networkidle");
  await expect(c.getByRole("button", { name: /Saç Kesimi/ })).toHaveAttribute("aria-pressed", "true");
  const day = tomorrow();
  await c.getByRole("radiogroup", { name: "Tarih" }).getByRole("radio").nth(1).click();
  await c.getByRole("radio", { name: "10:00" }).click();
  await expect(c.getByText("işletmede ödenir")).toBeVisible();
  await expect(c).toHaveURL(new RegExp(`t=${day}.*s=10%3A00|s=10:00`));
  await c.screenshot({ path: testInfo.outputPath("43-sihirbaz.png"), fullPage: true });

  // Misafir: kayıt ol (seçimler korunur)
  await c.getByRole("link", { name: "Kayıt ol" }).last().click();
  const email = `musteri-${suffix}@test.local`;
  await c.getByLabel("Ad soyad").fill("Ayşe Yılmaz");
  await c.getByRole("textbox", { name: "E-posta" }).fill(email);
  await c.getByLabel("Cep telefonu").fill("0532 111 22 33");
  await c.locator("#password").fill("Musteri2026x");
  await c.locator("#passwordConfirm").fill("Musteri2026x");
  await c.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(c.getByText("aydınlatma metnini onaylayın")).toBeVisible();
  await c.getByLabel(/KVKK Aydınlatma Metni/).check();
  await c.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(c).toHaveURL(/\/berber\/.+\/randevu\?.*s=10/);
  await expect(c.getByRole("radio", { name: "10:00" })).toHaveAttribute("aria-checked", "true");
  await expect(c.getByText("e-posta adresinizi doğrulayın").first()).toBeVisible();
  const wizardUrl = c.url();

  // E-posta doğrulama → sihirbaza geri dön, onayla
  await c.goto(`/dogrula?token=${await verificationToken(email)}`);
  await expect(c.getByText("E-posta adresiniz doğrulandı")).toBeVisible();
  await c.goto(wizardUrl);
  await c.waitForLoadState("networkidle");
  await expect(c.getByRole("radio", { name: "10:00" })).toHaveAttribute("aria-checked", "true");
  await c.getByLabel("İşletmeye not (isteğe bağlı)").fill("Kısa kesim lütfen");
  await c.getByRole("button", { name: "Randevu talebini gönder" }).click();
  await expect(c).toHaveURL(/\/hesabim\/randevular\?yeni=/);
  await expect(c.getByText("Randevu talebiniz alındı")).toBeVisible();
  await expect(c.getByText("Onay bekliyor").first()).toBeVisible();
  await c.screenshot({ path: testInfo.outputPath("44-randevularim.png"), fullPage: true });

  // Aynı saat artık başkası için dolu
  const g = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await g.goto(wizardUrl.replace(/&s=[^&]+/, ""));
  await g.waitForLoadState("networkidle");
  await expect(g.getByRole("radio", { name: "10:30" })).toBeVisible();
  await expect(g.getByRole("radio", { name: "10:00", exact: true })).toHaveCount(0);

  // Favori ve iptal
  await c.goto(`/berber/${new URL(wizardUrl).pathname.split("/")[2]}`);
  await c.getByRole("button", { name: "Favorilere ekle" }).click();
  await expect(c.getByRole("button", { name: "Favorilerde" })).toBeVisible();
  await c.goto("/hesabim/favoriler");
  await expect(c.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await c.goto("/hesabim/randevular");
  c.once("dialog", (d) => d.accept());
  await c.getByRole("button", { name: "İptal et" }).click();
  await expect(c.getByText("Müşteri iptal etti")).toBeVisible();
  await expect(c.getByText("Yaklaşan randevunuz yok")).toBeVisible();
  await ctx.close();
});

test("misafir randevu sihirbazında giriş yapmadan randevu oluşturamaz", async ({ page }) => {
  await page.goto("/hesabim");
  await expect(page).toHaveURL(/\/giris\?next=(%2F|\/)hesabim/);
});
