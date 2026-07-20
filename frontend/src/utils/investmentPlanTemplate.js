/** Standard monthly investment projection (₹90k split). */
export const STANDARD_INVESTMENT_PLAN = {
  items: [
    { name: 'Bank RD', amount: 20000, tag: 'RD', platform: 'ICICI Bank' },
    { name: 'HDFC BSE Sensex Index', amount: 10000, tag: 'MF', platform: 'Grow' },
    { name: 'Parag Parikh Flexi Cap', amount: 10000, tag: 'MF', platform: 'Grow' },
    { name: 'HDFC Mid-Cap Opportunities', amount: 10000, tag: 'MF', platform: 'Grow' },
    { name: 'Quant Small Cap', amount: 10000, tag: 'MF', platform: 'Grow' },
    { name: 'Motilal Oswal India Defence Index', amount: 5000, tag: 'MF', platform: 'Grow' },
    { name: 'DSP Healthcare Fund', amount: 5000, tag: 'MF', platform: 'Grow' },
    { name: 'ICICI Prudential Short Term Debt', amount: 5000, tag: 'Emergency', platform: 'PhonePe' },
    { name: 'VOO (US S&P 500 ETF)', amount: 5000, tag: 'USA ETF', platform: 'INDmoney' },
    { name: 'SMH (US Semiconductor ETF)', amount: 5000, tag: 'USA ETF', platform: 'INDmoney' },
    { name: 'Gold ETF / Fund (e.g., Gold BeES)', amount: 5000, tag: 'Gold', platform: 'Grow' },
  ],
  notes: 'Total budget ₹90,000. Rest ₹10,000 in stock.',
};

export const SUGGESTED_PLATFORMS = [
  'Grow',
  'INDmoney',
  'ICICI Bank',
  'PhonePe',
  'Zerodha',
  'HDFC Bank',
  'Paytm Money',
  'Kuvera',
];

export function clonePlanItems(items) {
  return (items || []).map((i) => ({
    name: i.name ?? '',
    amount: Number(i.amount) || 0,
    tag: i.tag ?? '',
    platform: i.platform ?? '',
  }));
}
