'use client';

import { motion } from 'framer-motion';
import { Activity, Boxes, CheckCircle2, Sparkles } from 'lucide-react';

const bars = [42, 68, 51, 84, 63, 90, 74];

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="glass-card relative overflow-hidden rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-red-400/70" />
            <span className="size-3 rounded-full bg-amber-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground sm:flex">
            <Sparkles className="size-3.5 text-primary" />
            mingo.ai/dashboard
          </div>
          <div className="size-6 rounded-full gradient-bg" />
        </div>

        <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-5">
          <div className="hidden flex-col gap-2 sm:col-span-1 sm:flex">
            {['Dashboard', 'Projects', 'Templates', 'Deployments', 'Settings'].map((item, i) => (
              <div
                key={item}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  i === 1 ? 'gradient-bg text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="col-span-1 flex flex-col gap-4 sm:col-span-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Boxes, label: 'Projects', value: '12' },
                { icon: Activity, label: 'Deployments', value: '28' },
                { icon: CheckCircle2, label: 'Uptime', value: '99.9%' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/60 bg-card/60 p-3">
                  <stat.icon className="size-4 text-primary" />
                  <p className="mt-2 text-lg font-semibold">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="flex items-end justify-between gap-2 h-24">
                {bars.map((value, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${value}%` }}
                    transition={{ duration: 1, delay: i * 0.08, ease: 'easeOut' }}
                    className="w-full rounded-full gradient-bg"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="glass-card absolute -top-6 -left-6 hidden items-center gap-2 rounded-xl px-3 py-2 sm:flex"
      >
        <CheckCircle2 className="size-4 text-emerald-400" />
        <span className="text-xs font-medium">Deployment successful</span>
      </motion.div>

      <motion.div
        animate={{ y: [0, 14, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="glass-card absolute -right-4 bottom-10 hidden items-center gap-2 rounded-xl px-3 py-2 sm:flex"
      >
        <Sparkles className="size-4 text-primary" />
        <span className="text-xs font-medium">Project created</span>
      </motion.div>
    </div>
  );
}
