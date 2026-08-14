"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type BrandVisualPreviewProps = {
  brandResult: any;
};

export default function BrandVisualPreview({
  brandResult,
}: BrandVisualPreviewProps) {
    
      const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.14,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 35,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.65,
        ease: "easeOut" as const,
      },
    },
  };
  const colors =
    brandResult?.colorPalette?.match(/#[0-9A-Fa-f]{6}/g) || [
      "#06B6D4",
      "#6366F1",
      "#0F172A",
      "#F8FAFC",
    ];

  const primaryColor = colors[0] || "#06B6D4";
  const secondaryColor = colors[1] || "#6366F1";
  const darkColor = colors[2] || "#0F172A";
  const lightColor = colors[3] || "#F8FAFC";

  const brandName = brandResult?.brandName || "Your Brand";
  const tagline =
    brandResult?.tagline || "Build a brand people remember.";

  const initials = brandName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word: string) => word.charAt(0).toUpperCase())
    .join("");
const previewRef = useRef<HTMLDivElement>(null);
    const downloadPNG = async () => {
  if (!previewRef.current) return;

  const dataUrl = await toPng(previewRef.current, {
    cacheBust: true,
    pixelRatio: 2,
  });

  const link = document.createElement("a");
  link.download = `${brandName}-brand-preview.png`;
  link.href = dataUrl;
  link.click();
  };
  const downloadPDF = () => {
  const pdf = new jsPDF();

  pdf.setFontSize(22);
  pdf.text(brandName, 20, 25);

  pdf.setFontSize(14);
  pdf.text(tagline, 20, 38);

  pdf.setFontSize(18);
  pdf.text("Brand Guidelines", 20, 60);

  pdf.setFontSize(12);
  pdf.text(`Primary Color: ${primaryColor}`, 20, 80);
  pdf.text(`Secondary Color: ${secondaryColor}`, 20, 90);
  pdf.text(`Dark Color: ${darkColor}`, 20, 100);
  pdf.text(`Light Color: ${lightColor}`, 20, 110);

  pdf.setFontSize(16);
  pdf.text("Brand Style Guide", 20, 135);

  pdf.setFontSize(11);

  const styleGuide =
    brandResult?.brandStyleGuide ||
    "Professional AI generated brand guidelines.";

  const wrapped = pdf.splitTextToSize(styleGuide, 170);
  pdf.text(wrapped, 20, 145);

  pdf.save(`${brandName}-Brand-Guidelines.pdf`);
};
const downloadBrandKit = async () => {
  if (!previewRef.current) return;

  const zip = new JSZip();

  const pngDataUrl = await toPng(previewRef.current, {
    cacheBust: true,
    pixelRatio: 2,
  });

  const pngBase64 = pngDataUrl.split(",")[1];

  zip.file(`${brandName}-brand-preview.png`, pngBase64, {
    base64: true,
  });

  const pdf = new jsPDF();

  pdf.setFontSize(22);
  pdf.text(brandName, 20, 25);

  pdf.setFontSize(14);
  pdf.text(tagline, 20, 38);

  pdf.setFontSize(18);
  pdf.text("Brand Guidelines", 20, 60);

  pdf.setFontSize(12);
  pdf.text(`Primary Color: ${primaryColor}`, 20, 80);
  pdf.text(`Secondary Color: ${secondaryColor}`, 20, 90);
  pdf.text(`Dark Color: ${darkColor}`, 20, 100);
  pdf.text(`Light Color: ${lightColor}`, 20, 110);

  const styleGuide =
    brandResult?.brandStyleGuide ||
    "Professional AI generated brand guidelines.";

  const wrapped = pdf.splitTextToSize(styleGuide, 170);
  pdf.text(wrapped, 20, 135);

  const pdfBlob = pdf.output("blob");

  zip.file(`${brandName}-Brand-Guidelines.pdf`, pdfBlob);

  zip.file(
    `${brandName}-brand-info.txt`,
    `Brand Name: ${brandName}
Tagline: ${tagline}
Primary Color: ${primaryColor}
Secondary Color: ${secondaryColor}
Dark Color: ${darkColor}
Light Color: ${lightColor}

Brand Style Guide:
${styleGuide}`
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });

  saveAs(zipBlob, `${brandName}-Brand-Kit.zip`);
};
  return (
<>
<div className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/50 p-6">
  <p className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-cyan-300" strokeWidth="1.5"><path d="m3.5 6 6.5-3 6.5 3v8L10 17l-6.5-3zM3.5 6l6.5 3 6.5-3M10 9v8"/></svg>
    Brand Asset Downloads
  </p>

  <div className="flex flex-wrap gap-4">
    <button
      onClick={downloadPNG}
      className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-white hover:bg-cyan-600"
    >
      Download PNG
    </button>

    <button
    onClick={downloadPDF}
      className="rounded-xl bg-indigo-500 px-5 py-3 font-semibold text-white"
    >
      Download PDF
    </button>

    <button
    onClick={downloadBrandKit}
      className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white"
    >
      Download Brand Kit (.zip)
    </button>
  </div>
</div>
    <motion.section
  ref={previewRef}
  variants={containerVariants}
  initial="hidden"
  animate="visible"
  className="mt-14 space-y-8"
>
      {/* Section heading */}
      <motion.div variants={itemVariants}>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Visual identity system
        </p>

        <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Your brand brought to life
        </h2>

        <p className="mt-3 max-w-2xl text-slate-400">
          Preview how your generated identity could appear across logos,
          websites, social media and customer touchpoints.
        </p>
      </motion.div>

      {/* Main brand board */}
      <motion.div
  variants={itemVariants}
  whileHover={{ y: -6 }}
  transition={{ duration: 0.3 }}
  className="overflow-hidden rounded-[32px] border border-cyan-400/20 bg-slate-900/80 backdrop-blur-xl"
>
        <div
          className="relative overflow-hidden p-8 sm:p-12"
          style={{
            background: `linear-gradient(135deg, ${darkColor}, ${primaryColor}25, ${secondaryColor}35)`,
          }}
        >
          <div
            className="absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl"
            style={{ backgroundColor: `${primaryColor}35` }}
          />

          <div
            className="absolute -bottom-20 left-20 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: `${secondaryColor}30` }}
          />

          <div className="relative">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-[24px] text-2xl font-bold shadow-2xl"
                  style={{
                    backgroundColor: primaryColor,
                    color: lightColor,
                  }}
                >
                  {initials || "AI"}
                </div>

                <h3 className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  {brandName}
                </h3>

                <p className="mt-4 max-w-xl text-lg text-slate-200 sm:text-xl">
                  {tagline}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {colors.slice(0, 5).map((color: string) => (
                  <div key={color} className="text-center">
                    <div
                      className="h-14 w-14 rounded-2xl border border-white/20 shadow-lg"
                      style={{ backgroundColor: color }}
                    />

                    <p className="mt-2 text-xs text-slate-300">{color}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Brand kit details */}
        <div className="grid gap-6 border-t border-white/10 p-7 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Brand personality
            </p>
            <p className="mt-3 leading-7 text-slate-200">
              {brandResult?.brandVoice ||
                "Confident, clear and modern communication."}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Typography direction
            </p>
            <p className="mt-3 leading-7 text-slate-200">
              {brandResult?.typography ||
                "Modern display headings with highly readable body typography."}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Visual direction
            </p>
            <p className="mt-3 leading-7 text-slate-200">
              {brandResult?.logoConcept ||
                "A distinctive, scalable identity designed for digital use."}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Logo previews */}
      <motion.div
  variants={itemVariants}
  className="grid gap-6 lg:grid-cols-2"
>
        <motion.div
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="rounded-[30px] border border-white/10 bg-white p-8"
>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Light logo preview
          </p>

          <div className="flex min-h-64 flex-col items-center justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-[24px] text-2xl font-bold"
              style={{
                backgroundColor: primaryColor,
                color: lightColor,
              }}
            >
              {initials || "AI"}
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
              {brandName}
            </p>

            <p className="mt-2 text-sm text-slate-500">{tagline}</p>
          </div>
        </motion.div>

        <motion.div
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="rounded-[30px] border border-white/10 p-8"
  style={{ backgroundColor: darkColor }}
>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Dark logo preview
          </p>

          <div className="flex min-h-64 flex-col items-center justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full border text-2xl font-bold"
              style={{
                borderColor: primaryColor,
                color: primaryColor,
              }}
            >
              {initials || "AI"}
            </div>

            <p className="mt-5 text-3xl font-bold tracking-tight text-white">
              {brandName}
            </p>

            <p className="mt-2 text-sm text-slate-400">{tagline}</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Website and social previews */}
      <motion.div
  variants={itemVariants}
  className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]"
