export type SimpleSetupInput = {
  /** Saldo zalogowanej osoby (jej konto osobiste). */
  myBalanceGrosze: number;
  /** @deprecated */
  balanceGrosze?: number;
  pawelBalanceGrosze?: number;
  milenaBalanceGrosze?: number;
  incomeName?: string;
  incomeAmountGrosze?: number;
  incomeDayOfMonth?: number;
  incomeOwner?: "pawel" | "milena";
};
