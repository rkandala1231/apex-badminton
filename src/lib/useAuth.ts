import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useIsAdmin(user: User | null) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    setIsAdmin(null);
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(!error && !!data);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}

/** Super admins get everything, including managing who else is staff.
 *  Regular admins get full tournament-management access but not this. */
export function useIsSuperAdmin(user: User | null) {
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(null);
      return;
    }
    let cancelled = false;
    setIsSuperAdmin(null);
    supabase.rpc('is_super_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsSuperAdmin(!error && !!data);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isSuperAdmin;
}
