import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// Auto-assign department based on issue type
export function getDepartmentForIssue(issueType) {
  switch (issueType) {
    case 'Marketing Issue':      return 'Marketing Team';
    case 'Institutional Issue':  return 'Admin Team';
    case 'Personal Issue':       return 'Support/HR Team';
    default:                     return 'Support/HR Team';
  }
}

export function useTeacherSupport({ issueTypeFilter = 'all', statusFilter = 'all', myIssues = false, currentUserId = null } = {}) {
  const [issues, setIssues]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchIssues = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    let query = supabase
      .from('ttp_teacher_support')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (issueTypeFilter && issueTypeFilter !== 'all') {
      query = query.eq('issue_type', issueTypeFilter);
    }
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error: err } = await query;
    setLoading(false);
    if (err) {
      setError(err.code === '42P01'
        ? 'Table "ttp_teacher_support" not found. Please run the migration SQL in Supabase.'
        : err.message);
      return;
    }
    setIssues(data || []);
  }, [issueTypeFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchIssues();
    const channel = supabase
      .channel('ttp_teacher_support_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttp_teacher_support' }, () => {
        fetchIssues(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchIssues]);

  // Create a new issue
  const createIssue = useCallback(async (fields, creatorId) => {
    const { data, error: err } = await supabase
      .from('ttp_teacher_support')
      .insert([{
        ttp_code:       fields.ttp_code      || null,
        teacher_name:   fields.teacher_name,
        mobile_number:  fields.mobile_number,
        student_count:  fields.student_count ? parseInt(fields.student_count, 10) : null,
        since_started:  fields.since_started || null,
        issue_type:     fields.issue_type,
        remark:         fields.remark        || null,
        status:         fields.status        || 'New',
        follow_up_date: fields.follow_up_date || null,
        created_by:     creatorId || null,
      }])
      .select()
      .single();
    if (err) throw err;
    await fetchIssues();
    return data;
  }, [fetchIssues]);

  // Update an issue
  const updateIssue = useCallback(async (id, updates) => {
    if (updates.student_count !== undefined && updates.student_count !== null && updates.student_count !== '') {
      updates.student_count = parseInt(updates.student_count, 10);
    }
    const { data, error: err } = await supabase
      .from('ttp_teacher_support')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (err) throw err;
    setIssues(prev => prev.map(i => i.id === id ? { ...i, ...data } : i));
    return data;
  }, []);

  // Delete an issue
  const deleteIssue = useCallback(async (id) => {
    const { error: err } = await supabase
      .from('ttp_teacher_support')
      .delete()
      .eq('id', id);
    if (err) throw err;
    setIssues(prev => prev.filter(i => i.id !== id));
  }, []);

  return { issues, loading, error, refetch: fetchIssues, createIssue, updateIssue, deleteIssue };
}
