# إعداد Firebase — خطوة بخطوة

اللعبة تستخدم **Realtime Database** وليس Firestore. هذا مهم: الاثنان منتجان
مختلفان في نفس المشروع، واختيار الخطأ يعني أن شيئًا لن يعمل.

المدة المتوقعة: ~10 دقائق.

---

## 1. أنشئ المشروع

1. افتح <https://console.firebase.google.com>
2. **Add project** → اسم المشروع، مثلًا `qawsi-memory`
3. Google Analytics: **عطّله** (لا نحتاجه، ويختصر الخطوات)
4. **Create project**

---

## 2. فعّل الدخول المجهول

اللاعبون لا ينشئون حسابات؛ كل جهاز يحصل على هوية مؤقتة.

1. من القائمة الجانبية: **Build → Authentication → Get started**
2. تبويب **Sign-in method**
3. اختر **Anonymous** من القائمة
4. فعّل المفتاح → **Save**

> إن لم تفعّل هذا، ستفشل كل محاولة اتصال بخطأ `auth/admin-restricted-operation`.

---

## 3. أنشئ قاعدة البيانات (Realtime Database)

1. **Build → Realtime Database → Create Database**
2. اختر المنطقة. الأقرب للسعودية عمليًا:
   - `europe-west1` (بلجيكا) — الأفضل زمنيًا
   - أو `us-central1` (الافتراضي)
3. عند سؤال القواعد اختر **Start in locked mode** — سنرفع قواعدنا بعد قليل.
4. **Enable**

بعد الإنشاء سيظهر رابط في أعلى الصفحة بأحد الشكلين:

```
https://qawsi-memory-default-rtdb.firebaseio.com              (us-central1)
https://qawsi-memory-default-rtdb.europe-west1.firebasedatabase.app   (أوروبا)
```

**انسخه كما هو** — هذا هو `VITE_FIREBASE_DATABASE_URL`، وشكله يختلف حسب
المنطقة. خطأ شائع: كتابته يدويًا بالصيغة الأمريكية بينما القاعدة في أوروبا.

---

## 4. سجّل تطبيق الويب واحصل على القيم

1. **Project settings** (أيقونة الترس أعلى القائمة) → تبويب **General**
2. انزل إلى **Your apps** → اضغط أيقونة الويب `</>`
3. اسم التطبيق: `qawsi-web`. **لا تفعّل** Firebase Hosting.
4. **Register app**

ستظهر شاشة `firebaseConfig` بهذا الشكل:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "qawsi-memory.firebaseapp.com",
  databaseURL: "https://qawsi-memory-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "qawsi-memory",
  storageBucket: "qawsi-memory.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

انقل القيم إلى ملف `.env.local` في جذر المشروع:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=qawsi-memory.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://qawsi-memory-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=qawsi-memory
VITE_FIREBASE_STORAGE_BUCKET=qawsi-memory.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

> **هل هذه القيم سرّية؟** لا. `apiKey` في Firebase ليس كلمة سر — إنه معرّف
> عام يُشحن داخل أي تطبيق ويب. ما يحمي بياناتك هو **قواعد الأمان** في الخطوة
> التالية. لا ترفع `.env.local` إلى Git رغم ذلك (هو في `.gitignore` أصلًا).

---

## 5. ارفع قواعد الأمان — لا تتخطَّ هذه

بدونها قاعدة البيانات مقفلة تمامًا ولن يعمل شيء.

### الطريقة أ: عبر Firebase CLI (موصى بها)

```bash
npm i -g firebase-tools
firebase login
firebase use --add          # اختر مشروعك، وأعطه اللقب default
firebase deploy --only database
```

هذا يرفع `database.rules.json` الموجود في جذر المشروع.

### الطريقة ب: نسخ ولصق

1. **Realtime Database → تبويب Rules**
2. احذف المحتوى، والصق كامل محتوى `database.rules.json` من المشروع
3. **Publish**

**ماذا تفعل هذه القواعد؟**

- كل شيء ممنوع افتراضيًا.
- الغرفة يقرأها أعضاؤها فقط.
- `game` و`challenge` و`puzzles` و`status` — **المضيف وحده** يكتبها. لا يستطيع
  جهاز أن يعدّل نقاطه أو دوره.
- أي جهاز يضيف أمرًا فقط إذا كان `deviceUid` يساوي هويته — لا ينتحل الفريق الآخر.
- `presence/{uid}` يكتبه صاحبه فقط.

---

## 6. جرّب محليًا

```bash
npm run dev
```

افتح المتصفح. إذا اختفى تنبيه **«إعدادات Firebase غير مكتملة»** من الشاشة
الرئيسية، فالتطبيق قرأ الإعدادات بنجاح.

الاختبار الحقيقي لجهازين على نفس الشبكة:

```bash
npm run dev -- --host
```

ثم افتح عنوان الشبكة (`http://192.168.x.x:5173`) على الجوال، وأنشئ غرفة من جهاز
وانضم بالرمز من الآخر.

---

## 7. عند النشر على Vercel

1. في مشروع Vercel: **Settings → Environment Variables** — أضف القيم الست
   نفسها لبيئتي Production و Preview.
2. **مهم:** في Firebase Console → **Authentication → Settings → Authorized
   domains** أضف نطاق Vercel (مثل `qawsi-memory.vercel.app`). بدونه سيفشل
   الدخول المجهول على الموقع المنشور بينما يعمل محليًا.
3. أعد النشر ليأخذ المتغيرات الجديدة.

---

## المحاكي المحلي (اختياري، للتطوير)

يشغّل Auth و Database محليًا بلا مشروع سحابي:

```bash
firebase emulators:start        # auth :9099, database :9000, UI :4000
```

ثم في `.env.local`:

```bash
VITE_FIREBASE_EMULATOR=true
```

---

## أخطاء شائعة

| العَرَض | السبب |
| --- | --- |
| `auth/admin-restricted-operation` | Anonymous غير مفعّل (خطوة 2) |
| `PERMISSION_DENIED` عند إنشاء غرفة | القواعد لم تُرفع (خطوة 5) |
| التطبيق يبقى في الوضع المحلي | متغير من الستة ناقص أو فارغ — لا بد من اكتمالها كلها |
| يعمل محليًا ويفشل على Vercel | نطاق Vercel غير مضاف في Authorized domains |
| `databaseURL` مرفوض | الصيغة لا تطابق منطقة القاعدة — انسخها من الكونسول |
| الجهاز الثاني لا يرى الغرفة | تأكد أن الجهازين على نفس مشروع Firebase (نفس `projectId`) |
