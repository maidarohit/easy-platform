import type { WebsiteSiteDocument } from "@/app/lib/website-site-document";
import type { ProspectRenderMetadata } from "@/app/lib/prospect-site-composer";

type Props = { document: WebsiteSiteDocument; render: ProspectRenderMetadata | null; className?: string };
const Arrow = () => <span aria-hidden="true">↗</span>;

export default function ProspectConcept({ document, render, className }: Props) {
  const page = document.pages.find(page => page.path === "/" && page.visibility === "visible");
  const blocks = (page?.blocks ?? []).filter(block => block.visibility === "visible").sort((a, b) => a.order - b.order);
  const hero = blocks.find(block => block.type === "hero");
  const contents = blocks.filter(block => block.type === "content").filter(block => block.body.trim());
  const serviceBlock = blocks.find(block => block.type === "services");
  const services = render && serviceBlock?.type === "services"
    ? render.services.filter(service => serviceBlock.serviceIds.includes(service.id))
    : blocks.filter(block => block.type === "serviceDetail").map(block => ({ id: block.id, title: block.heading, description: block.body }));
  const contact = blocks.filter(block => block.type === "contact").filter(block => block.body.trim() && !/contact details have not been supplied/i.test(block.body));
  const process = blocks.find(block => block.type === "process" && block.steps.length);
  const faqs = blocks.filter(block => block.type === "faq").filter(block => block.items.length);
  const name = document.branding.name;
  const description = render?.description || (hero?.type === "hero" ? hero.description : "");
  const hasAbout = Boolean(contents.length || description);
  const destination = contact.length ? "#contact" : services.length ? "#services" : hasAbout ? "#about" : "#top";
  const ctaLabel = contact.length ? "Let’s talk" : services.length ? "Explore services" : "Discover more";

  return <main className={className} id="top">
    <div className="pp-notice"><span aria-hidden="true">◇</span> Private website concept · View only</div>
    <div className="pp-wrap">
      <header className="pp-nav">
        <a href="#top" className="pp-brand"><span className="pp-mark" aria-hidden="true">✳</span>{name}</a>
        <nav aria-label="Concept navigation">
          {services.length > 0 && <a href="#services">Services</a>}
          {hasAbout && <a href="#about">About</a>}
          {contact.length > 0 && <a href="#contact">Contact</a>}
        </nav>
        <a className="pp-button pp-small" href={destination}>{ctaLabel}<Arrow /></a>
      </header>

      <section className="pp-hero pp-reveal" aria-labelledby="concept-title">
        <div className="pp-hero-copy">
          <p className="pp-eyebrow"><span className="pp-dot" />{render?.industry || "A closer look"}</p>
          <h1 id="concept-title">{hero?.type === "hero" && hero.headline !== name ? hero.headline : name}<span className="pp-period">.</span></h1>
          {description && <p className="pp-lead">{hero?.type === "hero" ? hero.description || description : description}</p>}
          <div className="pp-actions">
            <a className="pp-button" href={destination}>{ctaLabel}<Arrow /></a>
            {hasAbout && destination !== "#about" && <a className="pp-text-link" href="#about">Get to know us <span aria-hidden="true">↓</span></a>}
          </div>
        </div>
        <div className="pp-art" aria-hidden="true">
          <div className="pp-art-top"><span>{name}</span><span>✳</span></div>
          <div className="pp-orbit pp-orbit-one" /><div className="pp-orbit pp-orbit-two" /><div className="pp-orbit pp-orbit-three" />
          <div className="pp-art-core">{name.trim().charAt(0).toUpperCase()}</div>
          <div className="pp-art-bottom"><span>{render?.industry || "Website concept"}</span><span>↗</span></div>
        </div>
      </section>

      {services.length > 0 && <section id="services" className="pp-section pp-reveal" aria-labelledby="services-title">
        <div className="pp-section-head"><p className="pp-eyebrow">01 / Capabilities</p><div><h2 id="services-title">Find your<br /><em>starting point.</em></h2><p>Explore what {name} offers.</p></div></div>
        <div className="pp-services">{services.map((service, index) => <article className="pp-card" key={service.id}>
          <div className="pp-card-top"><span>{String(index + 1).padStart(2, "0")}</span><Arrow /></div>
          <h3>{service.title}</h3><p>{service.description}</p>
        </article>)}</div>
      </section>}

      {hasAbout && <section id="about" className="pp-about pp-section pp-reveal" aria-labelledby="about-title">
        <div><p className="pp-eyebrow">A little perspective</p><h2 id="about-title">Get to know<br /><em>{name}.</em></h2></div>
        <div className="pp-about-copy">{contents.length ? contents.map(block => <div key={block.id}>
          <h3>{block.heading}</h3><p>{block.body}</p>
        </div>) : <p>{description}</p>}
        {services.length > 0 && <div className="pp-tags">{services.map(service => <span key={service.id}>{service.title}</span>)}</div>}</div>
      </section>}

      {process?.type === "process" && <section className="pp-process pp-section pp-reveal" aria-labelledby="process-title">
        <div className="pp-section-head"><p className="pp-eyebrow">Your next step</p><h2 id="process-title">{process.heading}</h2></div>
        <div className="pp-steps">{process.steps.map((step, index) => <article key={step.id}><span className="pp-step-number">{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
      </section>}

      {faqs.length > 0 && <section className="pp-faq pp-section pp-reveal" aria-label="Useful information">{faqs.map(block => <div key={block.id} className="pp-faq-grid"><h2>{block.heading}</h2><div>{block.items.map(item => <details key={item.id}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></div>)}</section>}

      {contact.length > 0 && <>
        <section className="pp-cta pp-reveal" aria-labelledby="cta-title"><p className="pp-eyebrow">Start a conversation</p><h2 id="cta-title">Something<br /><em>in mind?</em></h2><div className="pp-cta-bottom"><p>Bring your ideas, questions and requirements.<br />Find your next step with {name}.</p><a className="pp-button pp-light" href="#contact">Get in touch<Arrow /></a></div><span className="pp-cta-star" aria-hidden="true">✳</span></section>
        <section id="contact" className="pp-contact pp-section pp-reveal" aria-labelledby="contact-title"><div><p className="pp-eyebrow">Let’s connect</p><h2 id="contact-title">Get in touch.</h2></div><div>{contact.map(block => <address key={block.id}>{block.body}</address>)}</div></section>
      </>}
      <footer className="pp-footer"><a href="#top" className="pp-brand"><span className="pp-mark" aria-hidden="true">✳</span>{name}</a><p>Concept powered by Buzypeezy</p><a className="pp-text-link" href="#top">Back to top ↑</a></footer>
    </div>
  </main>;
}
