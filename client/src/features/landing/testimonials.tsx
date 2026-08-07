'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

const TESTIMONIALS = [
  {
    quote:
      'Mingo AI gave our team one place to actually track every project instead of scattered docs and spreadsheets. The dashboard alone paid for itself.',
    name: 'Sarah K.',
    role: 'Engineering Lead, Nimbus Labs',
    initials: 'SK',
  },
  {
    quote:
      'The project setup flow is so much faster than what we had before — pick a stack, describe the project, and you are organized in seconds.',
    name: 'Marcus T.',
    role: 'Founder, Solace Studio',
    initials: 'MT',
  },
  {
    quote:
      'It genuinely feels like Linear and Vercel had a baby built for project management. Clean, fast, and the dark theme is gorgeous.',
    name: 'Priya R.',
    role: 'Product Designer',
    initials: 'PR',
  },
  {
    quote:
      'We moved our whole team workspace over in a single afternoon. Authentication and permissions just worked out of the box.',
    name: 'Daniel O.',
    role: 'CTO, Fieldnote',
    initials: 'DO',
  },
  {
    quote:
      'Being able to see recent activity and usage at a glance keeps our whole team aligned without another status meeting.',
    name: 'Elena V.',
    role: 'Engineering Manager',
    initials: 'EV',
  },
  {
    quote:
      "Excited for the AI engineer roadmap, but honestly the foundation alone is already better than most project tools we've tried.",
    name: 'Jordan A.',
    role: 'Indie Developer',
    initials: 'JA',
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">Testimonials</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Loved by early builders
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Here&apos;s what teams are saying about building with Mingo AI.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
            >
              <Card className="h-full bg-card/60">
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="flex gap-0.5 text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-2">
                    <Avatar>
                      <AvatarFallback>{testimonial.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
