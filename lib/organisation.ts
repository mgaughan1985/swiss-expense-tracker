// lib/organisation.ts
// V1: returns the user's first org membership (single active org in UI).
// Schema supports multiple rows in organisation_members — multi-org switching is V2.

import { supabase } from './supabase';

export type OrgRole = 'employee' | 'manager' | 'admin';

export interface OrgMembership {
  organisation_id: string;
  role: OrgRole;
  name: string;
  country: string;
  currency: string;
}

export async function getActiveMembership(): Promise<OrgMembership | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('organisation_members')
    .select('organisation_id, role, organisations(name, country, currency)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const org = data.organisations as { name: string; country: string; currency: string } | null;
  if (!org) return null;

  return {
    organisation_id: data.organisation_id,
    role: data.role as OrgRole,
    name: org.name,
    country: org.country,
    currency: org.currency,
  };
}

export function isManager(role: OrgRole | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}
