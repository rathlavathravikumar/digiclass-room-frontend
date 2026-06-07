const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 
  ((typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ? '' : 'http://localhost:3001');

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (typeof window !== 'undefined') ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    ...(init?.headers as any || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  console.log(`Making API call to: ${BASE_URL}${path}`);
  console.log('Request config:', { headers, credentials: 'include', cache: 'no-store', ...init });

  const res = await fetch(`${BASE_URL}${path}`.replace(/\/+$/, '').replace(/(?<!:)\/\/+/, '/'), {
    headers,
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  
  console.log(`Response status: ${res.status} for ${path}`);
  
  if (!res.ok) {
    const errorData = await res.text().catch(() => 'Network error');
    console.error(`API Error for ${path}:`, errorData);
    throw new Error(errorData || `Request failed: ${res.status}`);
  }
  
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    console.log(`API Response for ${path}:`, data);
    return data;
  }
  return (undefined as unknown) as T;
}

export type ApiEnvelope<T> = { statusCode?: number; data: T; message?: string };

export const api = {
  getCourses: async (params?: { teacher_id?: string }) => {
    const qs = params?.teacher_id ? `?teacher_id=${encodeURIComponent(params.teacher_id)}` : '';
    return http<ApiEnvelope<any[]>>(`/api/v1/courses/${qs}`);
  },
  getCourse: async (id: string) => {
    return http<ApiEnvelope<any>>(`/api/v1/courses/${id}`);
  },
  getAssignments: async (params?: { course_id?: string; teacher_id?: string }) => {
    const q: string[] = [];
    if (params?.course_id) q.push(`course_id=${encodeURIComponent(params.course_id)}`);
    if (params?.teacher_id) q.push(`teacher_id=${encodeURIComponent(params.teacher_id)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    return http<ApiEnvelope<any[]>>(`/api/v1/assignments/${qs}`);
  },
  getAssignment: async (id: string) => {
    return http<ApiEnvelope<any>>(`/api/v1/assignments/${id}`);
  },
  createAssignment: async (payload: { title: string; description?: string; due_date: string; course_id: string; total_marks?: number }) =>
    http<ApiEnvelope<any>>(`/api/v1/assignments`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteAssignment: async (id: string) =>
    http<ApiEnvelope<any>>(`/api/v1/assignments/${id}`, { method: 'DELETE' }),
  getTests: async () => {
    return http<ApiEnvelope<any[]>>(`/api/v1/tests/`);
  },
  getTest: async (id: string) =>
    http<ApiEnvelope<any>>(`/api/v1/tests/${id}`),
  createTest: async (payload: { title: string; description?: string; scheduled_at: string; course_id: string }) =>
    http<ApiEnvelope<any>>(`/api/v1/tests`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteTest: async (id: string) =>
    http<ApiEnvelope<any>>(`/api/v1/tests/${id}`, { method: 'DELETE' }),
  submitTest: async (id: string, answers: Array<string|number>) =>
    http<ApiEnvelope<{ correct: number; totalQuestions: number; score: number; max_score: number }>>(`/api/v1/tests/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  
  // Progress APIs
  getStudentProgress: async (studentId: string) =>
    http<ApiEnvelope<any>>(`/api/v1/progress/student/${studentId}`),
  getCourseProgress: async (courseId: string) =>
    http<ApiEnvelope<any>>(`/api/v1/progress/course/${courseId}`),
  getAdminCourseProgress: async (courseId: string) =>
    http<ApiEnvelope<any>>(`/api/v1/progress/admin/course/${courseId}`),
  getAdminCoursesOverview: async () =>
    http<ApiEnvelope<any>>(`/api/v1/progress/admin/courses`),
  // Public notices for teachers/students
  listPublicNotices: async (params?: { target?: 'all' | 'students' | 'teachers'; admin_id?: string }) => {
    const u = new URLSearchParams();
    if (params?.target) u.set('target', params.target);
    if (params?.admin_id) u.set('admin_id', params.admin_id);
    const qs = u.toString();
    return http<ApiEnvelope<any[]>>(`/api/v1/notices${qs ? `?${qs}` : ''}`);
  },
  // Marks APIs
  upsertMarks: async (payload: { type: 'assignment'|'test'; ref_id: string; student_id: string; score: number; max_score: number; remarks?: string; course_id?: string }) =>
    http<ApiEnvelope<any>>(`/api/v1/marks`, { method: 'POST', body: JSON.stringify(payload) }),
  getMarksByItem: async (type: 'assignment'|'test', refId: string) =>
    http<ApiEnvelope<any[]>>(`/api/v1/marks/${type}/${refId}`),
  // File upload (Cloudinary via backend). Important: do not set JSON headers here
  uploadFile: async (file: File) => {
    const fd = new FormData();
    // backend expects field name 'File' on /upload
    fd.append('File', file);
    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Upload failed'));
    return res.json() as Promise<{ message: string; url: string; public_id: string; resource_type: string }>;
  },
  // Submissions (student)
  submitWork: async (payload: { type: 'assignment'|'test'; ref_id: string; course_id?: string; file_url?: string; text?: string; link?: string }) =>
    http<ApiEnvelope<any>>(`/api/v1/submissions`, { method: 'POST', body: JSON.stringify(payload) }),
  // Single-step: upload file and persist submission
  uploadAndSubmit: async (payload: { file: File; type: 'assignment'|'test'; ref_id: string; course_id?: string; text?: string; link?: string }) => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('accessToken') : null;
    const fd = new FormData();
    fd.append('Upload File', payload.file);
    fd.append('type', payload.type);
    fd.append('ref_id', payload.ref_id);
    if (payload.course_id) fd.append('course_id', payload.course_id);
    if (payload.text) fd.append('text', payload.text);
    if (payload.link) fd.append('link', payload.link);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/upload/submit`, {
      method: 'POST',
      body: fd,
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'Upload/submit failed'));
    return res.json() as Promise<{ message: string; data: any }>;
  },
  // Submissions list by item (teacher/admin)
  getSubmissionsByItem: async (type: 'assignment'|'test', refId: string) =>
    http<ApiEnvelope<any[]>>(`/api/v1/submissions/${type}/${refId}`),
  // Marks listing for filtering attempted tests
  listMarks: async (params?: { type?: 'assignment'|'test'; student_id?: string; ref_id?: string; course_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.student_id) qs.set('student_id', params.student_id);
    if (params?.ref_id) qs.set('ref_id', params.ref_id);
    if (params?.course_id) qs.set('course_id', params.course_id);
    const q = qs.toString();
    return http<ApiEnvelope<any[]>>(`/api/v1/marks${q ? `?${q}` : ''}`);
  },
  registerStudent: async (payload: { name: string; email: string; password: string; class_id: string }) => {
    return http<ApiEnvelope<any>>(`/api/v1/student/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  teacherLogin: async (payload: { email: string; password: string }) =>
    http<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(`/api/v1/teacher/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  studentLogin: async (payload: { email: string; password: string }) =>
    http<ApiEnvelope<{ accessToken: string; refreshToken: string }>>(`/api/v1/student/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  teacherMe: async () => http<ApiEnvelope<any>>(`/api/v1/teacher/me`),
  studentMe: async () => http<ApiEnvelope<any>>(`/api/v1/student/me`),
  // Student timetable (read-only)
  getStudentTimetable: async (scope?: string) => {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return http<ApiEnvelope<Record<string, Record<string, string>>>>(`/api/v1/student/timetable${qs}`);
  },
  // Meeting APIs
  getMeetings: async (params?: { course_id?: string; status?: string; from_date?: string; to_date?: string; limit?: number; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.course_id) qs.set('course_id', params.course_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.from_date) qs.set('from_date', params.from_date);
    if (params?.to_date) qs.set('to_date', params.to_date);
    if (params?.limit) qs.set('limit', params.limit.toString());
    if (params?.page) qs.set('page', params.page.toString());
    const q = qs.toString();
    return http<ApiEnvelope<{ meetings: any[]; pagination: any }>>(`/api/v1/meetings${q ? `?${q}` : ''}`);
  },
  getMeeting: async (id: string) => {
    return http<ApiEnvelope<any>>(`/api/v1/meetings/${id}`);
  },
  createMeeting: async (payload: { title: string; description?: string; course_id: string; scheduled_time: string; duration?: number }) =>
    http<ApiEnvelope<any>>(`/api/v1/meetings`, { method: 'POST', body: JSON.stringify(payload) }),
  updateMeeting: async (id: string, payload: { title?: string; description?: string; scheduled_time?: string; duration?: number; status?: string }) =>
    http<ApiEnvelope<any>>(`/api/v1/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMeeting: async (id: string) =>
    http<ApiEnvelope<any>>(`/api/v1/meetings/${id}`, { method: 'DELETE' }),
  joinMeeting: async (id: string) => {
    return http<ApiEnvelope<{ meeting_link: string; meeting_password?: string; title: string; course: any; teacher: any; scheduled_time: string; duration: number }>>(`/api/v1/meetings/${id}/join`);
  },
  getUpcomingMeetings: async (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return http<ApiEnvelope<any[]>>(`/api/v1/meetings/upcoming${qs}`);
  },

  // Course-related APIs
  getStudentCourses: async (studentId: string) => {
    return http<ApiEnvelope<any[]>>(`/api/v1/courses/student/${studentId}`);
  },
  getCourseResources: async (courseId: string) => {
    return http<ApiEnvelope<any[]>>(`/api/v1/courses/${courseId}/resources`);
  },
  uploadCourseResource: async (courseId: string, formData: FormData) => {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('accessToken') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${BASE_URL}/api/v1/courses/${courseId}/resources`, {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include'
    });
    
    if (!res.ok) {
      const errorData = await res.text().catch(() => 'Network error');
      throw new Error(errorData || `Request failed: ${res.status}`);
    }
    
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return res.json();
    }
    return undefined;
  },
  deleteCourseResource: async (resourceId: string) => {
    return http<ApiEnvelope<any>>(`/api/v1/courses/resources/${resourceId}`, { method: 'DELETE' });
  },
  getCourseDiscussions: async (courseId: string) => {
    return http<ApiEnvelope<any[]>>(`/api/v1/courses/${courseId}/discussions`);
  },
  postCourseDiscussion: async (courseId: string, payload: { message: string }) => {
    return http<ApiEnvelope<any>>(`/api/v1/courses/${courseId}/discussions`, { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
  },
  // Attendance APIs
  markAttendance: async (payload: { course_id: string; date: string; records: Array<{ student_id: string; status: 'present' | 'absent' }> }) =>
    http<ApiEnvelope<any>>(`/api/v1/attendance/mark`, { method: 'POST', body: JSON.stringify(payload) }),
  getAttendanceByDate: async (courseId: string, date: string) =>
    http<ApiEnvelope<any>>(`/api/v1/attendance/date?course_id=${courseId}&date=${date}`),
  getAttendanceHistory: async (courseId: string, limit?: number) => {
    const qs = limit ? `?course_id=${courseId}&limit=${limit}` : `?course_id=${courseId}`;
    return http<ApiEnvelope<any[]>>(`/api/v1/attendance/history${qs}`);
  },
  getAttendanceSummary: async (params: { course_id: string; month?: string }) => {
    const qs = new URLSearchParams();
    qs.set('course_id', params.course_id);
    if (params.month) qs.set('month', params.month);
    return http<ApiEnvelope<any[]>>(`/api/v1/attendance/summary?${qs.toString()}`);
  },
  getStudentAttendance: async (courseId: string, studentId: string) =>
    http<ApiEnvelope<any>>(`/api/v1/attendance/student?course_id=${courseId}&student_id=${studentId}`),
  
  // Dashboard Statistics APIs
  getAdminStats: async () =>
    http<ApiEnvelope<{ totalStudents: number; totalTeachers: number; totalCourses: number; totalNotices: number }>>(`/api/v1/admin/stats`),
  getTeacherStats: async (teacherId: string) =>
    http<ApiEnvelope<{ activeCourses: number; totalStudents: number; pendingSubmissions: number; testsCreated: number }>>(`/api/v1/teacher/stats/${teacherId}`),
  getStudentStats: async (studentId: string) =>
    http<ApiEnvelope<{ enrolledCourses: number; completedAssignments: number; pendingAssignments: number; averageGrade: number }>>(`/api/v1/student/stats/${studentId}`),
};
