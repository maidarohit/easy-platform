"use client";

import AnimatedButton from "../animations/AnimatedButton";
import AnimatedCard from "../animations/AnimatedCard";
import FadeIn from "../animations/FadeIn";
import SlideUp from "../animations/SlideUp";

type RealEstateTemplateProps = {
  companyName: string;
  websiteGoal: string;
  websiteStyle: string;
  websiteRequirements?: string;
  previewMode?: "desktop" | "tablet" | "mobile";
  brandResult?: {
    heroHeadline?: string;
    websiteOverview?: string;
    websiteGoal?: string;
    websiteFeatures?: string;
    designRecommendations?: string;
  };
};

export default function RealEstateTemplate({
  companyName,
  websiteGoal,
  websiteStyle,
  websiteRequirements,
  previewMode = "desktop",
  brandResult,
}: RealEstateTemplateProps) {
  const businessName = companyName || "Your Realty Brand";
  const isLuxury = websiteStyle === "Luxury";
  const accent = isLuxury ? "#c9a35c" : "#b9925a";
  const compactPreview = previewMode !== "desktop";
  const mobilePreview = previewMode === "mobile";
  const headline =
    brandResult?.heroHeadline ||
    `Exceptional residences, curated by ${businessName}`;
  const description =
    websiteRequirements?.trim() ||
    brandResult?.websiteOverview ||
    "Discover distinguished homes shaped by architecture, privacy and an uncompromising standard of living.";

  const properties = [
    { name: "The Garden Residence", detail: "Private pool Â· Landscaped court", marker: "Residence / 01", scene: "villa" },
    { name: "The Skyline Penthouse", detail: "Panoramic views Â· Private terrace", marker: "Residence / 02", scene: "interior" },
    { name: "The Courtyard Villa", detail: "Smart living Â· Quiet luxury", marker: "Residence / 03", scene: "garden" },
  ];

  const amenities = [
    ["01", "Private Pools", "Calm, secluded spaces designed for restorative living."],
    ["02", "Landscaped Gardens", "Layered green environments composed around every residence."],
    ["03", "Smart Home Living", "Intuitive comfort, security and control built into daily life."],
    ["04", "Private Viewing", "A discreet, personal presentation arranged around your schedule."],
  ];

  return (
    <div className="overflow-hidden bg-[#0b0b0a] text-[#f3efe6]">
      <nav className={compactPreview ? "flex items-center justify-between border-b border-white/10 bg-black/70 px-5 py-4 backdrop-blur-xl" : "flex items-center justify-between border-b border-white/10 bg-black/70 px-12 py-5 backdrop-blur-xl"}>
        <div className="font-serif text-xl tracking-[0.08em]">{businessName}</div>
        <div className={compactPreview ? "hidden" : "flex items-center gap-7 text-[10px] uppercase tracking-[0.2em] text-[#c9c1b3]"}>
          {['Home', 'Properties', 'Amenities', 'Gallery', 'About', 'Contact'].map((item) => <span key={item}>{item}</span>)}
        </div>
        <button className="border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:bg-[#c9a35c] hover:text-black" style={{ borderColor: accent, color: accent }}>Enquire</button>
      </nav>

      <section className={compactPreview ? "relative overflow-hidden px-7 py-16" : "relative min-h-[760px] overflow-hidden px-12 py-28"}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_26%,rgba(201,163,92,0.16),transparent_28%),linear-gradient(135deg,#0a0a09_0%,#14120f_48%,#080808_100%)]" />
        <div className={compactPreview ? "relative z-10" : "relative z-10 max-w-[58%] pt-10"}>
          <SlideUp><p className="text-[10px] font-semibold uppercase tracking-[0.34em]" style={{ color: accent }}>Private residential collection</p></SlideUp>
          <FadeIn delay={0.15}><h1 className={mobilePreview ? "mt-6 font-serif text-4xl leading-[1.05] tracking-[-0.035em]" : "mt-7 max-w-3xl font-serif text-5xl leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl"}>{headline}</h1></FadeIn>
          <FadeIn delay={0.3}><p className="mt-7 max-w-xl whitespace-pre-wrap break-words text-base leading-8 text-[#b9b0a2]">{description}</p></FadeIn>
          <div className="mt-10 flex flex-wrap gap-4">
            <AnimatedButton><span className="inline-flex px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-black" style={{ backgroundColor: accent }}>Explore Properties</span></AnimatedButton>
            <AnimatedButton className="border border-white/25 bg-black/25 px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-white">Book Private Viewing</AnimatedButton>
          </div>
          <div className="mt-14 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7">
            {[['Exclusive', 'Properties'], ['Private', 'Viewing'], ['Elevated', 'Living']].map(([value, label]) => <div key={label}><p className="font-serif text-2xl" style={{ color: accent }}>{value}</p><p className="mt-2 text-[9px] uppercase tracking-[0.18em] text-[#8d8579]">{label}</p></div>)}
          </div>
        </div>

        <div className={compactPreview ? "relative z-10 mt-12 h-[420px] overflow-hidden border border-white/10 bg-[#191714] shadow-[0_35px_90px_rgba(0,0,0,0.55)]" : "absolute right-[6%] top-[9%] h-[68%] w-[46%] overflow-hidden border border-white/10 bg-[#191714] shadow-[0_50px_120px_rgba(0,0,0,0.55)]"}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_16%,rgba(226,190,125,0.22),transparent_25%),linear-gradient(165deg,#30291f_0%,#171512_45%,#090909_100%)]" />
          <span className="absolute left-5 top-5 z-10 rounded-full border border-[#c9a35c]/30 bg-black/35 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#d8bd82] backdrop-blur">Architecture showcase</span>
          <div className="absolute bottom-[18%] left-[8%] right-[8%] h-[48%] border border-[#c9a35c]/35 bg-[#211e19] shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
            <div className="absolute -top-[32%] right-[5%] h-[34%] w-[58%] border border-[#c9a35c]/25 bg-[#181613]" />
            <div className="grid h-full grid-cols-4 gap-px bg-[#c9a35c]/20 p-px">{[0,1,2,3].map(item => <div key={item} className="relative bg-gradient-to-b from-[#8e7650]/38 via-[#3d3325]/35 to-[#11100e]"><span className="absolute inset-x-3 top-5 h-px bg-[#efd7a6]/25"/><span className="absolute bottom-4 left-1/2 h-[58%] w-px bg-[#efd7a6]/20"/></div>)}</div>
          </div>
          <div className="absolute bottom-[8%] left-[5%] right-[5%] h-[8%] border border-cyan-100/15 bg-gradient-to-r from-[#233338] via-[#527078] to-[#1a292e] shadow-[0_0_25px_rgba(120,180,190,0.14)]" />
          <div className="absolute bottom-[5%] left-[8%] flex gap-2">{[8,12,9,14,10].map((size,index) => <span key={index} className="rounded-full bg-[#586048]" style={{ width: size, height: size }}/>)}</div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#11100e] px-7 py-20 lg:px-12">
        <div className={compactPreview ? "flex flex-col gap-5" : "flex items-end justify-between gap-5"}><div><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>Featured residences</p><h2 className="mt-4 font-serif text-4xl sm:text-5xl">A collection beyond comparison</h2></div><p className="max-w-md text-sm leading-7 text-[#91897e]">Architecturally considered homes for clients who value privacy, material beauty and enduring quality.</p></div>
        <div className={compactPreview ? "mt-12 grid gap-5" : "mt-12 grid grid-cols-3 gap-5"}>
          {properties.map((property) => <AnimatedCard key={property.name} className="group overflow-hidden border border-white/10 bg-[#171512] transition hover:border-[#c9a35c]/55"><div className="relative h-56 overflow-hidden bg-gradient-to-br from-[#302b24] via-[#161411] to-[#080808]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(223,185,117,0.18),transparent_25%)]"/><span className="absolute left-5 top-5 z-20 rounded-full border border-[#c9a35c]/25 bg-black/45 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#c9a35c] backdrop-blur">{property.marker}</span>{property.scene === "interior" ? <><div className="absolute inset-x-[12%] bottom-[15%] top-[18%] border border-[#c9a35c]/30 bg-gradient-to-b from-[#6f5b3e]/35 to-[#17130f]"><div className="absolute left-[8%] top-[12%] h-[56%] w-[42%] border border-[#e5c98d]/20 bg-[#2a241c]"/><div className="absolute bottom-[10%] right-[8%] h-[30%] w-[38%] rounded-t-full bg-[#b8a27a]/25"/></div><div className="absolute bottom-0 h-[18%] w-full bg-gradient-to-r from-[#493b2a] to-[#1c1813]"/></> : <><div className="absolute bottom-[18%] right-[8%] h-[52%] w-[80%] border border-[#c9a35c]/30 bg-[#211e19] transition duration-500 group-hover:scale-[1.025]"><div className="grid h-full grid-cols-3 gap-px bg-[#c9a35c]/20 p-px">{[0,1,2].map(item => <div key={item} className="bg-gradient-to-b from-[#806a48]/28 to-[#11100e]"/>)}</div></div><div className="absolute bottom-[6%] left-[6%] right-[6%] h-[9%] border border-cyan-100/10 bg-gradient-to-r from-[#26383c] via-[#527078] to-[#1b292c]"/>{property.scene === "garden" && <div className="absolute bottom-[3%] left-[10%] flex gap-2">{[14,10,18,12,15,9].map((size,index) => <span key={index} className="rounded-full bg-[#515944]" style={{ width: size, height: size }}/>)}</div>}</>}</div><div className="p-6"><h3 className="font-serif text-2xl">{property.name}</h3><p className="mt-3 text-sm text-[#91897e]">{property.detail}</p><button className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Explore residence</button></div></AnimatedCard>)}
        </div>
      </section>

      <section className="px-7 py-24 lg:px-12">
        <div className={compactPreview ? "grid gap-12" : "grid grid-cols-[0.8fr_1.2fr] gap-12"}><div><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>Amenities & lifestyle</p><h2 className="mt-5 max-w-lg font-serif text-4xl leading-tight sm:text-5xl">Every detail considered. Every moment elevated.</h2><p className="mt-6 max-w-md whitespace-pre-wrap break-words leading-8 text-[#91897e]">{brandResult?.websiteFeatures || 'A complete residential experience balancing private retreat, thoughtful service and effortless modern living.'}</p></div><div className={compactPreview ? "grid gap-px border border-white/10 bg-white/10" : "grid grid-cols-2 gap-px border border-white/10 bg-white/10"}>{amenities.map(([number,title,text]) => <div key={number} className="bg-[#11100e] p-7"><span className="font-serif text-xl" style={{ color: accent }}>{number}</span><h3 className="mt-7 font-serif text-2xl">{title}</h3><p className="mt-4 text-sm leading-7 text-[#91897e]">{text}</p></div>)}</div></div>
      </section>

      <section className="border-y border-white/10 bg-[#f0eadf] px-7 py-20 text-[#17130e] lg:px-12">
        <div className={compactPreview ? "grid items-center gap-12" : "grid grid-cols-2 items-center gap-12"}><div className="relative min-h-96 overflow-hidden bg-gradient-to-br from-[#504532] via-[#29241c] to-[#13110e]"><span className="absolute left-5 top-5 z-10 rounded-full border border-[#e2c995]/35 bg-black/30 px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#f0ddba] backdrop-blur">Premium interior</span><div className="absolute left-[8%] top-[14%] h-[58%] w-[45%] border border-[#e1c58d]/35 bg-gradient-to-b from-[#8b7653]/35 to-[#211c16]"><div className="absolute inset-[12%] border border-[#efd9ac]/15"/></div><div className="absolute bottom-[13%] right-[7%] h-[34%] w-[48%] rounded-t-[48px] bg-[#d5c4a5]/28 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"/><div className="absolute bottom-[8%] left-[5%] right-[5%] h-px bg-[#d3b77e]/45"/><div className="absolute bottom-[6%] right-[12%] h-16 w-16 rounded-full bg-[#555c43] shadow-[18px_-8px_0_#3d4632,-12px_-4px_0_#697054]"/></div><div><p className="text-[10px] uppercase tracking-[0.3em] text-[#8d6d35]">Why choose {businessName}</p><h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">Trusted guidance for an exceptional address.</h2><p className="mt-6 whitespace-pre-wrap break-words leading-8 text-[#625a4f]">{brandResult?.designRecommendations || 'From discovery to private viewing, every interaction is considered, informed and entirely personal.'}</p><div className="mt-8 grid grid-cols-2 gap-5">{['Curated portfolio','Discreet advisory','Architectural quality','Enduring value'].map(item => <div key={item} className="border-t border-[#aa9166] pt-4 text-sm font-medium">{item}</div>)}</div></div></div>
      </section>

      <section className="px-7 py-24 text-center lg:px-12"><p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>Private appointments</p><h2 className="mx-auto mt-5 max-w-4xl font-serif text-5xl leading-tight">Experience the next chapter of {businessName}.</h2><p className="mx-auto mt-6 max-w-2xl leading-8 text-[#91897e]">Arrange a confidential conversation and discover a residence selected around your ambitions.</p><button className="mt-9 px-8 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black" style={{ backgroundColor: accent }}>{websiteGoal === 'Book Appointments' ? 'Book Appointment' : 'Book Private Viewing'}</button></section>

      <footer className="flex flex-col gap-6 border-t border-white/10 bg-black px-7 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-12"><div><p className="font-serif text-xl">{businessName}</p><p className="mt-2 text-xs text-[#756e64]">Luxury property advisory and private residences</p></div><div className="text-xs leading-6 text-[#756e64]"><p>Private viewings by appointment</p><p>Contact Â· Properties Â· Gallery</p></div></footer>
    </div>
  );
}


