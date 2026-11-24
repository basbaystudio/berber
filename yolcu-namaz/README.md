# Yolcu Namaz

Babam için: yolculukta güzergâh üzerindeki cami, mescit ve dinlenme tesislerini gösteren,
namaz vakti yaklaşınca “Baba, öğle vaktine 30 dk var, o sırada Gerede civarında olacaksın,
şurada kılabilirsin…” diye haber veren, sesli yol tarifi veren ücretsiz uygulama.

## Neler var
- **Harita ve yol tarifi:** Kendi konumu (yön oklu), varış noktası, aradaki rota; adım adım sesli tarif
  (“400 metre sonra sağa dönün”), rotadan çıkınca yeniden hesaplama.
- **Yol üstü yerler:** Rotanın 0,5–3 km yakınındaki cami, mescit, dinlenme tesisi (isteğe bağlı akaryakıt).
- **Namaz planı:** Her vakit girdiğinde nerede olunacağı (ilçe/il) ve o vakit içinde varılacak yerler.
- **Bildirimler:** Vakitten 15–60 dk önce ve vakit girince; vakit içindeyken 2,5 km ileride cami/mescit
  varsa haber verir. “Kıldım” denince o vakit için susar. Android'de uyarılar önceden kurulur, uygulama
  kapalıyken de çalar.
- **Mola hatırlatması:** Konum takibiyle aralıksız 2 saat (ayarlanabilir) sürüşte “Baba, 2 saattir
  yoldasın, dinlenme vakti gelmedi mi?” der, ilerideki tesisi önerir. 10 dk durunca sayaç sıfırlanır.
- **Yer ekleme:** Haritada olmayan cami/mescit/tesis telefona kaydedilir, istenirse OpenStreetMap'e
  not olarak bildirilir (hesap gerekmez). Yedekle/paylaş ve içe aktar.
- **Sade görünüm:** Büyük yazılar, akşamdan sonra otomatik koyu tema ve karartılmış harita.

## Namaz vakitleri — şehre göre
Varsayılan kaynak **namazvakti.com** (Türkiye Takvimi). Konumdan ilçe/il bulunur (Nominatim),
namazvakti.com'da o ilçe aranır (`CitySearch.php`), şehrin yıllık takvimi indirilip (`XML.php?cityID=`)
telefonda saklanır. Yurt dışında konuma göre sayfa (`Main.php?arz=&tul=`) kullanılır.
İnternet yoksa ya da site açılmazsa **Diyanet yöntemi** cihazda hesaplanır (`www/prayer.js`).
Not: namazvakti.com tarayıcıdan doğrudan okumaya (CORS) izin vermez; bu kısım Android uygulamasında
(CapacitorHttp) çalışır, web sürümünde Diyanet hesabına düşer.

## Kullanılan ücretsiz servisler
OpenStreetMap harita parçaları, OSRM (rota), Overpass (yerler), Nominatim (adres), OSM Notes (yeni yer).

## Geliştirme
```bash
npm install
npm test                     # namaz vakti hesabı testleri
npm run vendor               # Leaflet'i www/vendor'a kopyalar
npx cap sync android
cd android && ./gradlew assembleDebug   # APK: android/app/build/outputs/apk/debug/
```
Web sürümü: `www/` klasörünü herhangi bir statik sunucuda yayınlamak yeterli (PWA, ana ekrana eklenebilir).
