import { Check, Sparkles, Zap, Shield } from 'lucide-react';
import { Card } from './ui/Card';

/**
 * Roadmap page.
 *
 * Prices and working upgrade buttons were removed: there is no billing
 * integration behind them, so quoting a monthly figure and offering an
 * "Upgrade" action that does nothing misrepresented the product. The tier
 * structure is kept because it still communicates where this is going.
 */
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individuals exploring AI writing tools.',
    icon: Shield,
    features: [
      'Basic grammar checking',
      'Standard tone rewriting',
      'Up to 10 headlines/day',
      'Short summaries',
      'Community support',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'For professionals needing advanced capabilities.',
    icon: Zap,
    badge: 'Planned',
    features: [
      'Everything in Free',
      'Advanced grammar & style',
      'Unlimited headlines',
      'Long-form summaries',
      'Priority email support',
      'Early access to new features',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For newsrooms and power users requiring max performance.',
    icon: Sparkles,
    features: [
      'Everything in Plus',
      'Custom style tones',
      'API access',
      'Team collaboration',
      'Dedicated account manager',
      '24/7 phone support',
    ],
  },
];

export default function Plans({ currentPlan = 'free' }) {
  return (
    <div className="w-full flex flex-col items-center pt-2 pb-10">
      <div className="text-center mb-9 max-w-xl">
        <h1 className="text-[1.6rem] font-bold text-ink-900 tracking-tight mb-2 text-balance">
          Upgrade your workflow
        </h1>
        <p className="text-[13.5px] text-ink-500 leading-relaxed">
          Where SinAi is heading for newsrooms writing, editing, and publishing in Sinhala.
        </p>
        <p className="text-[12.5px] text-ink-400 mt-3">
          Paid plans are not available yet — every tool is currently free to use.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl items-stretch">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const isFeatured = plan.id === 'plus';

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col p-6 transition-all duration-200
                ${isFeatured
                  ? 'border-brand-300 shadow-card-hover'
                  : 'hover:border-ink-300 hover:shadow-card-hover'}`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4
                  ${isFeatured ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'bg-ink-100 text-ink-600'}`}>
                  <Icon size={18} strokeWidth={2.25} />
                </div>
                <h2 className="text-[16px] font-bold text-ink-900 mb-1">{plan.name}</h2>
                <p className="text-[12.5px] text-ink-500 leading-relaxed min-h-10">{plan.description}</p>
              </div>

              <button
                className={`w-full py-2.5 px-5 rounded-xl font-semibold text-[13.5px] mb-6 cursor-not-allowed
                  ${isCurrentPlan
                    ? 'bg-ink-100 text-ink-500'
                    : 'bg-ink-50 text-ink-400 border border-ink-200'}`}
                disabled
              >
                {isCurrentPlan ? 'Current plan' : 'Coming soon'}
              </button>

              <div className="flex-1">
                <p className="text-[10.5px] font-bold text-ink-500 mb-3.5 uppercase tracking-[0.14em]">Includes</p>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0
                        ${isFeatured ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-600'}`}>
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="text-[13px] text-ink-700 font-medium leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
