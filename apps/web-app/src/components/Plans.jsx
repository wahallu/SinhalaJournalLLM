import { Check, Sparkles, Zap, Shield } from 'lucide-react';
import { Card } from './ui/Card';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'Rs. 0',
    period: '/month',
    description: 'For individuals exploring AI writing tools.',
    icon: Shield,
    buttonClass: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 hover:border-ink-300',
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
    price: 'Rs. 2,990',
    period: '/month',
    description: 'For professionals needing advanced capabilities.',
    icon: Zap,
    badge: 'Most used',
    buttonClass: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25',
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
    price: 'Rs. 7,490',
    period: '/month',
    description: 'For newsrooms and power users requiring max performance.',
    icon: Sparkles,
    buttonClass: 'bg-ink-900 text-white hover:bg-ink-950 shadow-sm',
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
          Choose the plan that fits how your newsroom writes, edits, and publishes in Sinhala.
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

              <div className="mb-5 flex items-baseline gap-1">
                <span className="text-[1.9rem] font-bold text-ink-900 tracking-tight tabular-nums">{plan.price}</span>
                <span className="text-[12.5px] font-medium text-ink-500">{plan.period}</span>
              </div>

              <button
                className={`w-full py-2.5 px-5 rounded-xl font-semibold text-[13.5px] cursor-pointer
                  transition-all duration-150 active:scale-[0.98] mb-6
                  ${isCurrentPlan
                    ? 'bg-ink-100 text-ink-500 cursor-not-allowed border-0 active:scale-100'
                    : plan.buttonClass}`}
                disabled={isCurrentPlan}
              >
                {isCurrentPlan ? 'Current plan' : 'Upgrade'}
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
