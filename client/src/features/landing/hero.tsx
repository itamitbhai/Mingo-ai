'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, PlayCircle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GradientOrbs } from '@/components/shared/gradient-orbs';
import { ProductPreview } from './product-preview';

export function Hero() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section className="relative overflow-hidden pt-40 pb-24 sm:pt-48 sm:pb-32">
      <GradientOrbs />

      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass mx-auto mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Introducing Mingo AI — Phase 1 is live
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl"
        >
          Build Production-Ready Apps <span className="gradient-text">with AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Mingo AI is the software engineering platform where teams plan projects, manage
          workspaces, and ship production-ready applications — with an AI software engineer
          built directly into your workflow, coming online in the next phase.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Start Building
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="glass" onClick={() => setDemoOpen(true)}>
            <PlayCircle className="size-4" />
            Watch Demo
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          <ProductPreview className="relative" />
        </motion.div>
      </div>

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Live product preview</DialogTitle>
            <DialogDescription>
              A look at the Mingo AI dashboard. Interactive AI-guided demos land in a future
              phase — Phase 1 focuses on the core platform you can already sign up and build on.
            </DialogDescription>
          </DialogHeader>
          <ProductPreview className="relative" />
        </DialogContent>
      </Dialog>
    </section>
  );
}
