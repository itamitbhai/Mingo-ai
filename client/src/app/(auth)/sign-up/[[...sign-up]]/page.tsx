import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Create your account',
};

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: 'w-full flex justify-center',
          card: 'glass-card shadow-2xl',
        },
      }}
    />
  );
}
