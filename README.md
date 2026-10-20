# MediHome - A to Z (Windows localhost)

Eta puro project: purono feature + notun update, shob ek jaygay. Tomar ager `package.json`, `package-lock.json` ar version gulo hubohu ager moto rakha hoyeche (kono version bodlay ni, notun package add hoy ni).

IMPORTANT: ami eta nijer computer e install/run kore dekhi ni, shudhu code syntax check korechi. Google, Facebook ar bKash asol credential diye ami test kori ni. Error ashle exact error text pathao.

AI Consultant (chat, voice, doctor matching, report/image) er jonno: **AI-CONSULTANT.md** pore nao.

## TOMAR KAJ (checklist)
1. Node.js 20 ba 22 LTS install thakbe (`node --version` diye dekho).
2. Ei zip ta **notun folder e** extract koro (purono project folder ta alada rekhe dao).
3. Tomar **purono `.env` file ta** copy kore notun folder e `.env` naame rakho. Purono `.env` na thakle: `Copy-Item .env.example .env`
4. `.env` file e ei lines ache kina dekho, na thakle add koro:
   - `DATABASE_URL` = `postgresql://...` diye shuru (tomar ager database URL-i bosao)
   - `NEXTAUTH_URL="http://localhost:3000"`
   - `NEXTAUTH_SECRET` = lomba random text
   - `MEDIHOME_PAYMENT_DESTINATION="+8801XXXXXXXXX"` (tomar bKash number, shudhu ekhanei thakbe)
   - `OWNER_KEY` = 16+ akkhorer secret (payment approve korar jonno)
   - `GEMINI_API_KEY` = tomar AI key
   - `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` = nijer Google/Facebook app theke (na dile button thake, click korle bole dey ki lagbe)
5. PowerShell e notun folder e giye:
```powershell
npm install
node scripts/doctor.js
npx prisma validate
npx prisma db push
npm run dev
```
Tarpor http://localhost:3000 kholo.

`npx prisma db push` keno: notun folder e purono migration history nai, tai `migrate dev` na chaliye `db push` chalao. Eta notun table/column add kore. Jodi bole "data loss" ba "reset", **yes dio na**, stop kore amake message pathao.

## Kibhabe test korbe
1. **Hospital:** Register -> Hospital/Clinic. Billing tab e "Pay" -> bKash Send Money page ashe (tomar number, Copy button shoho). TrxID (je kono 8-14 akkhor, test er jonno, jemon `TEST12345678`) dao -> Submit.
2. **Payment approve:** http://localhost:3000/owner/payments -> `OWNER_KEY` dao -> Approve. Hospital active hoy.
3. Hospital Portal e doctor, bed, blood, test add koro. **Ambulance** tab e hospital er ambulance add koro.
4. **Patient:** arek browser e register -> doctor/bed/test/blood/ambulance book -> fee pay (same Send Money flow) -> owner page theke approve -> booking confirm.
5. **Ambulance provider:** Register -> "Ambulance provider". Gari add koro, request Accept koro. Patient fee pay korle confirmed.
6. **AI:** Assistant page (sign in lagbe). Report upload kora jay.

## Forgot password (notun)
Login page e "Forgot password?" link. Email din -> reset link (30 minute, ekbar-i kaj kore) -> notun password.
- Localhost e email service na thakle link ta `npm run dev` er PowerShell window te print hoy ("[DEV MAIL ...]"): oi link browser e kholo.
- Asol email pathate: resend.com e free account, `.env` e `RESEND_API_KEY` ar `MAIL_FROM` dao (key chat e pathaio na).
- Google/Facebook diye khola account e password nai, tai reset kaj kore na (generic message dey, keu jante pare na kon email ache).
- Password bodlale purono login session (7 din porjonto) sathe sathe bondho hoy na (JWT), eta ei version er shimabodhota.

## Notun ki ki add hoyeche
- Hospital nijer ambulance service dite pare (Hospital Portal -> Ambulance). Patient hospital er page theke ba Ambulance page theke book kore. Alada Ambulance provider account-o ache.
- Ambulance e confirmation fee BDT 10 (patient dey, provider accept korar pore, ekbar-i, fare theke alada). Patient er number provider accept na korle hidden.
- bKash: official API credential thakle seta, na thakle shob fee tomar number e **Send Money**. Page ta bKash-pink style, kintu likha ache eta MediHome guide, official bKash app na. Tumi TrxID check kore Approve koro (automatic na).
- Login/Register page e Google ar Facebook button shob shomoy dekha jay.
- AI: `AIza...` ar `AQ....` dui rokom key-i support kore. Error hole HTTP status dekhay (key kokhono na).
- Environment checker: `node scripts/doctor.js` (kono secret print kore na).

## Google login setup
console.cloud.google.com -> project -> OAuth consent screen (External, Test users e tomar Gmail) -> Credentials -> OAuth client ID (Web).
- JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/callback/google`

## Facebook login setup
developers.facebook.com -> Create App -> Facebook Login (Web). Valid OAuth Redirect URI: `http://localhost:3000/api/auth/callback/facebook`. Development mode e shudhu app er admin/tester login korte pare.
Ek email e age email/password account thakle Google/Facebook diye same email e ashle "OAuthAccountNotLinked" ashbe (security er jonno). Age jei method e khulechile seta use koro.

## Phone e test (same hotspot)
`ipconfig` e IPv4 dekho (jemon 192.168.43.10). `.env` e `NEXTAUTH_URL="http://192.168.43.10:3000"`, tarpor `npm run dev -- -H 0.0.0.0`, phone e `http://192.168.43.10:3000`. Email login ar Send Money chole. Google/Facebook private IP te kaj kore na: tar jonno `ngrok http 3000` er https link `NEXTAUTH_URL` e dao ar Google/Facebook e oi link er callback add koro.

## Shomosha hole
- `node scripts/doctor.js` age chalao: ki missing bole dey.
- "URL must start with postgresql://" -> `DATABASE_URL` thik koro (`file:` hole SQLite, eta lagbe PostgreSQL).
- "Environment variable not found: DATABASE_URL" -> `.env` ta oi folder e nai.
- "did not initialize" ba "@prisma/client" error -> `npx prisma generate`.
- Install error -> `node_modules` folder delete kore abar `npm install`.
- Onno commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run studio`.

## Ja nai
Phone/OTP login, bKash refund API (refund manual), email/SMS reminder, UI er puro translation, AI chat history save, ESLint, hospital licence verification (payment verify hole-i active).
