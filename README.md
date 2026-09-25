# Ziina ↔ Zoho Books

منصة لإنشاء روابط دفع Ziina ومتابعتها، ثم إصدار الفاتورة وتسجيل الدفعة في Zoho Books بضغطة زر.

## كيف يعمل
1. **إنشاء رابط** (`/links/new` أو `/quick-link`) ← يُنشأ Payment Intent في Ziina ويُحفظ مع بيانات العميل.
   > Ziina API لا يوفّر قائمة بالدفعات ولا يُرجع بيانات الدافع، لذلك يجب إنشاء الروابط من هذا التطبيق حتى تُتابَع تلقائيًا.
2. **المتابعة**: Ziina يُرسل Webhook عند تغيّر الحالة، ومهمة Cron كل 10 دقائق تحدّث الدفعات المعلّقة احتياطيًا.
3. **القائمة** (`/payments`) مقسّمة: مدفوع بدون فاتورة / فاتورة بدون دفعة / مكتمل / بانتظار الدفع / أخطاء / فشل.
4. **الترحيل إلى Zoho**: اختيار الخدمة ← البحث عن العميل (إيميل ← هاتف ← اسم) أو إنشاؤه ← فاتورة (`reference_number` = رقم دفعة Ziina) ← تسجيل الدفعة بتاريخ الدفع مع رسوم Ziina كـ bank charges ← إرسال إيميل اختياري (الافتراضي: لا).
   كل خطوة تبحث في Zoho أولًا، فإعادة التشغيل لا تُنشئ تكرارًا وتكمل من حيث توقفت.
5. **استيراد** (`/import`): ملف CSV من لوحة Ziina، أو جلب دفعة برقمها.

## التشغيل محليًا
```bash
npm install
cp .env.example .env      # ثم عبّئ القيم (DATABASE_URL = رابط MySQL)
npx prisma migrate deploy
npm run dev               # http://localhost:3000
npm test
```

## الإعداد

### Ziina
- أنشئ API token من `ziina.com/business/connect` ← "Other builder or custom" (صلاحية `write_payment_intents`) وضعه في `ZIINA_API_TOKEN`.
- اجعل `ZIINA_TEST_MODE="true"` للتجربة ثم `false` للإنتاج.
- بعد النشر على رابط عام: الإعدادات ← **تسجيل الـ Webhook** (يستخدم `ZIINA_WEBHOOK_SECRET` للتوقيع).

### Zoho Books (Self Client)
1. افتح [Zoho API Console](https://api-console.zoho.com/) (بنفس الـ DC الخاص بحسابك، مثلًا `.com` أو `.sa`) ← **Self Client**.
2. انسخ Client ID / Secret.
3. في تبويب Generate Code استخدم scopes:
   `ZohoBooks.contacts.ALL,ZohoBooks.invoices.ALL,ZohoBooks.customerpayments.ALL,ZohoBooks.settings.READ,ZohoBooks.accountants.READ`
4. الأسهل: شغّل `npm run zoho:setup` والصق القيم، وسيحفظ كل شيء في `.env` تلقائيًا. أو يدويًا بدّل الكود بـ refresh token:
   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token?grant_type=authorization_code&client_id=ID&client_secret=SECRET&code=CODE"
   ```
5. ضع `ZOHO_REFRESH_TOKEN` و`ZOHO_ORG_ID` (من Zoho Books ← Settings ← Organization Profile) و`ZOHO_DC`.
6. في الإعدادات داخل التطبيق اختر الحساب الذي تُودَع فيه دفعات Ziina (يُنصح بحساب باسم Ziina).

## النشر على Coolify (من GitHub)
1. **قاعدة البيانات**: MySQL 8 داخل Coolify (Access: Private).
2. **New Resource ← Application ← GitHub** واختر المستودع، و**Build Pack: Dockerfile**، والمنفذ **3000**.
3. **Domains**: `https://pay.foxstrik.com` (سجل DNS من نوع A يشير إلى خادم Coolify).
4. **Environment Variables**: كل ما في `.env.example`، مع:
   - `DATABASE_URL` = قيمة **MySQL URL (internal)** من صفحة قاعدة البيانات.
   - `APP_URL=https://pay.foxstrik.com`
   - `ZIINA_TEST_MODE=false` عند الانتقال للإنتاج.
5. **Deploy**. الحاوية تطبّق الـ migrations تلقائيًا عند كل تشغيل (`prisma migrate deploy`).
6. بعد النجاح: الإعدادات ← **تسجيل الـ Webhook في Ziina**.

### Cron
في Coolify ← التطبيق ← **Scheduled Tasks** ← أضف مهمة كل 10 دقائق (`*/10 * * * *`) بالأمر:
```bash
wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/refresh
```
تحدّث حالات Ziina المعلّقة وتطابق الدفعات مع Zoho تلقائيًا.

## ملاحظات
- المبالغ داخليًا بالفلس (1 AED = 100). الحد الأدنى لـ Ziina: 2 AED.
- الفواتير بدون ضريبة (VAT). لتفعيلها عدّل `tax_id` في `src/lib/zoho.ts` → `createInvoice`.
- صيغة CSV من Ziina غير موثقة؛ صفحة الاستيراد تسمح بمطابقة الأعمدة يدويًا.
- حد Zoho: 100 طلب/دقيقة؛ العميل يعيد المحاولة تلقائيًا عند 429.
