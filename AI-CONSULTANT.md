# MediHome AI Consultant: shob kichu (Bangla guide)

NOTE: Ami eta nijer computer e chalie dekhi ni. Ami ja test korechi: safety, doctor-intent, booking-token ar reference-search er 12 ta unit test (pass). Chat UI, voice, model response, database search, booking asol browser e ar tomar computer e test hoyni. Tai niche "TEST KORA / KORA HOYNI" alada kore dewa ache.

## A. Ki ki bananor chesta kora hoyeche
- Chat (Bangla + English), multi-turn, file upload (JPG/PNG/WebP/PDF), provider badge (local na cloud).
- Emergency check: code diye, model er age. Jorori hole sathe sathe 999 guidance (English + Bangla), model/database er jonno wait kore na.
- Doctor khuja: sotti MediHome database theke (specialty + hospital). Model kono doctor banay na. "near me" bolle location anumaan kore na, jiggesh kore.
- Booking: doctor + date + time -> "Review" -> tumi **Confirm** tap korle tabei booking. Server abar availability check kore, tarpor tomar **ager existing booking + payment code**-i chalay (notun booking system na). Status: "awaiting service fee payment", tarpor fee pay.
- Medical image / report / prescription / diet: system rules diye (genital shoho sensitive jaygar medical chobi refuse kora hoy na, kintu definitive diagnosis dey na, clinician dekhate bole, abosshoi unclear hole "unclear" bole).
- Reference library: `knowledge/` folder e file dile citation (title, link, retrieval date) shoho uttor. Folder **khali**: ami kono medical source verify kori ni, banai-o ni.
- Web search (optional): nijer SearXNG server thakle. Na thakle bole "current info verify kora jayni".
- Voice (browser e): mic button, "Voice chat" mode, play/pause/resume/stop/replay, voice selector, interrupt, language select, "stop"/"repeat that"/"থামো"/"আবার বলো" command.
- Privacy: chat/file/audio MediHome kothao save kore na. Upload magic-byte diye check hoy (shudhu asol JPG/PNG/WebP/PDF), 5MB limit, rate limit, prompt-injection guard (file/web text ke "data" dhore).

## B. File gulo
Notun: `lib/safety.ts` (emergency, upload check, prompt rules), `lib/intent.ts` (doctor query bujha), `lib/aitools.ts` (database theke doctor + booking prepare), `lib/aitoken.ts` (confirm token), `lib/knowledge.ts` (reference search), `lib/websearch.ts`, `app/api/ai/book/route.ts` ar `.../prepare/route.ts`, `components/Consultant.tsx` (puro UI + voice), `knowledge/README.md`, `tests/ai.test.ts`.
Bodlano: `lib/ai.ts` (Ollama + Gemini), `app/api/ai/route.ts`, `app/assistant/page.tsx`, `components/Nav.tsx` (naam), `app/globals.css`, `.env.example`, `scripts/doctor.js`.
Database schema, package.json, version: **kichu bodlay ni**. Migration lagbe na.

## C. Model / licence / hardware
| Kaj | Option | Kothay chole | Note |
|---|---|---|---|
| Chat + chobi bujha (free) | Ollama + `gemma3:4b` (ba boro `gemma3:12b`) | tomar computer e | 4b: ~3-4 GB download, 8 GB RAM hole chole, GPU na thakle dhire (10-60+ sec). 12b: 16 GB RAM lagbe. Bangla ar chobi support ache bole bole, kintu **medical Bangla quality ami test kori ni**. |
| Cloud (optional) | Gemini (tomar key) | Google server | Bhalo, kintu data Google e jay. Key free tier ba paid hote pare: Google er shorto dekho. |
| PDF | Gemini cloud | cloud | Local model PDF pore na: PDF er photo/screenshot upload koro. |
| OCR | model nijei chobi theke pore (alada Tesseract na) | model jekhane | Nirbhul na hote pare, tai app "unclear" markbar bole. |
| Voice input | Browser (Chrome/Edge) | **Chrome/Edge er vendor service, local na** | Internet lage. Bangla (bn-BD), English, Arabic, Hindi, Urdu browser e chole kina ami test kori ni. |
| Voice output | Browser speechSynthesis | tomar device er voice | Bangla voice na thakle app bole install korte (Windows Settings > Time & language > Speech). |
| Local Whisper/Piper | **Kora hoyni** | | Python server lage; tomar approval chai, pore korbo. |
| Web search | SearXNG (nijer server) | tomar Docker | `docker run -d -p 8080:8080 searxng/searxng`, tarpor settings.yml e JSON format on korte hobe. |
| Image generation | **Kora hoyni** | | Local Stable Diffusion er jonno GPU + licence check lagbe. |
LICENCE: Gemma er "Gemma Terms of Use + Prohibited Use Policy" ar Google er shorto **tumi nijer porte nao**, bishesh kore medical/commercial/public use er age. Ami ei bepare legal bolte pari na.
Computer er spec dekhte (PowerShell), result amake pathao, ami model suggest korbo:
```powershell
Get-CimInstance Win32_ComputerSystem | Select-Object @{n="RAM_GB";e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
Get-CimInstance Win32_VideoController | Select-Object Name,@{n="VRAM_GB";e={[math]::Round($_.AdapterRAM/1GB,1)}}
Get-PSDrive C | Select-Object @{n="Free_GB";e={[math]::Round($_.Free/1GB,1)}}
```

