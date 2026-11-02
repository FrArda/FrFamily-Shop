# FR Family Shop

Eklenen sistemler:

- `/shop` — yalnızca FrArda veya sunucu sahibi kullanabilir; ortak mağaza giriş mesajını komutun kullanıldığı kanala gönderir.
- `/coin` — kullanıcı kendi Coin bakiyesini özel yanıtta görür.
- `/coin-ekle kullanici miktar` — yetkili kullanıcıya coin ekler.
- Üst Roller — Discord'daki gerçek rol sırası korunarak `FR | ...` ile başlayan satışa uygun roller otomatik listelenir; yeni FR rolleri de otomatik görünür. Bot/managed roller ve `İSTEK ÖNERİ & ŞİKAYET` gibi FR olmayan işlevsel roller listeye girmez. Bot rolü otomatik vermez; satın alma sipariş olarak yöneticiye gönderilir.
- Özel Rol — coin düşer, sipariş yöneticiye DM olarak gider; rol bot tarafından oluşturulmaz/verilmez.
- Coin Satın Al / Join Satın Al — FRArda iletişim sayfasına yönlendirir.
- Diğer Ürünler — şimdilik **1 Aylık Discord Nitro: 100.000 coin**. Nitro teslimatı bot tarafından otomatik yapılmaz; sipariş FRArda'ya gönderilir.
- `#sipariş-aktivasyonu` — siparişin kullanıcı adı, kullanıcı ID'si, ürün, tutar ve durumunu gösterir.
- Yöneticiye DM ile gelen her siparişte **✅ Sipariş Tamamlandı** butonu bulunur. Butona basıldığında sipariş tamamlanır ve `#sipariş-aktivasyonu` kanalına otomatik tamamlandı bildirimi gönderilir.
- `/siparis-tamamla siparis:<ID>` — alternatif olarak yetkili siparişi tamamlar ve aktivasyon kanalına tamamlandı mesajı gönderir.
- `#kampanyalar` — otomatik kampanyalar başladığında başlangıç duyurusu gönderir; sonraki kampanya aralığı rastgele 6, 7 veya 8 gündür. Belirsiz Discord yanıtlarında aynı duyuru nonce ile doğrulanır, gönderilmiş mesaj ikinci kez atılmaz. Kampanya döneminde seçili mağaza ürünlerine indirim uygulanır.
- Ekonomi komutlarında gereksiz başlangıç menüsü gösterilmez. Kazı son 24 saatte en fazla 2 kez kullanılabilir; CF/Zar/Slot sonuçlarındaki tekrar butonları aynı mesajı günceller ve 1 dakika sonra kaldırılır. Slot yanıtları gizlidir ve tekrar bahisleri her seferinde 10 Coin artar.
- Rol fiyatları için isteğe bağlı `SHOP_ROLE_PRICES_JSON` kullanılabilir. Örnek: `{ "ROL_ID": 2500 }`
- Kampanya görseli için isteğe bağlı `SHOP_CAMPAIGN_IMAGE_URL` kullanılabilir.

Siparişler, coinler ve mağaza ayarları `SHOP_DATA_DIR/fr-family-shop.json` içinde tutulur. Render blueprint bu dizini `/var/data` kalıcı diskine bağlar; restart/deploy sonrasında coin ve shop verileri korunur.


### GUI v5
- Mağaza arayüzü görsel banner + zengin embed kartlarıyla yenilendi.
- Rol listesi gerçek Discord rol sırasını korur ve fiyatları kart/alan görünümünde gösterir.
- Rol, özel rol ve Nitro alımlarında önce **Satın Alma Onayı** ekranı açılır; kullanıcı onaylamadan coin düşmez.
- Mağaza bannerı `/shop-assets/fr-family-shop.jpg` adresinde servis edilir. Varsayılan adres `PUBLIC_BASE_URL` veya `FR_SHOP_ACTIVITY_URL` üzerinden oluşturulur; istenirse `SHOP_BANNER_URL` ile değiştirilebilir.
