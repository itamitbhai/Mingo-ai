import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

const SECTIONS = [
  {
    heading: 'Information we collect',
    body: 'When you create a Mingo AI account we collect the information you provide during sign-up through our authentication provider (such as your name and email address), along with the project, workspace, and settings data you create while using the product.',
  },
  {
    heading: 'How we use your information',
    body: 'We use your information to operate and improve Mingo AI: authenticating you, displaying your projects and activity, and communicating important account and product updates.',
  },
  {
    heading: 'Data storage',
    body: 'Application data is stored in MongoDB Atlas. Authentication credentials are managed entirely by our authentication provider, Clerk, and are never stored on our own servers.',
  },
  {
    heading: 'Cookies',
    body: 'We use essential cookies required for authentication and session management. We do not use third-party advertising cookies.',
  },
  {
    heading: 'Your rights',
    body: 'You can update your profile information at any time from your account settings, and you can permanently delete your account and all associated data from the Settings page.',
  },
  {
    heading: 'Contact',
    body: 'Questions about this policy can be directed to your workspace administrator or raised from within your Mingo AI dashboard.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-primary">Legal</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
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
