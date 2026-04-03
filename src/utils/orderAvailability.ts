import { supabase } from '../supabaseClient';

export async function checkOrderingAvailability(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) return false; // Default to closed if error

    // 1. Check if manually turned off
    if (data.is_online_active === false) {
      return false;
    }

    // 2. Check if cashier is unreachable (Heartbeat check)
    // Convert Supabase timestamp and Current Time to milliseconds
    const lastSeenTime = new Date(data.cashier_last_seen).getTime();
    const currentTime = new Date().getTime();
    
    // Calculate difference in minutes
    const differenceInMinutes = (currentTime - lastSeenTime) / (1000 * 60);

    // If we haven't heard from the cashier in 5 minutes, close the store
    if (differenceInMinutes > 2) {
      console.warn("Store automatically closed: Cashier device unreachable.");
      return false;
    }

    // If both checks pass, the store is open!
    return true;

  } catch (err) {
    console.error("Availability check failed:", err);
    return false;
  }
}