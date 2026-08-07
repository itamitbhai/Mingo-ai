import { Logo } from '@/components/shared/logo';
import { GradientOrbs } from '@/components/shared/gradient-orbs';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <GradientOrbs />
      <div className="relative z-10 mb-8">
        <Logo />
      </div>
      <div className="relative z-10 flex w-full justify-center">{children}</div>
      <p className="relative z-10 mt-8 max-w-sm text-center text-xs text-muted-foreground">
        By continuing, you agree to Mingo AI&apos;s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
