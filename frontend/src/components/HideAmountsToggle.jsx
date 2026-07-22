import { usePrivacy } from '../context/PrivacyContext';

export default function HideAmountsToggle() {
  const { hideAmounts, toggleHideAmounts } = usePrivacy();

  return (
    <button
      type="button"
      className={`ghost-btn hide-amounts-toggle${hideAmounts ? ' is-active' : ''}`}
      onClick={toggleHideAmounts}
      title={hideAmounts ? 'Show rupee amounts' : 'Hide rupee amounts (privacy)'}
      aria-pressed={hideAmounts}
    >
      {hideAmounts ? '👁 Show amounts' : '🙈 Hide amounts'}
    </button>
  );
}