>
        {/* Website hero */}
        <motion.div
  whileHover={{ y: -8, scale: 1.005 }}
  transition={{ duration: 0.3 }}
  className="overflow-hidden rounded-[30px] border border-white/10 bg-white"
>
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <p className="font-bold text-slate-950">{brandName}</p>

            <div className="hidden gap-6 text-sm text-slate-500 sm:flex">
              <span>About</span>
              <span>Services</span>
              <span>Work</span>
              <span>Contact</span>
            </div>

            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: primaryColor,
                color: lightColor,
              }}
            >
              Get started
            </button>
          </div>

          <div className="grid min-h-[430px] items-center gap-10 p-8 sm:p-12 lg:grid-cols-2">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-[0.25em]"
                style={{ color: primaryColor }}
              >
                Designed for impact
              </p>

              <h3 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                {tagline}
              </h3>

              <p className="mt-5 leading-7 text-slate-600">
                {brandResult?.story ||
                  "A premium digital brand experience built to communicate trust, clarity and distinction."}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full px-6 py-3 font-semibold"
                  style={{
                    backgroundColor: primaryColor,
                    color: lightColor,
                  }}
                >
                  Explore the brand
                </button>

                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-800"
                >
                  Learn more
                </button>
              </div>
            </div>

            <div
              className="relative min-h-72 overflow-hidden rounded-[28px]"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              <div className="absolute inset-6 rounded-[24px] border border-white/20 bg-white/10 backdrop-blur-xl" />

              <div className="absolute bottom-10 left-10 right-10">
                <p className="text-sm text-white/70">Brand experience</p>
                <p className="mt-2 text-4xl font-bold text-white">
                  Built to stand out.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Social media post */}
        <motion.div
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="rounded-[30px] border border-white/10 bg-slate-900/80 p-5"
>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full font-bold"
              style={{
                backgroundColor: primaryColor,
                color: lightColor,
              }}
            >
              {initials || "AI"}
            </div>

            <div>
              <p className="font-semibold text-white">{brandName}</p>
              <p className="text-xs text-slate-500">Sponsored brand preview</p>
            </div>
          </div>

          <div
            className="mt-5 flex aspect-square flex-col justify-between overflow-hidden rounded-[26px] p-7"
            style={{
              background: `linear-gradient(145deg, ${darkColor}, ${primaryColor}, ${secondaryColor})`,
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">
              New identity
            </p>

            <div>
              <p className="text-4xl font-bold leading-tight text-white">
                {tagline}
              </p>

              <div className="mt-6 h-1 w-20 rounded-full bg-white" />
            </div>

            <p className="text-sm text-white/70">
              Strategy. Identity. Experience.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.4"><path d="M8 13.5 2.7 8.4A3.5 3.5 0 0 1 7.6 3.5L8 4l.4-.5a3.5 3.5 0 0 1 4.9 4.9z"/></svg>2,408 likes</span>
            <span>Save · Share</span>
          </div>
        </motion.div>
      </motion.div>
      {/* Business card preview */}
<motion.div
  variants={itemVariants}
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="mt-10 rounded-[30px] border border-white/10 bg-slate-900/80 p-6"
>
  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
    Business Card Preview
  </p>

  <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <div
      className="flex min-h-64 flex-col justify-between rounded-[26px] p-8"
      style={{
        background: `linear-gradient(135deg, ${darkColor}, ${primaryColor})`,
      }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
        style={{
          backgroundColor: lightColor,
          color: darkColor,
        }}
      >
        {initials || "AI"}
      </div>

      <div>
        <p className="text-3xl font-bold text-white">{brandName}</p>
        <p className="mt-2 text-sm text-white/70">{tagline}</p>
      </div>
    </div>

    <div
      className="flex min-h-64 flex-col justify-between rounded-[26px] border border-slate-200 p-8"
      style={{ backgroundColor: lightColor }}
    >
      <div>
        <p className="text-2xl font-bold" style={{ color: darkColor }}>
          {brandName}
        </p>
        <p className="mt-2 text-sm" style={{ color: primaryColor }}>
          {tagline}
        </p>
      </div>

      <div className="space-y-2 text-sm" style={{ color: darkColor }}>
        <p>hello@yourbrand.com</p>
        <p>www.yourbrand.com</p>
        <p>+91 00000 00000</p>
      </div>
    </div>
  </div>
</motion.div>
{/* Letterhead preview */}
<motion.div
  variants={itemVariants}
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="mt-10 rounded-[30px] border border-white/10 bg-slate-900/80 p-6"
>
  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
    Letterhead Preview
  </p>

  <div
    className="mt-6 min-h-[520px] overflow-hidden rounded-[28px] border border-slate-200 p-10 shadow-2xl"
    style={{ backgroundColor: lightColor }}
  >
    <div className="flex items-start justify-between border-b border-slate-300 pb-6">
      <div>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold"
          style={{
            backgroundColor: darkColor,
            color: lightColor,
          }}
        >
          {initials || "AI"}
        </div>

        <p
          className="mt-4 text-2xl font-bold"
          style={{ color: darkColor }}
        >
          {brandName}
        </p>

        <p
          className="mt-1 text-sm"
          style={{ color: primaryColor }}
        >
          {tagline}
        </p>
      </div>

      <div
        className="text-right text-sm leading-6"
        style={{ color: darkColor }}
      >
        <p>hello@yourbrand.com</p>
        <p>www.yourbrand.com</p>
        <p>+91 00000 00000</p>
      </div>
    </div>

    <div className="py-10">
      <p
        className="text-sm font-semibold uppercase tracking-[0.2em]"
        style={{ color: primaryColor }}
      >
        Official Letter
      </p>

      <h3
        className="mt-4 text-3xl font-bold"
        style={{ color: darkColor }}
      >
        Building a consistent brand experience
      </h3>

      <p
        className="mt-6 max-w-3xl text-base leading-8"
        style={{ color: darkColor }}
      >
        This letterhead preview demonstrates how {brandName} can present
        professional communication across proposals, contracts, client letters,
        reports, and official documents while maintaining a consistent visual
        identity.
      </p>

      <p
        className="mt-6 max-w-3xl text-base leading-8"
        style={{ color: darkColor }}
      >
        The generated typography, color palette, spacing, and visual direction
        are applied automatically to create a polished and recognizable
        business document.
      </p>
    </div>

    <div className="mt-16 flex items-end justify-between border-t border-slate-300 pt-6">
      <div>
        <p
          className="font-semibold"
          style={{ color: darkColor }}
        >
          Authorized Signature
        </p>

        <p
          className="mt-1 text-sm"
          style={{ color: primaryColor }}
        >
          {brandName}
        </p>
      </div>

      <div
        className="h-2 w-32 rounded-full"
        style={{ backgroundColor: primaryColor }}
      />
    </div>
  </div>
</motion.div>
{/* Invoice preview */}
<motion.div
  variants={itemVariants}
  whileHover={{ y: -8, scale: 1.01 }}
  transition={{ duration: 0.3 }}
  className="mt-10 rounded-[30px] border border-white/10 bg-slate-900/80 p-6"
>
  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
    Invoice Preview
  </p>

  <div
    className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 p-10 shadow-2xl"
    style={{ backgroundColor: lightColor }}
  >
    <div className="flex flex-col justify-between gap-8 border-b border-slate-300 pb-8 sm:flex-row">
      <div>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold"
          style={{
            backgroundColor: darkColor,
            color: lightColor,
          }}
        >
          {initials || "AI"}
        </div>

        <p className="mt-4 text-2xl font-bold" style={{ color: darkColor }}>
          {brandName}
        </p>

        <p className="mt-1 text-sm" style={{ color: primaryColor }}>
          {tagline}
        </p>
      </div>

      <div className="text-left sm:text-right">
        <p
          className="text-sm font-semibold uppercase tracking-[0.2em]"
          style={{ color: primaryColor }}
        >
          Invoice
        </p>

        <p className="mt-3 text-sm" style={{ color: darkColor }}>
          Invoice No: INV-001
        </p>

        <p className="mt-1 text-sm" style={{ color: darkColor }}>
          Date: 04 August 2026
        </p>
      </div>
    </div>

    <div className="grid gap-8 py-8 sm:grid-cols-2">
      <div>
        <p className="text-sm font-semibold" style={{ color: primaryColor }}>
          Bill From
        </p>

        <p className="mt-3 font-bold" style={{ color: darkColor }}>
          {brandName}
        </p>

        <p className="mt-1 text-sm" style={{ color: darkColor }}>
          hello@yourbrand.com
        </p>

        <p className="mt-1 text-sm" style={{ color: darkColor }}>
          www.yourbrand.com
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold" style={{ color: primaryColor }}>
          Bill To
        </p>

        <p className="mt-3 font-bold" style={{ color: darkColor }}>
          Client Name
        </p>

        <p className="mt-1 text-sm" style={{ color: darkColor }}>
          client@example.com
        </p>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-300">
      <div
        className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-sm font-semibold"
        style={{
          backgroundColor: darkColor,
          color: lightColor,
        }}
      >
        <span>Description</span>
        <span>Amount</span>
      </div>

      <div
        className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-5 py-4 text-sm"
        style={{ color: darkColor }}
      >
        <span>Brand Strategy & Identity Package</span>
        <span>₹25,000</span>
      </div>

      <div
        className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-5 py-4 text-sm"
        style={{ color: darkColor }}
      >
        <span>Visual Design Services</span>
        <span>₹15,000</span>
      </div>

      <div
        className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-base font-bold"
        style={{ color: darkColor }}
      >
        <span>Total</span>
        <span>₹40,000</span>
      </div>
    </div>

    <div className="mt-8 flex flex-col justify-between gap-6 border-t border-slate-300 pt-6 sm:flex-row sm:items-end">
      <div>
        <p className="font-semibold" style={{ color: darkColor }}>
          Payment Details
        </p>

        <p className="mt-2 text-sm" style={{ color: primaryColor }}>
          Bank / UPI / Online Payment
        </p>
      </div>

      <div
        className="h-2 w-32 rounded-full"
        style={{ backgroundColor: primaryColor }}
      />
    </div>
  </div>
</motion.div>
{/* Email Signature Preview */}
<motion.div
  variants={itemVariants}
  className="rounded-[26px] border border-slate-300 bg-white p-8"
>
  <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
    Email Signature Preview
  </p>

  <div className="flex items-start gap-6">
    <div
      className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold"
      style={{
        backgroundColor: primaryColor,
        color: lightColor,
      }}
    >
      {initials}
    </div>

    <div className="flex-1">
      <h3
        className="text-2xl font-bold"
        style={{ color: darkColor }}
      >
        {brandName}
      </h3>

      <p
        className="mt-1 text-sm"
        style={{ color: primaryColor }}
      >
        {tagline}
      </p>

      <div className="mt-4 h-px w-full bg-slate-300" />

      <div
        className="mt-4 space-y-1 text-sm"
        style={{ color: darkColor }}
      >
        <p className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.4"><rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="m3 5 5 4 5-4"/></svg>hello@yourbrand.com</p>
        <p className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a10 10 0 0 1 0 12M8 2a10 10 0 0 0 0 12"/></svg>www.yourbrand.com</p>
        <p className="flex items-center gap-2"><svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.4"><path d="M5 2.5 3 3.8c-.6.4-.8 1.2-.5 1.9 1.5 3.4 4.4 6.3 7.8 7.8.7.3 1.5.1 1.9-.5l1.3-2-3-1.5-1 1.3a9.3 9.3 0 0 1-4.3-4.3l1.3-1z"/></svg>+91 90000 00000</p>
      </div>
    </div>
  </div>
</motion.div>
    </motion.section>
    </>
  );
}
