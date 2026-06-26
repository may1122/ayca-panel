# AYÇA Panel

Next.js + Supabase ile gerçek müşteri/admin paneli başlangıç projesi.

## Kurulum

1. GitHub'da `ayca-panel` isimli repo aç.
2. Bu klasördeki dosyaları repoya yükle.
3. Supabase'te yeni proje aç.
4. `supabase/schema.sql` dosyasını Supabase SQL Editor'da çalıştır.
5. Supabase Project URL ve Anon Key değerlerini al.
6. `.env.local.example` dosyasını `.env.local` olarak kopyala ve değerleri doldur.
7. Vercel'de repo'yu import et.
8. Vercel Environment Variables içine aynı iki değeri ekle.

## Komutlar

```bash
npm install
npm run dev
```

## Sayfalar

- `/login` giriş ekranı
- `/dashboard` müşteri paneli
- `/admin` yönetici paneli

## Not

Admin kullanıcı oluşturduktan sonra Supabase SQL Editor'da ilgili kullanıcının `profiles.role` değerini `admin` yapmalısın.
