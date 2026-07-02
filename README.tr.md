*[English](README.md) · Türkçe*

# Smart Gadget

Xiaomi/Yeelight akıllı lambaları yerel ağ üzerinden kontrol eden küçük bir
Windows masaüstü uygulaması: açma/kapama, parlaklık, beyaz tonu ve renk.
Sistem tepsisinde yaşar, kompakt bir **mini modu** vardır ve **her zaman
üstte** sabitlenebilir.

## Özellikler

- 💡 **Yeelight kontrolü** — açma/kapama, parlaklık, renk sıcaklığı ve hazır
  renk paletiyle RGB renk.
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
  masaüstü arayüzü anında güncellenir.

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
