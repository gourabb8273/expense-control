import { useFormatMoney } from '../utils/formatMoney';

export default function ChartTotal({ amount, label = 'Total' }) {
  const { inr } = useFormatMoney();
  if (amount == null || Number(amount) === 0) return null;
  return (
    <p className="chart-total">
      {label}: {inr(amount)}
    </p>
  );
}
