import { z } from "zod";

export const mobileMoneyPayoutSchema = z
  .object({
    method: z.literal("mobile_money"),
    phone: z.string().min(1, "phone obligatoire"),
    operator: z.string().min(1, "operator obligatoire"),
  })
  .strict();

export const bankPayoutSchema = z
  .object({
    method: z.literal("bank"),
    account_number: z.string().min(1, "account_number obligatoire"),
    account_name: z.string().min(1, "account_name obligatoire"),
    bank_name: z.string().min(1, "bank_name obligatoire"),
  })
  .strict();

export const withdrawalPayoutSchema = z.discriminatedUnion("method", [
  mobileMoneyPayoutSchema,
  bankPayoutSchema,
]);

export type MobileMoneyPayout = z.infer<typeof mobileMoneyPayoutSchema>;
export type BankPayout = z.infer<typeof bankPayoutSchema>;
export type WithdrawalPayout = z.infer<typeof withdrawalPayoutSchema>;
