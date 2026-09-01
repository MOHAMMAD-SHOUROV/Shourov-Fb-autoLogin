---
name: Extension version gating
description: The coordinated version-check behavior used to require extension updates.
---

The admin-controlled extension version is authoritative. A client must send its installed version to the server, the server blocks missing or mismatched versions, and generated ZIP/CRX manifests must receive the same version.

**Why:** Changing only the popup's displayed version leaves old clients usable or causes newly downloaded clients to be rejected by their own version check.

**How to apply:** Change the version from Admin Dashboard → Extension Version Control, save it, then ensure the download generator patches both manifest.json and popup/runtime version behavior before distributing the new archive.