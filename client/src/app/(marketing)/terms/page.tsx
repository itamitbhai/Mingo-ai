import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

const SECTIONS = [
  {
    heading: 'Acceptance of terms',
    body: 'By creating an account or using Mingo AI, you agree to these Terms of Service. If you do not agree, please do not use the platform.',
  },
  {
    heading: 'Your account',
    body: 'You are responsible for maintaining the security of your account and for all activity that occurs under it. You must provide accurate information when creating an account.',
  },
  {
    heading: 'Acceptable use',
    body: 'You agree not to misuse Mingo AI, including attempting to disrupt the service, access data that does not belong to you, or use the platform for unlawful purposes.',
  },
  {
    heading: 'Plans and billing',
    body: 'Free, Pro, and Enterprise plans are described on our pricing page. Paid plans are billed on a recurring basis until cancelled from your billing settings.',
  },
  {
    heading: 'Termination',
    body: 'You may delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms.',
  },
  {
    heading: 'Changes to these terms',
    body: 'We may update these terms as the platform evolves. Continued use of Mingo AI after changes take effect constitutes acceptance of the revised terms.',
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="mt-12 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
