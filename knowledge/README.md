# MediHome reference library (optional)

Put trusted reference documents here as `.md` files. The AI Consultant searches them and shows citations (title, link, retrieval date) under its answers.
No retraining is needed: add, edit or delete a file and the next question uses it.

A file is used ONLY if its top block has all of: `title`, `url` (http/https), `retrieved_at` (date you checked it). Files without them are ignored.

```
---
title: Name of the guideline or leaflet
url: https://official-site.example/page
retrieved_at: 2026-10-15
licence: e.g. CC BY 4.0 / public domain / permission granted
---

Paste or summarise one idea per paragraph here. Short paragraphs work best.
```

Rules:
- Only add material you are ALLOWED to copy (check the publisher's licence/terms). When unsure, write your own short summary and link to the source.
- Never invent a URL or date. Re-check and update `retrieved_at` when you refresh a document.
- This folder ships EMPTY on purpose: I have not verified any medical source for you.
