import { formatMoney } from '../lib/money';
import { cn } from '../lib/utils';

// Display text for an amount in agorot. It is formatMoney's output with the invisible
// direction marks removed: inside the left-to-right isolate below those marks would pull a
// leading minus to the wrong side of the number. The digits and rounding are formatMoney's.
export function displayMoney(agorot, options) {
  return formatMoney(agorot, options).replace(/[‎‏]/g, '');
}

// An amount as one left-to-right unit inside right-to-left text, so "-19.99 ₪" and "+120.00 ₪"
// keep their sign in front of the number instead of flipping to "19.99-".
//   prefix: optional sign text shown before the amount (the amount itself stays unsigned).
export default function Money({ agorot, prefix = '', className, ...rest }) {
  return (
    <span dir="ltr" className={cn('inline-block whitespace-nowrap tabular-nums', className)} {...rest}>
      {prefix}{displayMoney(agorot)}
    </span>
  );
}
