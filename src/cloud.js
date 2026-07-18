import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://gxhytlececyzsmohtgnv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WqJOYKdjieTZ4huFUVpeUQ_EgteOOUU';
export const cloud = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

export async function signIn(email, password) {
  const { data, error } = await cloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() { await cloud.auth.signOut(); }
export async function getUser() { return (await cloud.auth.getUser()).data.user; }
export async function getMyProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await cloud.from('profiles').select('id,full_name,phone,role,active').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

function dataUrlToBlob(dataUrl) {
  const [meta, body] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export async function uploadSubmission(localResult) {
  const user = await getUser();
  if (!user) throw new Error('Sign in before synchronization.');
  let photoPath = null;
  if (localResult.photo) {
    photoPath = `${user.id}/${localResult.stationId}/${localResult.id}.jpg`;
    const { error } = await cloud.storage.from('result-forms').upload(photoPath, dataUrlToBlob(localResult.photo), { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
  }
  const payload = {
    client_submission_id: localResult.id,
    station_id: localResult.stationId,
    monitor_id: user.id,
    opening_status: localResult.openingStatus,
    ballots_cast: localResult.ballotsCast,
    rejected_ballots: localResult.rejectedBallots,
    valid_votes: localResult.validVotes,
    candidate_votes: localResult.candidateVotes,
    incident: localResult.incident || null,
    photo_path: photoPath,
    device_location: localResult.deviceLocation,
    submitted_at: localResult.createdAt
  };
  const { error } = await cloud.from('result_submissions').upsert(payload, { onConflict: 'client_submission_id' });
  if (error) throw error;
}

export async function fetchCloudResults() {
  const { data, error } = await cloud.from('result_submissions').select('id,client_submission_id,station_id,monitor_id,opening_status,ballots_cast,rejected_ballots,valid_votes,candidate_votes,incident,photo_path,device_location,status,supervisor_comment,submitted_at,verified_at').order('submitted_at',{ascending:false});
  if (error) throw error;
  return data || [];
}

export async function signedFormUrl(photoPath) {
  if (!photoPath) return null;
  const { data, error } = await cloud.storage.from('result-forms').createSignedUrl(photoPath, 900);
  if (error) throw error;
  return data.signedUrl;
}

export async function reviewSubmission(id, status, comment='') {
  const user = await getUser();
  if (!user) throw new Error('Sign in before reviewing results.');
  const changes = { status, supervisor_id:user.id, supervisor_comment:comment || null, verified_at:status==='Verified'?new Date().toISOString():null };
  const { error } = await cloud.from('result_submissions').update(changes).eq('id',id);
  if (error) throw error;
}

export function subscribeToResults(onChange) {
  return cloud.channel('zemrs-results').on('postgres_changes', { event: '*', schema: 'public', table: 'result_submissions' }, onChange).subscribe();
}
