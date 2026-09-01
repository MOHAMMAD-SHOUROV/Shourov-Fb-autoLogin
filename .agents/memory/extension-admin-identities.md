---
name: Extension admin identities
description: How browser installations and real Facebook login IDs should be represented in admin data.
---

Admin access is scoped to one browser/extension installation, but each successful Facebook UID used by that installation must be stored separately in login activity. The installation ID is not a Facebook UID and must never be shown as one.

**Why:** Treating the installation as the logged-in account produced generic “Browser / Extension User” rows and zero or misleading login details.

**How to apply:** Keep the installation as the grouping/blocking key, append only successful-login UIDs to the activity map, and show “No ID recorded yet” rather than inventing or reconstructing missing historical IDs.