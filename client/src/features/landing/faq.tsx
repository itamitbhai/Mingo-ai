'use client';

import { motion } from 'framer-motion';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQS = [
  {
    question: 'What is Mingo AI?',
    answer:
      'Mingo AI is a software engineering platform for planning, organizing, and shipping production-ready applications. Phase 1 delivers the core SaaS foundation: authentication, a project management dashboard, and a MongoDB-backed workspace. Future phases add the AI software engineer, live workspace, and built-in IDE.',
  },
  {
    question: 'Is the AI software engineer available yet?',
    answer:
      'Not yet. Phase 1 is focused on a rock-solid platform foundation — accounts, projects, and dashboards. The AI agent, code generation, and live preview features are on the roadmap for upcoming phases.',
  },
  {
    question: 'Which tech stacks can I track with Mingo AI?',
    answer:
      'When you create a project you choose a frontend (React, Next.js, or Vue), backend (Express, Node, or NestJS), database, authentication provider, styling approach, and deployment target — so every project stays organized around the stack it actually uses.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes. You can start on the Free plan and upgrade to Pro or Enterprise at any time from your billing settings as your number of projects and workspaces grows.',
  },
  {
    question: 'How is my data stored?',
    answer:
      'Your projects, profile, and settings are stored in MongoDB Atlas. Authentication is handled entirely by Clerk, so your credentials never touch our servers directly.',
  },
  {
    question: 'Do you offer team or organization accounts?',
    answer:
      'Workspaces let you group projects for a team today, with full multi-seat organization support planned for the Enterprise tier as the platform matures.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Reach out from your dashboard once
            you&apos;re signed in.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="glass-card mt-12 rounded-2xl px-6"
        >
          <Accordion type="single" collapsible>
            {FAQS.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
