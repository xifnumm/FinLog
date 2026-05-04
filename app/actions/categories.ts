'use server';

import { requireAuth } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { CategorySchema, ReorderSchema } from '@/lib/validators';
import { z } from 'zod';

export async function createCategory(formData: unknown) {
  await requireAuth();

  const parsed = CategorySchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('categories')
    .insert(parsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function updateCategory(id: string, formData: unknown) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { data: null, error: 'Invalid ID' };

  const parsed = CategorySchema.partial().safeParse(formData);
  if (!parsed.success) return { data: null, error: 'Invalid input' };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('categories')
    .update(parsed.data)
    .eq('id', idParsed.data)
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function deleteCategory(id: string) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();

  // Warn if expenses exist
  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', idParsed.data);

  if ((count ?? 0) > 0) {
    return {
      error: `This category has ${count} expense(s). Delete them first or they will be cascade-deleted.`,
      hasExpenses: true,
    };
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', idParsed.data);

  return { error: error?.message ?? null, hasExpenses: false };
}

export async function deleteCategoryForce(id: string) {
  await requireAuth();

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { error: 'Invalid ID' };

  const supabase = createServerClient();
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', idParsed.data);

  return { error: error?.message ?? null };
}

export async function reorderCategories(orderedIds: string[]) {
  await requireAuth();

  const parsed = ReorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = createServerClient();
  const updates = parsed.data.orderedIds.map((id, index) =>
    supabase.from('categories').update({ sort_order: index }).eq('id', id),
  );

  await Promise.all(updates);
  return { error: null };
}
