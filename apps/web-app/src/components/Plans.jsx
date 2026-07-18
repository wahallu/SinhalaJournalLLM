import React from 'react';
import { Check, Sparkles, Zap, Shield } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'Rs. 0',
    period: '/month',
    description: 'For individuals exploring AI writing tools.',
    icon: Shield,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    buttonClass: 'bg-white text-gray-800 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300',
    features: [
      'Basic Grammar Checking',
      'Standard Tone Rewriting',
      'Up to 10 Headlines/day',
      'Short Summaries',
      'Community Support'
    ]
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 'Rs. 2,990',
    period: '/month',
    description: 'For professionals needing advanced capabilities.',
    icon: Zap,
    color: 'text-red-600',
    bg: 'bg-red-0',
    border: 'border-red-200',
    badge: 'Most Used',
    buttonClass: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    features: [
      'Everything in Free',
      'Advanced Grammar & Style',
      'Unlimited Headlines',
      'Long-form Summaries',
      'Priority Email Support',
      'Early Access to New Features'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Rs. 7,490',
    period: '/month',
    description: 'For newsrooms and power users requiring max performance.',
    icon: Sparkles,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    buttonClass: 'bg-gray-900 text-white hover:bg-black shadow-sm',
    features: [
      'Everything in Plus',
      'Custom Style Tones',
      'API Access',
      'Team Collaboration',
      'Dedicated Account Manager',
      '24/7 Phone Support'
    ]
  }
];

export default function Plans({ currentPlan = 'free' }) {
  return (
    <div className="font-sans w-full flex flex-col items-center pt-4 pb-12">
      <div className="text-center mb-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Upgrade your workflow</h1>
        <p className="text-gray-500 text-lg">Choose the right plan to elevate your Sinhala journalism and writing capabilities.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`
                relative flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300
                ${plan.id === 'plus' ? 'border-red-500 shadow-xl shadow-blue-500/10 scale-105 z-10 bg-white' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'}
              `}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${plan.bg}`}>
                  <Icon size={24} className={plan.color} strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-sm text-gray-500 h-10">{plan.description}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm font-medium text-gray-500">{plan.period}</span>
              </div>

              <button
                className={`
                  w-full py-3 px-6 rounded-xl font-semibold text-[15px] transition-all duration-200 mb-8
                  ${isCurrentPlan ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-0' : plan.buttonClass}
                `}
                disabled={isCurrentPlan}
              >
                {isCurrentPlan ? 'Current Plan' : 'Upgrade'}
              </button>

              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Includes</p>
                <ul className="space-y-3.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.id === 'plus' ? 'bg-blue-100' : plan.bg}`}>
                        <Check size={12} className={plan.id === 'plus' ? 'text-blue-600' : plan.color} strokeWidth={3} />
                      </div>
                      <span className="text-[14px] text-gray-600 font-medium leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
