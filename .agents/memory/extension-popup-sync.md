---
name: Extension popup sync
description: Chrome extension popup and background-service-worker message delivery behavior.
---

Chrome extension popup-এ background থেকে পাঠানো runtime message popup বন্ধ থাকলে পৌঁছায় না। Admin broadcast বা per-user notification নির্ভরযোগ্যভাবে দেখাতে popup খোলার সময় background/API state fetch করতে হবে, এবং popup খোলা থাকা অবস্থায় সীমিত interval-এ refresh করা উচিত।

**Why:** Popup একটি short-lived page; background notification পাঠানোর সময় popup না থাকলে message delivery silently fail করতে পারে।

**How to apply:** Background-এ explicit config-check message handler রাখুন। Popup initialization এবং a modest refresh interval-এ current UID সহ check করুন, এবং returned broadcast/notification banner-এ দেখান।