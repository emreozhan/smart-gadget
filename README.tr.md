*[English](README.md) · Türkçe*

# Smart Gadget

Xiaomi/Yeelight akıllı lambaları yerel ağ üzerinden kontrol eden küçük bir
Windows masaüstü uygulaması: açma/kapama, parlaklık, beyaz tonu ve renk.
Sistem tepsisinde yaşar, kompakt bir **mini modu** vardır ve **her zaman
üstte** sabitlenebilir.

## Ekran görüntüleri

Görseller çalışan Windows uygulamasından alınmıştır; yalnızca uygulama penceresi
görünür. Ağ adresleri ve cihaz kimlikleri gizlilik için kapatılmıştır.

### Geniş ana ekran

Seçili lambayı yönetin, beyaz tonunun Kelvin değerini canlı görün,
parlaklığı ayarlayın ve renk seçin.

![Cihaz sekmeleri, canlı Kelvin değeri, parlaklık ve renk kontrolleriyle ana ekran](docs/screenshots/main.jpg)

### Cihaz bilgisi (debug)

Bağlantı durumu, gecikme, trafik, anlık lamba değerleri ve desteklenen komutları inceleyin.

![IP ve cihaz kimliği gizlenmiş canlı cihaz bilgisi paneli](docs/screenshots/debug.jpg)

### Cihaz ayarları

Yönetilecek lambaları seçin ve kayıtlı cihazlarınıza kendi isimlerinizi verin.

![Cihaz listesi ve isim değiştirme formunun açık olduğu ayarlar görünümü](docs/screenshots/settings.jpg)

### Mini mod

Cihaz seçimi, açma/kapama, parlaklık ve renk kontrollerine kompakt bir şeritten erişin.

![Smart Gadget uygulamasının kompakt mini modu](docs/screenshots/mini.jpg)

### Tray mode

Cihaz seçimi, açma/kapama, uygulama çalışma modu seçimi.

![Smart Gadget running in compact mini mode](docs/screenshots/trau.jpg)


## Özellikler

- 💡 **Yeelight kontrolü** — açma/kapama, parlaklık, renk sıcaklığı ve hazır
  renk paletiyle RGB renk.
- 🌡️ **Canlı Kelvin değeri** — beyaz tonu sürgüsünün yanında görünür ve sürüklerken
  güncellenir. RGB/HSV kullanılırken renk modu belirtilir.
- ✏️ **Cihaz isimleri** — **Cihazlar → ✎ → Kaydet** üzerinden lambalara isim verin;
  isimler kalıcıdır ve sekmelerde, mini modda ve tepsi menüsünde görünür.
- 🐞 **Cihaz bilgisi** — debug butonuyla bağlantı durumunu, gecikmeyi, trafiği,
  anlık değerleri ve desteklenen komutları görün.
- 🔎 **Otomatik keşif** — ağdaki lambaları kendiliğinden bulur; multicast
  engelliyse **IP ile ekle** seçeneği vardır.
- ▣ **Mini mod** — pencereyi sadece güç, parlaklık ve renk içeren kompakt bir
  şeride küçültür.
- 📌 **Her zaman üstte** — pencereyi oyunların/uygulamaların üzerine sabitler.
- 🔔 **Sistem tepsisi** — pencereyi kapatmak uygulamayı tepsiye gizler; tepsi
  ikonu lamba durumunu gösterir, sağ tık menüsünde hızlı aç/kapat, mini mod ve
  her zaman üstte anahtarları vardır.
- 🌐 **Türkçe / İngilizce** — bayrak butonuyla değişir; pencere konumu, mod ve
  dil tercihi kalıcıdır.
- 📱 **Canlı eşitleme** — lambayı telefon uygulamasından değiştirirseniz
  masaüstü arayüzü cihaz bildirimleriyle güncellenir; bildirim gelmezse
  30 saniyelik periyodik sorgulama devreye girer.

## Gereksinimler

1. **Node.js** ([nodejs.org](https://nodejs.org) LTS) — sadece kaynaktan
   çalıştırmak için; paketlenmiş `.exe` (aşağıya bakın) hiçbir şey gerektirmez.
2. **Lambada LAN Kontrolü açık olmalı** — Yeelight (veya Mi Home) telefon
   uygulamasında lambayı açın → ayarlar → **"LAN Kontrolü"**nü etkinleştirin.
   Bu olmadan lamba yerel bağlantıları reddeder.
3. Bilgisayar ve lamba **aynı ağda** olmalı.

## Çalıştırma

- `start.bat`'a çift tıklayın (ilk çalıştırmada paketleri indirir, sonra
  başlatır), veya
- Bir kez `npm install`, sonra `npm start`.

## Bağımsız .exe üretme

```
npm run dist
```

`dist/` altında uygulama ikonlu, taşınabilir bir `Smart Gadget.exe` üretir —
istediğiniz yere kopyalayıp Node.js olmadan çalıştırabilirsiniz.

## Sorun giderme

- **Lamba bulunamadı:** LAN Kontrolü'nün açık ve aynı ağda olduğunuzdan emin
  olun. Bazı modemler Wi-Fi istemcileri arasında multicast'i engeller
  ("istemci izolasyonu") — bu durumda lambanın IP adresiyle **IP ile ekle**
  seçeneğini kullanın (IP, Yeelight uygulamasında veya modem arayüzünde
  görünür).
- **Hızlı slider hareketlerinde lamba yanıt vermiyor:** Yeelight cihazları
  dakikada ~60 komutla sınırlar; uygulama zaten komutları seyreltir ama çok
  uzun sürüklemeler sınıra takılabilir. Birkaç saniye bekleyin.
- **Windows Güvenlik Duvarı sorusu:** Windows sorduğunda hem "Özel" hem
  "Genel" ağ kutularını işaretleyin — birçok ev Wi-Fi ağı Windows tarafından
  *Genel* sayılır ve aksi halde keşif yanıtları (UDP) sessizce düşer. Soruyu
  kaçırdıysanız "Windows Defender Güvenlik Duvarı → Uygulamaya izin ver"
  bölümünden elle gelen kural ekleyin.

## Lisans

[MIT Lisansı](LICENSE) ile sunulmaktadır.
