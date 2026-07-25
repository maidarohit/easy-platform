 import Navbar from "./components/Navbar/Navbar";
 import Hero from "./components/Hero/Hero";
 import Trusted from "./components/Features/Trusted";
 import Features from "./components/Features/Features";
 import WhyChooseUs from "./components/WhyChooseUs/WhyChooseUs";
 import Workflow from "./components/Workflow/Workflow";
 import Pricing from "./components/Pricing/Pricing";
 import Testimonials from "./components/Testimonials/Testimonials";
 import FAQ from "./components/FAQ/FAQ";
 import CTA from "./components/CTA/CTA";
export default function Home() {
  return (
    <>
      <Navbar />

      <main>
      <Hero />
      <Trusted />
      <Features />
      <WhyChooseUs />
      <Workflow />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      </main>
      
    </>
  );
}