import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import RatchetOrb from "@/components/ui/RatchetOrb";
import HeroPortraits from "@/components/HeroPortraits";
import Words, { wordCount } from "@/components/ui/Words";
import { getLang } from "@/lib/i18n/server";
import { getDictFor } from "@/lib/i18n/dictionaries";
import { listDoctors } from "@/lib/queries";
import { money, has } from "@/lib/format";

export const dynamic = "force-dynamic";

// Homepage. Hero text animates with CSS only (never waits for JavaScript); lower sections use the safe
// .reveal scroll animation (see RevealObserver). Featured doctors are REAL doctors from approved hospitals
// (listDoctors uses the approval filter); the section is hidden when there are none or the database is down.
export default async function Home() {
  const lang = getLang(), t = getDictFor(lang), h = t.home;
  let doctors: any[] = [];
  try { doctors = (await listDoctors()).filter((d: any) => has(d.specialty)).slice(0, 3); } catch { doctors = []; }

  const S: [string, IconName, keyof typeof h.services, string][] = [
    ["/doctors", "doctor", "doctors", "teal"], ["/hospitals", "hospital", "hospitals", "indigo"], ["/beds", "bed", "beds", "sky"],
    ["/blood", "blood", "blood", "rose"], ["/tests", "test", "tests", "amber"], ["/ambulance", "ambulance", "ambulance", "violet"],
  ];
  const floatIc: IconName[] = ["doctor", "bed", "blood"];
  const trustIc: IconName[] = ["shield", "check", "user", "globe"];

  return <div className="home">
    {/* ---------- hero ---------- */}
    <section className="hero-x" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden><span className="orb o1" /><span className="orb o2" /><span className="orb o3" /><span className="stars" /><span className="grid-lines" /></div>
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="eyebrow light rise d1"><span className="eb-line" aria-hidden />{h.eyebrow}</p>
          <h1 id="hero-title"><Words text={h.titleBefore} /><em><Words text={h.titleEm} from={wordCount(h.titleBefore)} /></em>{h.titleAfter}</h1>
          <p className="hero-sub rise d3">{h.sub}</p>
          <div className="hero-cta rise d4">
            <Link className="btn lg glow" href="/hospitals">{h.ctaPrimary}<Icon name="arrowUp" size={18} /></Link>
            <Link className="btn lg glass" href="/doctors">{h.ctaSecondary}<Icon name="arrow" size={18} /></Link>
          </div>
          <form className="hero-search rise d5" action="/doctors" method="get" role="search" aria-label={h.searchLabel}>
            <Icon name="search" />
            <input name="q" placeholder={h.searchPlaceholder} aria-label={h.searchLabel} autoComplete="off" />
            <button className="btn">{h.searchButton}</button>
          </form>
          <div className="chips light rise d5"><span>{h.popular}</span>
            {h.specialties.map((s) => <Link key={s.q} className="chip" href={`/doctors?q=${encodeURIComponent(s.q)}`}>{s.label}</Link>)}
          </div>
        </div>
        {/* Illustrative stock photographs (Pexels licence; sources in public/images/CREDITS.md). Not MediHome doctors; no endorsement implied. */}
        <figure className="hero-photo">
          <span className="halo" aria-hidden /><span className="ring" aria-hidden />
          <HeroPortraits alt={h.photoAlt} equipmentAlt={h.equipmentAlt} />
          {h.float.map((f, i) => <div key={f.t} className={"float-card f" + (i + 1)} aria-hidden>
            <span className={"fc-ic " + ["teal", "sky", "rose"][i]}><Icon name={floatIc[i]} size={20} /></span>
            <span><b>{f.t}</b><small>{f.s}</small></span></div>)}
        </figure>
      </div>
      <div className="container"><p className="hero-reassure rise d6"><Icon name="shield" size={16} />{h.reassure}</p></div>
    </section>

    {/* ---------- services ---------- */}
    <section className="band-mint" aria-labelledby="svc-title">
      <div className="container">
        <div className="sec-head reveal">
          <div><p className="eyebrow">{h.servicesEyebrow}</p><h2 id="svc-title">{h.servicesTitle}</h2></div>
          <p className="sec-sub">{h.servicesSub}</p>
        </div>
        <div className="svc-x reveal-stagger">{S.map(([href, ic, key, tone], i) => (
          <Link key={href} href={href} className={"svc-card reveal " + tone} style={{ "--i": i } as React.CSSProperties}>
            <span className="svc-ic"><Icon name={ic} size={24} /></span>
            <h3>{h.services[key].title}</h3><p>{h.services[key].text}</p>
            <span className="svc-go"><Icon name="arrow" size={18} /></span>
          </Link>))}
        </div>
      </div>
    </section>

    {/* ---------- how it works ---------- */}
    <section className="band-lav" aria-labelledby="how-title">
      <div className="container">
        <div className="sec-head center reveal"><p className="eyebrow">{h.howEyebrow}</p><h2 id="how-title">{h.howTitle}</h2></div>
        <ol className="steps-x">{h.steps.map((s, i) => <li key={s.title} className="reveal" style={{ "--i": i } as React.CSSProperties}>
          <span className="step-n">{String(i + 1).padStart(2, "0")}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
      </div>
    </section>

    {/* ---------- trust ---------- */}
    <section className="band-cream" aria-labelledby="trust-title">
      <div className="container trust-grid">
        <div className="reveal"><p className="eyebrow">{h.trustEyebrow}</p><h2 id="trust-title">{h.trustTitle}</h2><p className="sec-sub">{h.trustText}</p>
          <div className="trust-cta"><Link className="btn" href="/register">{h.patientsCta}</Link><Link className="btn ghost" href="/register?role=hospital">{h.hospitalsCta}</Link></div></div>
        <div className="trust-cards">{h.trustCards.map((c, i) => <div key={c.t} className="t-card reveal" style={{ "--i": i } as React.CSSProperties}>
          <span className="t-ic"><Icon name={trustIc[i]} size={20} /></span><h3>{c.t}</h3><p>{c.s}</p></div>)}</div>
      </div>
    </section>

    {/* ---------- featured doctors (real data only) ---------- */}
    {doctors.length > 0 && <section className="band-sky" aria-labelledby="docs-title">
      <div className="container">
        <div className="sec-head reveal">
          <div><p className="eyebrow">{h.docsEyebrow}</p><h2 id="docs-title">{h.docsTitle}</h2></div>
          <p className="sec-sub">{h.docsSub} <Link className="link" href="/doctors">{h.docsAll} →</Link></p>
        </div>
        <div className="doc-x">{doctors.map((d, i) => (
          <article key={d.id} className="doc-card reveal" style={{ "--i": i } as React.CSSProperties}>
            <div className={"doc-photo " + ["teal", "indigo", "rose"][i % 3]} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element -- photos are stored as small data URLs */}
              {d.photoUrl ? <img src={d.photoUrl} alt="" /> : <span>{String(d.name).replace(/^dr\.?\s*/i, "").charAt(0).toUpperCase()}</span>}
            </div>
            <div className="doc-body">
              <p className="eyebrow sm">{d.specialty}</p>
              <h3>{d.name}</h3>
              <p className="muted">{[d.hospital?.name, d.hospital?.location].filter(Boolean).join(" · ")}</p>
              <div className="doc-foot">{has(d.feeBdt) ? <b>{money(lang, d.feeBdt)}</b> : <span />}
                <Link className="link" href={`/doctors?q=${encodeURIComponent(d.name)}`}>{h.docsView} →</Link></div>
            </div>
          </article>))}
        </div>
      </div>
    </section>}

    {/* ---------- Ratchet ---------- */}
    <section className="container ratchet-x reveal" aria-labelledby="rt-title">
      <div className="rt-art" aria-hidden><RatchetOrb size="md" /></div>
      <div><p className="eyebrow light">{h.ratchetEyebrow}</p><h2 id="rt-title">{h.ratchetTitle}</h2><p>{h.ratchetText}</p></div>
      <Link className="btn lg light-btn" href="/assistant">{h.ratchetCta}<Icon name="arrow" size={18} /></Link>
    </section>

    {/* ---------- urgent ---------- */}
    <section className="container urgent-x reveal" aria-labelledby="ug-title">
      <div className="urgent-glow" aria-hidden />
      <div><p className="eyebrow light"><Icon name="alert" size={16} />{h.urgentEyebrow}</p><h2 id="ug-title">{h.urgentTitle}</h2><p>{h.urgentText}</p></div>
      <div className="urgent-cta"><a className="btn lg sos" href="tel:999"><Icon name="phone" size={18} />{t.nav.call999}</a>
        <Link className="btn lg light-btn" href="/ambulance">{h.urgentCta}<Icon name="arrowUp" size={18} /></Link></div>
    </section>
  </div>;
}
