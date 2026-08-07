import { Cta } from '@/features/landing/cta';
import { Faq } from '@/features/landing/faq';
import { Features } from '@/features/landing/features';
import { Hero } from '@/features/landing/hero';
import { Pricing } from '@/features/landing/pricing';
import { Testimonials } from '@/features/landing/testimonials';

// No page-level metadata here on purpose — this is the homepage, so it should
// use the root layout's untemplated `default` title instead of getting
// "%s | Mingo AI" applied on top of a title that already says "Mingo AI".
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <Faq />
      <Cta />
    </>
  );
}