## D. Environment variable (naam, secret na)
`AI_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SEARXNG_URL` (ar age theke: `DATABASE_URL`, `NEXTAUTH_*`, `PAYMENT_*`, `OWNER_KEY` ...)

## E. PowerShell commands
Project folder e:
```powershell
npm install
node scripts/doctor.js
npm run dev
```
Free local model (optional):
```powershell
winget install Ollama.Ollama        # ba ollama.com theke installer
ollama pull gemma3:4b
ollama run gemma3:4b "hello"        # kaj kore kina dekhar jonno, tarpor /bye
```
`.env` e: `OLLAMA_MODEL="gemma3:4b"` (ar `AI_PROVIDER="ollama"` jodi shudhu local chao). `npm run dev` restart koro.

## F. Website e connect (age-i kora)
Route: `/assistant` (Nav e "AI Consultant"). Component: `components/Consultant.tsx`. API: `POST /api/ai` (chat), `POST /api/ai/book/prepare` ar `POST /api/ai/book` (booking). Kono extra config lagbe na.

## G. Flow
```
Browser (type / mic) --> /api/ai
   1 emergency? --yes--> 999 guidance (model/DB lage na)
   2 doctor request? --> Prisma (real Doctor + Hospital) --> cards (model lage na)
   3 else: knowledge/ + (optional SearXNG) --> Ollama(local) ba Gemini(cloud) --> answer + sources
Doctor card -> Review -> /api/ai/book/prepare (server check + signed token)
            -> tumi Confirm -> /api/ai/book -> existing /api/bookings (re-check) -> fee payment
```

## H. Test checklist (tumi korbe)
1. `npm run dev` cholbe, site khulbe. Expected: age-r moto.
2. Sign in -> AI Consultant. "I agree" tick koro. Type: `I have severe chest pain`. Expected: lal 999 message, model chara sathe sathe.
3. Hospital + doctor (specialty "Dermatology") publish thakle type: `find a dermatologist`. Expected: oi sotti doctor er card. Database e na thakle: "could not find a verified match".
4. `find a dermatologist near me`. Expected: area jiggesh kore.
5. Card e date/time dao -> Review -> Confirm. Expected: "Booking created ... awaiting fee payment" + Pay button. Prothom confirm token ekbar-i kaj kore.
6. Model set thakle: `explain what haemoglobin means`. Expected: Bangla/English uttor + disclaimer.
7. Ekta report er chobi upload. Expected: value/unit/range, "unclear" mark, clinician review note.
8. Mic: Chrome e "Speak" -> permission Allow -> kotha bolo. Expected: "Listening", text chat e ashe, uttor ashe, "Play" e porhe.
9. "Voice chat" on kore bolo, tarpor "stop" bolo. Expected: pora thame.
10. `npm test`. Expected: shob test pass (ager + `ai.test.ts`).

## I. Shomosha
- "AI model is not configured" -> `.env` e `OLLAMA_MODEL` ba `GEMINI_API_KEY` dao, restart.
- "local AI model is not running" -> Ollama chalu ache? `ollama list`.
- "model is not downloaded" -> `ollama pull <model>`.
- AI HTTP 403/404 (Gemini) -> key/model thik kina, `GEMINI_MODEL="gemini-2.5-flash"` dao.
- Mic kaj kore na -> Chrome/Edge, `localhost` e, lock icon theke Microphone Allow, internet ache kina.
- Bangla voice nai -> Windows Settings > Time & language > Speech theke voice add koro.
- Doctor pay na -> hospital active (subscription) kina, doctor published kina.

## J. Public website er jonno
HTTPS lagbe (microphone ar login er jonno), privacy policy, bangladesher laiyer poramorsho (medical data), clinical validation chara "diagnosis tool" bola jabe na, local model hosting e GPU server khoroch, rate limit Redis e, audit/backup, model licence check, SearXNG/Whisper nijer server e.

## K. Free kothay, khoroch kothay
- Patient der kono AI fee nai (code e nai).
- **Tobu khoroch ache:** tomar computer/bijli/internet; local model e hardware; public hosting (GPU hole beshi); cloud (Gemini) use korle Google er shorto/limit; Chrome voice input vendor service; domain/HTTPS.
- **Adhura/kora hoyni:** image generation, local Whisper/Piper, local PDF reading, streaming reply, saved chat history (intentionally nai), verified medical library (folder khali), clinical validation.

## L. WHAT I MUST DO NEXT (copy-paste)
1. Notun zip ta notun folder e extract koro. Purono `.env` copy kore notun folder e `.env` naame rakho.
2. PowerShell e oi folder e: `npm install`
3. `.env` e `OWNER_KEY`, `MEDIHOME_PAYMENT_DESTINATION`, `GEMINI_API_KEY` (ba `OLLAMA_MODEL`) ache kina dekho. Tarpor: `node scripts/doctor.js` -> "All required settings look fine" dekhte hobe.
4. `npm run dev` -> http://localhost:3000/assistant
5. Upor-er H checklist 1 theke 10 koro.
6. Computer er spec (C section er 3 ta command) amake pathao, jate ami bhalo local model ber kore dei.
7. Kono step fail korle pathao: ke step, PowerShell er exact error text, ar browser er Console (F12) er lal lekha. **Key/password pathaio na.**
