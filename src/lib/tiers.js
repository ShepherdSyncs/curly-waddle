// Pricing tier definitions and helper functions for ShepherdSyncs

export const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    memberLimit: 50,
    memberBuffer: 5,
    liveStreamDestinations: 1,
    features: {
      fullChat: false,
      massTexting: false,
      liveStreamSocial: false,
    },
    featuresList: [
      'Up to 50 members',
      '1 live stream destination (public page only)',
      'Attendance tracking',
      'Giving tracking',
      'Bible studies',
      'Serving schedules',
    ],
    notIncluded: ['Chat features', 'Mass texting'],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 15,
    memberLimit: 150,
    memberBuffer: 5,
    liveStreamDestinations: 2,
    features: {
      fullChat: false,
      massTexting: false,
      liveStreamSocial: true,
    },
    featuresList: [
      'Up to 150 members',
      '2 stream destinations (public + FB or YouTube)',
      'Everything in Free',
      'Chat with pastoral team only',
    ],
    notIncluded: ['Full chat features', 'Mass texting'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 30,
    memberLimit: 500,
    memberBuffer: 5,
    liveStreamDestinations: -1,
    features: {
      fullChat: true,
      massTexting: true,
      liveStreamSocial: true,
    },
    featuresList: [
      'Up to 500 members',
      'Unlimited stream destinations',
      'Everything in Basic',
      'Full chat (members, groups, pastoral)',
      'Mass texting',
      'All features unlocked',
    ],
    notIncluded: [],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    memberLimit: -1,
    memberBuffer: 0,
    liveStreamDestinations: -1,
    features: {
      fullChat: true,
      massTexting: true,
      liveStreamSocial: true,
    },
    featuresList: [
      'Multi-site churches',
      '500+ members',
      'Custom configuration',
      'Dedicated support',
    ],
    notIncluded: [],
  },
  global_admin_override: {
    id: 'global_admin_override',
    name: 'Full Access',
    price: 0,
    memberLimit: -1,
    memberBuffer: 0,
    liveStreamDestinations: -1,
    features: {
      fullChat: true,
      massTexting: true,
      liveStreamSocial: true,
    },
    featuresList: ['All features unlocked (Admin Override)'],
    notIncluded: [],
  },
};

export const TRIAL_DAYS = 90;

export function getTierConfig(tier) {
  return TIERS[tier] || TIERS.free;
}

export function getEffectiveMemberLimit(tier) {
  const config = getTierConfig(tier);
  if (config.memberLimit === -1) return -1;
  return config.memberLimit + config.memberBuffer;
}

export function hasTierFeature(tier, feature) {
  const config = getTierConfig(tier);
  return !!config.features[feature];
}

export function isTrialActive(church) {
  if (!church) return false;
  if (church.subscription_status !== 'trial') return false;
  if (!church.trial_end_date) return false;
  return new Date(church.trial_end_date) > new Date();
}

export function getTrialDaysRemaining(church) {
  if (!isTrialActive(church)) return 0;
  const end = new Date(church.trial_end_date);
  const now = new Date();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}