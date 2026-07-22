export type SimpleSetupInput = {
  /** @deprecated użyj pawelBalanceGrosze + milenaBalanceGrosze */
  balanceGrosze?: number;
  pawelBalanceGrosze: number;
  milenaBalanceGrosze: number;
  incomeName?: string;
  incomeAmountGrosze?: number;
  incomeDayOfMonth?: number;
  /** Kto dostaje główną pensję z kreatora */
  incomeOwner?: "pawel" | "milena";
};
