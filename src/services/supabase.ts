// Supabase is disabled for now due to Lynx WebSocket compatibility issues
// Using localStorage only - Supabase can be added later via native module bridging

export function getSupabase(): null {
  return null;
}

export function isSupabaseAvailable(): boolean {
  return false;
}
