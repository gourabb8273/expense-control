import { useState } from 'react';
import { AMOUNT_MASK, useFormatMoney } from '../utils/formatMoney';

export default function PrivacyAmountInput({
  value,
  onChange,
  onBlur,
  className = '',
  min,
  step = '0.01',
  placeholder = '0',
  inputMode = 'numeric',
  'aria-label': ariaLabel,
  disabled,
}) {
  const { hideAmounts } = useFormatMoney();
  const [focused, setFocused] = useState(false);

  const num = Number(value);
  const hasAmount = value !== '' && value != null && !Number.isNaN(num) && num !== 0;
  const masked = hideAmounts && !focused && hasAmount;

  const handleBlur = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  if (masked) {
    return (
      <input
        type="text"
        className={`privacy-amount-input ${className}`.trim()}
        value={AMOUNT_MASK}
        readOnly
        onFocus={() => setFocused(true)}
        aria-label={ariaLabel}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      type="number"
      className={className}
      min={min}
      step={step}
      inputMode={inputMode}
      value={value === 0 ? '' : value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
    />
  );
}
