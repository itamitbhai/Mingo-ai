'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GradientOrbs } from '@/components/shared/gradient-orbs';

export function Cta() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="glass-card relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
        >
          <GradientOrbs />
          <div className="relative z-10">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Start building your next project on Mingo AI
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
              Create your account, spin up your first project, and get a dashboard built for how
              real engineering teams work.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Start Building
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/sign-in">Login to your account</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
