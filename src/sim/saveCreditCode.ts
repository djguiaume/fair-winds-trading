import type { GoodId } from './goods';
import type { CreditLoan } from './credit';

/**
 * A load on credit (decision 0200), after fog of war's section and only while she owes one: its
 * number, the order's port and the good (indexes), the units and the gold owed.
 */
export const CREDIT_SECTION = 14;

interface NumberSink {
  uint(n: number): void;
}
interface NumberSource {
  uint(): number;
}

/** Writes the loan's numbers, after the section number. */
export function packLoan(
  w: NumberSink,
  loan: CreditLoan,
  ports: readonly string[],
  goods: readonly GoodId[],
): void {
  w.uint(ports.indexOf(loan.port));
  w.uint(goods.indexOf(loan.good));
  w.uint(loan.qty);
  w.uint(loan.owed);
}

/** The loan, or undefined when its port or good is not in the lists. */
export function unpackLoan(
  r: NumberSource,
  ports: readonly string[],
  goods: readonly GoodId[],
): CreditLoan | undefined {
  const port = ports[r.uint()];
  const good = goods[r.uint()];
  const qty = r.uint();
  const owed = r.uint();
  return port && good ? { port, good, qty, owed } : undefined;
}
