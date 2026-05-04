import { z } from 'zod';

export const CategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(['monthly', 'annual']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1).max(50),
  sort_order: z.number().int().optional(),
});

export const ExpenseSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1).max(200).trim(),
  dedicated_amount: z.number().min(0).nullable().optional(),
  billing_month: z.number().int().min(1).max(12).nullable().optional(),
  billing_day: z.number().int().min(1).max(31).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const MonthlyPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  total_received: z.number().min(0),
  notes: z.string().max(1000).nullable().optional(),
});

export const ExpenseLogSchema = z.object({
  period_id: z.string().uuid(),
  expense_id: z.string().uuid(),
  actual_amount: z.number().min(0).nullable(),
  notes: z.string().max(500).nullable().optional(),
});

export const AnnualExpenseLogSchema = z.object({
  annual_period_id: z.string().uuid(),
  expense_id: z.string().uuid(),
  actual_amount: z.number().min(0).nullable(),
  paid_at: z.string().date().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const ReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
