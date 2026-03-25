import { supabase } from '../supabaseClient';

export const checkOrderingAvailability = async (timeoutMs = 6000) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);

    return !error;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
};