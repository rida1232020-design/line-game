# Pi Payment Edge Function — Setup Guide

## المشاكل الشائعة وحلولها

### المشكلة الأولى: `payment installation failed`

الأسباب الأكثر شيوعاً:

1. **`PI_API_KEY` غير مُعيَّن في Supabase Secrets**
2. **`"payments"` scope غير مطلوب عند authenticate**
3. **دفعة معلقة من جلسة سابقة**

---

## الإعداد المطلوب

### 1. إعداد PI_API_KEY في Supabase

```bash
# من terminal في مجلد المشروع:
npx supabase secrets set PI_API_KEY=your_pi_api_key_here
```

أو من لوحة تحكم Supabase:
- افتح: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions
- أضف secret جديد: `PI_API_KEY` = مفتاح API من Pi Developer Portal

### 2. الحصول على PI_API_KEY

1. افتح: https://develop.pi/
2. سجّل دخولك بحساب Pi
3. افتح تطبيقك من قائمة "My Apps"
4. انسخ "Server API Key"

### 3. التحقق من sandbox

في ملف `.env`:
```
VITE_PI_SANDBOX=true   # للتطوير والاختبار
VITE_PI_SANDBOX=false  # للإنتاج الحقيقي
```

### 4. نشر Edge Function

```bash
npx supabase functions deploy pi-payment
```

---

## تدفق الدفع الصحيح

```
1. Pi.init({ sandbox: true/false })         ← يجب أن يتطابق مع بيئة Pi Developer
2. Pi.authenticate(["username","payments"])  ← "payments" مطلوب!
3. Pi.createPayment(data, callbacks)
4. onReadyForServerApproval → POST /pi-payment { action: "approve", paymentId }
5. onReadyForServerCompletion → POST /pi-payment { action: "complete", paymentId, txid }
```

---

## فحص الـ Logs

```bash
npx supabase functions logs pi-payment --tail
```
