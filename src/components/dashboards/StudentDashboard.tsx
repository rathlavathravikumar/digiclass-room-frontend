import { useEffect, useRef, useState } from "react";
import RoleBasedHeader from "@/components/layout/RoleBasedHeader";
import Sidebar from "@/components/layout/Sidebar";
import StatsCards from "@/components/dashboard/StatsCards";
import CourseCard from "@/components/courses/CourseCard";
// DiscussionCard removed - discussions now handled in course pages
import AssignmentCard from "@/components/assignments/AssignmentCard";
import NoticeBoard from "@/components/notices/NoticeBoard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, MessageCirclePlus, RefreshCw, Calendar, Trophy, TrendingUp, TrendingDown, CheckCircle, XCircle, ArrowUpDown, BarChart3, Award, X, Clock, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useNotificationWatcher } from "@/hooks/useNotificationWatcher";
import UpcomingMeetings from "@/components/meetings/UpcomingMeetings";
import MeetingsList from "@/components/meetings/MeetingsList";
import StudentCoursesList from "@/components/courses/StudentCoursesList";
import StudentProgress from "@/components/progress/StudentProgress";

const StudentDashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  // Enable notification watching for new assignments and tests
  useNotificationWatcher();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseDetailTab, setCourseDetailTab] = useState<"overview" | "resources">("overview");
  const [testActive, setTestActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [testResult, setTestResult] = useState<null | { score: number; total: number }> (null);

  const [courses, setCourses] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [attemptedTestIds, setAttemptedTestIds] = useState<Set<string>>(new Set());
  const [currentTest, setCurrentTest] = useState<any | null>(null);
  const [selectedAssignmentForSubmit, setSelectedAssignmentForSubmit] = useState<any | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUploadFile, setAssignUploadFile] = useState<File | null>(null);
  const [assignText, setAssignText] = useState("");
  const [assignLink, setAssignLink] = useState("");
  const [selectedTestForSubmit, setSelectedTestForSubmit] = useState<any | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testUploadFile, setTestUploadFile] = useState<File | null>(null);
  const [testText, setTestText] = useState("");
  const [testLink, setTestLink] = useState("");

  const [attendanceData, setAttendanceData] = useState<Record<string, { conducted: number; attended: number }>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [refreshingAttendance, setRefreshingAttendance] = useState(false);
  const attendanceRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Dashboard stats state
  const [studentStats, setStudentStats] = useState<{ enrolledCourses: number; completedAssignments: number; pendingAssignments: number; averageGrade: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  
  // Test statistics state
  const [testStatistics, setTestStatistics] = useState<any[]>([]);
  const [loadingTestStats, setLoadingTestStats] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Assignment filtering state
  const [assignmentFilter, setAssignmentFilter] = useState<'pending' | 'submitted'>('pending');
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [selectedAssignmentForScore, setSelectedAssignmentForScore] = useState<any | null>(null);

  const fetchAttendanceData = async (showLoading: boolean = true) => {
    if (!user?._id || courses.length === 0) return;

    if (showLoading) setLoadingAttendance(true);
    setRefreshingAttendance(true);
    try {
      const attendanceDataMap: Record<string, { conducted: number; attended: number }> = {};

      for (const course of courses) {
        try {
          const res = await api.getAttendanceSummary({ course_id: course.id });
          const summary = (res as any)?.data || [];

          const studentEntry = Array.isArray(summary)
            ? summary.find((entry: any) => {
                const student = entry.student;
                const studentId = student?._id || student?.id || entry.student_id;
                return studentId && studentId.toString() === user._id?.toString();
              })
            : null;

          if (studentEntry) {
            attendanceDataMap[course.id] = {
              conducted: Number(studentEntry.total) || 0,
              attended: Number(studentEntry.present) || 0,
            };
          } else {
            attendanceDataMap[course.id] = { conducted: 0, attended: 0 };
          }
        } catch (error) {
          console.error(`Failed to fetch attendance for course ${course.id}`, error);
          attendanceDataMap[course.id] = { conducted: 0, attended: 0 };
        }
      }

      setAttendanceData(attendanceDataMap);
    } catch (error) {
      console.error("Failed to fetch attendance data", error);
    } finally {
      if (showLoading) setLoadingAttendance(false);
      setRefreshingAttendance(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getCourses();
        const items = (res as any)?.data || [];
        const mapped = items.map((c: any, idx: number) => {
          const teacherObj = c.teacher_id || c.teacher;
          const teacherName = typeof teacherObj === 'object' && teacherObj
            ? (teacherObj.name || teacherObj.email || 'TBD')
            : (c.teacher_name || c.teacher || 'TBD');
          return {
            id: c._id || c.id || String(idx + 1),
            name: c.name || "Course",
            teacher: teacherName,
            progress: 0,
            nextClass: "",
            pendingAssignments: 0,
            unreadMessages: 0,
            resources: 0,
            color: "bg-gradient-to-r from-blue-500 to-blue-600",
          };
        });
        setCourses(mapped);
      } catch (e) {
        setCourses([]);
      }
    })();
  }, []);

  // Function to fetch test statistics
  const fetchTestStatistics = async () => {
    if (!user?._id) return;
    
    setLoadingTestStats(true);
    try {
      // Fetch all marks for this student's tests
      const marksRes = await api.listMarks({ type: 'test', student_id: user._id });
      const marksData = (marksRes as any)?.data || [];
      
      // Fetch all tests to get test details
      const testsRes = await api.getTests();
      const testsData = (testsRes as any)?.data || [];
      
      // Combine marks with test details
      const statistics = marksData.map((mark: any) => {
        const test = testsData.find((t: any) => (t._id || t.id) === (mark.ref_id?._id || mark.ref_id));
        const percentage = mark.max_score > 0 ? Math.round((mark.score / mark.max_score) * 100) : 0;
        const status = percentage >= 60 ? 'Passed' : 'Failed'; // 60% passing grade
        
        return {
          id: mark._id,
          testId: mark.ref_id?._id || mark.ref_id,
          testName: test?.title || 'Unknown Test',
          date: mark.createdAt || test?.scheduled_at,
          score: mark.score,
          totalMarks: mark.max_score,
          percentage,
          status,
          remarks: mark.remarks || '',
          course: mark.course_id?.name || 'Unknown Course'
        };
      });
      
      setTestStatistics(statistics);
    } catch (error) {
      console.error('Failed to fetch test statistics:', error);
      setTestStatistics([]);
    } finally {
      setLoadingTestStats(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getTests();
        const list = (res as any)?.data || [];
        setTests(list);
      } catch (e) {
        setTests([]);
      }
      try {
        if (user?._id) {
          const marksRes = await api.listMarks({ type: 'test', student_id: user._id });
          const items = (marksRes as any)?.data || [];
          const ids = new Set(items.map((m: any) => (m.ref_id?._id || m.ref_id || m.id)));
          setAttemptedTestIds(ids as any);
        }
      } catch (e) {
        setAttemptedTestIds(new Set());
      }
    })();
  }, [user?._id]);

  // Fetch test statistics when tests section is active
  useEffect(() => {
    if (activeSection === 'tests' && user?._id) {
      fetchTestStatistics();
    }
  }, [activeSection, user?._id]);

  const letters = ['A','B','C','D'];

  useEffect(() => {
    if (!testActive || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [testActive, timeLeft]);

  useEffect(() => {
    if (testActive && timeLeft === 0) {
      // auto-submit current backend test when timer ends
      submitTest();
    }
  }, [timeLeft, testActive]);

  const startBackendTest = async (testId: string) => {
    try {
      const res = await api.getTest(testId);
      const t = (res as any)?.data || null;
      if (!t) return;
      setCurrentTest(t);
      setSelectedAnswers({});
      setTestResult(null);
      const dur = Number(t.duration_minutes || 60);
      setTimeLeft(Math.max(1, dur) * 60);
      setTestActive(true);
    } catch (e) {}
  };

  const submitTest = async () => {
    if (!currentTest?._id) { setTestActive(false); return; }
    try {
      const answers = (currentTest.questions || []).map((q: any, idx: number) => {
        const sel = selectedAnswers[String(idx)] ?? -1;
        return typeof sel === 'number' ? letters[sel] : sel;
      });
      const res = await api.submitTest(currentTest._id || currentTest.id, answers);
      const data = (res as any)?.data || {};
      setTestResult({ score: data.score ?? 0, total: data.max_score ?? (currentTest.total_marks || 100) });
      setTestActive(false);
      setDashboardRefreshKey((key) => key + 1);
      // refresh attempted set and test statistics
      if (user?._id) {
        const marksRes = await api.listMarks({ type: 'test', student_id: user._id });
        const items = (marksRes as any)?.data || [];
        const ids = new Set(items.map((m: any) => (m.ref_id?._id || m.ref_id || m.id)));
        setAttemptedTestIds(ids as any);
        // Refresh test statistics to include the new result
        fetchTestStatistics();
      }
    } catch (e) {
      setTestActive(false);
    }
  };

  // Discussions data removed - now handled in individual course pages

  // Course resources will be fetched from backend
  const [courseResources, setCourseResources] = useState<Record<string, any[]>>({});

  // Sort test statistics
  const sortedTestStatistics = [...testStatistics].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'date':
        aValue = new Date(a.date || 0).getTime();
        bValue = new Date(b.date || 0).getTime();
        break;
      case 'score':
        aValue = a.percentage;
        bValue = b.percentage;
        break;
      case 'name':
        aValue = a.testName.toLowerCase();
        bValue = b.testName.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Timetable for students (fetched from backend)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const periods = ["9:00", "10:00", "11:00", "1:00", "2:00"];
  const [ttData, setTtData] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    const loadStudentTt = async () => {
      try {
        const res = await api.getStudentTimetable();
        const data = (res as any)?.data || (res as any) || {};
        if (data && typeof data === 'object') setTtData(data as any);
      } catch (_) {
        setTtData({});
      }
    };
    if (activeSection === 'timetable') loadStudentTt();
  }, [activeSection]);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentMarks, setAssignmentMarks] = useState<Record<string, any>>({});
  
  // Function to fetch assignments with their submission status and marks
  const fetchAssignments = async () => {
    try {
      const res = await api.getAssignments();
      const items = (res as any)?.data || [];
      
      // Fetch assignment marks for this student
      let marksData: any[] = [];
      if (user?._id) {
        try {
          const marksRes = await api.listMarks({ type: 'assignment', student_id: user._id });
          marksData = (marksRes as any)?.data || [];
        } catch (e) {
          console.error('Failed to fetch assignment marks:', e);
        }
      }
      
      // Create marks lookup
      const marksLookup: Record<string, any> = {};
      marksData.forEach((mark: any) => {
        const refId = mark.ref_id?._id || mark.ref_id;
        marksLookup[refId] = mark;
      });
      setAssignmentMarks(marksLookup);
      
      const mapped = items.map((a: any, idx: number) => {
        const due = a.due_date || a.dueDate;
        const isOverdue = due ? new Date(due).getTime() < Date.now() : false;
        const assignmentId = a._id || a.id || String(idx + 1);
        const mark = marksLookup[assignmentId];
        
        // Determine status: if there's a mark, it's been submitted
        let status = "pending";
        if (mark) {
          status = "submitted";
        }
        
        return {
          id: assignmentId,
          title: a.title || "Assignment",
          course: a.course_name || a.course || "Course",
          dueDate: due || new Date().toISOString(),
          status: status,
          grade: mark?.score,
          totalMarks: mark?.max_score || a.totalMarks || 100,
          description: a.description || "",
          submissionType: a.submissionType || "File Upload",
          isOverdue,
          remarks: mark?.remarks || "",
          submissionDate: mark?.createdAt,
        };
      });
      setAssignments(mapped);
    } catch (e) {
      console.error('Failed to fetch assignments:', e);
      setAssignments([]);
    }
  };
  
  useEffect(() => {
    fetchAssignments();
  }, [user?._id, dashboardRefreshKey]);

  // Filter and sort assignments
  const filteredAndSortedAssignments = assignments
    .filter(assignment => {
      if (assignmentFilter === 'pending') {
        return assignment.status === 'pending' || !assignment.status;
      } else {
        return assignment.status === 'submitted' || assignment.status === 'completed';
      }
    })
    .sort((a, b) => {
      // For pending assignments, sort by due date (ascending - earliest first)
      // For submitted assignments, sort by submission date (descending - most recent first)
      if (assignmentFilter === 'pending') {
        const dateA = new Date(a.dueDate || 0).getTime();
        const dateB = new Date(b.dueDate || 0).getTime();
        return dateA - dateB; // Ascending order for due dates
      } else {
        // For submitted assignments, we might want to sort by submission date if available
        // For now, sort by due date in descending order (most recent first)
        const dateA = new Date(a.dueDate || 0).getTime();
        const dateB = new Date(b.dueDate || 0).getTime();
        return dateB - dateA; // Descending order
      }
    });

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCourseDetailTab("overview");
  };

  const handleDiscussionClick = (discussionId: string) => {
    console.log("Opening discussion:", discussionId);
  };

  const handleAssignmentClick = (assignmentId: string) => {
    const found = assignments.find(a => a.id === assignmentId);
    setSelectedAssignmentForSubmit(found || null);
    setAssignDialogOpen(!!found);
  };

  const handleViewScore = (assignmentId: string) => {
    const found = assignments.find(a => a.id === assignmentId);
    setSelectedAssignmentForScore(found || null);
    setScoreDialogOpen(!!found);
  };

  useEffect(() => {
    if (activeSection !== "attendance") {
      if (attendanceRefreshIntervalRef.current) {
        clearInterval(attendanceRefreshIntervalRef.current);
        attendanceRefreshIntervalRef.current = null;
      }
      return;
    }

    fetchAttendanceData(true);

    attendanceRefreshIntervalRef.current = setInterval(() => {
      fetchAttendanceData(false);
    }, 15000);

    return () => {
      if (attendanceRefreshIntervalRef.current) {
        clearInterval(attendanceRefreshIntervalRef.current);
        attendanceRefreshIntervalRef.current = null;
      }
    };
  }, [activeSection, courses, user?._id]);

  // Load student stats for dashboard
  useEffect(() => {
    if (activeSection === "dashboard" && user?._id) {
      const loadStats = async () => {
        setLoadingStats(true);
        try {
          const res = await api.getStudentStats(user._id);
          setStudentStats((res as any)?.data || { enrolledCourses: 0, completedAssignments: 0, pendingAssignments: 0, averageGrade: 0 });
        } catch (e) {
          console.error('Failed to load student stats:', e);
          setStudentStats({ enrolledCourses: 0, completedAssignments: 0, pendingAssignments: 0, averageGrade: 0 });
        } finally {
          setLoadingStats(false);
        }
      };
      loadStats();
    }
  }, [activeSection, user?._id, dashboardRefreshKey]);

  // Load course resources when needed
  const loadCourseResources = async (courseId: string) => {
    if (courseResources[courseId]) return; // Already loaded
    
    try {
      const res = await api.getCourseResources(courseId);
      const resources = (res as any)?.data || [];
      setCourseResources(prev => ({ ...prev, [courseId]: resources }));
    } catch (e) {
      console.error('Failed to load course resources:', e);
      setCourseResources(prev => ({ ...prev, [courseId]: [] }));
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-8">
            <div className="dashboard-section-header">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Student Dashboard</h1>
                <p className="text-muted-foreground">Welcome back! Here's your academic overview.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDashboardRefreshKey((key) => key + 1)} disabled={loadingStats}>
                Refresh
              </Button>
            </div>
            
            <StatsCards studentStats={studentStats} loading={loadingStats} />
            
            <div className="grid lg:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">My Courses</h2>
                  <Button size="sm" className="btn-primary" onClick={() => setActiveSection("courses")}>
                    <Plus className="h-4 w-4 mr-2" />
                    View All
                  </Button>
                </div>
                <div className="space-y-4">
                  {courses.slice(0, 3).map((course) => (
                    <div key={course.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{course.name}</h3>
                          <p className="text-sm text-muted-foreground">Teacher: {course.teacher}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setActiveSection("courses")}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {courses.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No courses enrolled yet
                    </p>
                  )}
                </div>
              </div>

              <div>
                <UpcomingMeetings 
                  userRole="student"
                  limit={5}
                  showCreateButton={false}
                  onViewAll={() => setActiveSection("meetings")}
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Upcoming Deadlines</h2>
                </div>
                <div className="space-y-4">
                  {assignments.filter(a => a.status === "pending").map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onAssignmentClick={handleAssignmentClick}
                      onViewScore={handleViewScore}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
        
      case "courses":
        return <StudentCoursesList />;
        
      case "progress":
        return <StudentProgress />;
        
      case "meetings":
        return <MeetingsList userRole="student" userId={user?._id || user?.id || ""} />;
        
      // Discussions removed - now handled within individual course pages
        
      case "assignments":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center gap-4 p-4 bg-accent/30 rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
              <div className="flex gap-2">
                <Button
                  variant={assignmentFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignmentFilter('pending')}
                  className={`transition-all duration-200 ${
                    assignmentFilter === 'pending' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  Pending Assignments
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-current/20">
                    {assignments.filter(a => a.status === 'pending' || !a.status).length}
                  </span>
                </Button>
                <Button
                  variant={assignmentFilter === 'submitted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignmentFilter('submitted')}
                  className={`transition-all duration-200 ${
                    assignmentFilter === 'submitted' 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  Submitted Assignments
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-current/20">
                    {assignments.filter(a => a.status === 'submitted' || a.status === 'completed').length}
                  </span>
                </Button>
              </div>
            </div>

            {/* Assignment Cards */}
            {filteredAndSortedAssignments.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-accent/20">
                <div className="text-muted-foreground">
                  {assignmentFilter === 'pending' 
                    ? 'No pending assignments at the moment.' 
                    : 'No submitted assignments yet.'}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {assignmentFilter === 'pending' 
                    ? 'Great job staying on top of your work!' 
                    : 'Complete some assignments to see them here.'}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredAndSortedAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onAssignmentClick={handleAssignmentClick}
                    onViewScore={handleViewScore}
                  />
                ))}
              </div>
            )}

// ... (rest of the code remains the same)
            {/* Assignment Count and Sort Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
              <span>
                Showing {filteredAndSortedAssignments.length} {assignmentFilter} assignment{filteredAndSortedAssignments.length !== 1 ? 's' : ''}
              </span>
              <span>
                {assignmentFilter === 'pending' 
                  ? 'Sorted by due date (earliest first)' 
                  : 'Sorted by date (most recent first)'}
              </span>
            </div>
            <Dialog open={assignDialogOpen} onOpenChange={(o) => { setAssignDialogOpen(o); if (!o) { setSelectedAssignmentForSubmit(null); setAssignUploadFile(null); setAssignLink(""); setAssignText(""); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Assignment</DialogTitle>
                  <DialogDescription>{selectedAssignmentForSubmit?.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Upload File</label>
                      <input type="file" onChange={(e) => setAssignUploadFile(e.target.files?.[0] || null)} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Submission Link (optional)</label>
                      <input className="w-full border rounded px-2 py-1" placeholder="https://..." value={assignLink} onChange={(e) => setAssignLink(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Notes (optional)</label>
                    <textarea className="w-full border rounded px-2 py-1" rows={3} value={assignText} onChange={(e) => setAssignText(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                    <Button className="btn-primary" onClick={async () => {
                      try {
                        if (!selectedAssignmentForSubmit) return;
                        if (!assignUploadFile && !assignLink && !assignText) { alert('Please attach a file or add link/notes'); return; }
                        if (assignUploadFile) {
                          await api.uploadAndSubmit({ file: assignUploadFile, type: 'assignment', ref_id: selectedAssignmentForSubmit.id, text: assignText || undefined, link: assignLink || undefined });
                        } else {
                          await api.submitWork({ type: 'assignment', ref_id: selectedAssignmentForSubmit.id, text: assignText || undefined, link: assignLink || undefined });
                        }
                        
                        // Add notification for teacher (stored locally, will be seen by teacher of this course)
                        addNotification({
                          type: 'submission',
                          title: 'New Assignment Submission',
                          message: `${user?.name || 'A student'} submitted "${selectedAssignmentForSubmit.title}"`,
                          relatedId: selectedAssignmentForSubmit.id,
                          relatedName: selectedAssignmentForSubmit.title,
                          studentName: user?.name || user?.email
                        });
                        
                        alert('Assignment submitted');
                        setAssignDialogOpen(false);
                        // Refresh assignments list to show updated status
                        await fetchAssignments();
                        setDashboardRefreshKey((key) => key + 1);
                        // Switch to submitted filter to show the newly submitted assignment
                        setAssignmentFilter('submitted');
                      } catch (e) { alert('Failed to submit'); }
                    }}>Submit</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Score Viewing Dialog */}
            <Dialog open={scoreDialogOpen} onOpenChange={(o) => { setScoreDialogOpen(o); if (!o) { setSelectedAssignmentForScore(null); } }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-600" />
                    Assignment Score
                  </DialogTitle>
                  <DialogDescription>{selectedAssignmentForScore?.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                    <div className="text-3xl font-bold text-green-800 mb-2">
                      {selectedAssignmentForScore?.grade || 0} / {selectedAssignmentForScore?.totalMarks || 0}
                    </div>
                    <div className="text-lg font-semibold text-green-700">
                      {selectedAssignmentForScore?.grade && selectedAssignmentForScore?.totalMarks 
                        ? Math.round((selectedAssignmentForScore.grade / selectedAssignmentForScore.totalMarks) * 100)
                        : 0}%
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      {selectedAssignmentForScore?.grade && selectedAssignmentForScore?.totalMarks 
                        ? (selectedAssignmentForScore.grade / selectedAssignmentForScore.totalMarks) >= 0.6 
                          ? "Great work!" 
                          : "Keep improving!"
                        : "Not graded yet"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Course:</span>
                      <span className="font-medium">{selectedAssignmentForScore?.course}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Due Date:</span>
                      <span className="font-medium">
                        {selectedAssignmentForScore?.dueDate 
                          ? new Date(selectedAssignmentForScore.dueDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="font-medium">
                        {selectedAssignmentForScore?.submissionDate 
                          ? new Date(selectedAssignmentForScore.submissionDate).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  
                  {selectedAssignmentForScore?.remarks && (
                    <div className="p-3 bg-accent/30 rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground mb-1">Teacher's Remarks:</div>
                      <div className="text-sm">{selectedAssignmentForScore.remarks}</div>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setScoreDialogOpen(false)}>Close</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
        
      case "attendance":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
                <p className="text-muted-foreground">Course-wise attendance and overall</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAttendanceData(false)}
                disabled={refreshingAttendance}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingAttendance ? "animate-spin" : ""}`} />
                {refreshingAttendance ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            {loadingAttendance ? (
              <div className="p-6 rounded-lg border text-center text-sm text-muted-foreground">
                Loading attendance data...
              </div>
            ) : (
              <>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">Overall Attendance</span>
                    <span className="text-2xl font-bold">
                      {(() => {
                        const totals = Object.values(attendanceData).reduce(
                          (acc, a) => ({ conducted: acc.conducted + a.conducted, attended: acc.attended + a.attended }),
                          { conducted: 0, attended: 0 }
                        );
                        const overall = totals.conducted ? Math.round((totals.attended / totals.conducted) * 100) : 0;
                        return `${overall}%`;
                      })()}
                    </span>
                  </div>
                  <div className="relative h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const totals = Object.values(attendanceData).reduce(
                              (acc, a) => ({ conducted: acc.conducted + a.conducted, attended: acc.attended + a.attended }),
                              { conducted: 0, attended: 0 }
                            );
                            return [
                              { name: "Attended", value: totals.attended },
                              { name: "Absent", value: Math.max(0, totals.conducted - totals.attended) },
                            ];
                          })()}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={70}
                          outerRadius={90}
                          startAngle={90}
                          endAngle={-270}
                          stroke="transparent"
                        >
                          <Cell key="attended" fill="#22c55e" />
                          <Cell key="absent" fill="#e5e7eb" />
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => [value as number, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {(() => {
                        const totals = Object.values(attendanceData).reduce(
                          (acc, a) => ({ conducted: acc.conducted + a.conducted, attended: acc.attended + a.attended }),
                          { conducted: 0, attended: 0 }
                        );
                        const overall = totals.conducted ? Math.round((totals.attended / totals.conducted) * 100) : 0;
                        return (
                          <div className="text-center">
                            <div className="text-3xl font-bold">{overall}%</div>
                            <div className="text-xs text-muted-foreground">{totals.attended}/{totals.conducted} classes</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Attendance by Course</h2>
                    <span className="text-xs text-muted-foreground">Donut visualization</span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => {
                      const data = attendanceData[course.id] || { conducted: 0, attended: 0 };
                      const absent = Math.max(0, data.conducted - data.attended);
                      const pct = data.conducted ? Math.round((data.attended / data.conducted) * 100) : 0;
                      return (
                        <div key={course.id} className="relative h-48 rounded-md border">
                          <div className="absolute top-2 left-2 text-sm font-medium">{course.name.split(" ")[0]}</div>
                          <div className="absolute inset-0 pt-6">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: "Attended", value: data.attended },
                                    { name: "Absent", value: absent },
                                  ]}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={55}
                                  outerRadius={70}
                                  startAngle={90}
                                  endAngle={-270}
                                  stroke="transparent"
                                >
                                  <Cell key="attended" fill="#6366F1" />
                                  <Cell key="absent" fill="#e5e7eb" />
                                </Pie>
                                <Tooltip formatter={(value: any, name: any) => [value as number, name]} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl font-bold">{pct}%</div>
                                <div className="text-xs text-muted-foreground">{data.attended}/{data.conducted}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <details className="rounded-lg border p-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground">View detailed attendance table</summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-accent/50">
                        <tr>
                          <th className="text-left p-3">Course</th>
                          <th className="text-left p-3">Classes Conducted</th>
                          <th className="text-left p-3">Classes Attended</th>
                          <th className="text-left p-3">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((course) => {
                          const data = attendanceData[course.id] || { conducted: 0, attended: 0 };
                          const pct = data.conducted ? Math.round((data.attended / data.conducted) * 100) : 0;
                          return (
                            <tr key={course.id} className="border-t">
                              <td className="p-3">{course.name}</td>
                              <td className="p-3">{data.conducted}</td>
                              <td className="p-3">{data.attended}</td>
                              <td className="p-3 font-medium">{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>
        );

      case "notices":
        return <NoticeBoard />;

      case "timetable":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">My Timetable</h1>
              <p className="text-muted-foreground">As uploaded by Admin</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border rounded-lg">
                <thead className="bg-accent/50">
                  <tr>
                    <th className="p-2 text-left">Day / Time</th>
                    {periods.map((p) => (
                      <th key={p} className="p-2 text-left">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d} className="border-t">
                      <td className="p-2 font-medium">{d}</td>
                      {periods.map((p) => (
                        <td key={p} className="p-2">
                          <span className="px-2 py-1 rounded-md border inline-block min-w-[80px] text-center">
                            {ttData?.[d]?.[p] || "--"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "tests":
        // If test is active, show ONLY the test page (no list, no statistics)
        if (testActive && currentTest) {
          return (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Test Header with Timer */}
              <div className="flex items-center justify-between p-6 rounded-lg border bg-gradient-to-r from-primary/10 to-primary/5">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">{currentTest.title}</h1>
                  <p className="text-sm text-muted-foreground">
                    {currentTest.description || 'Answer all questions to the best of your ability'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Time Remaining
                    </div>
                    <div className={`text-3xl font-bold tabular-nums ${
                      timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-primary'
                    }`}>
                      {Math.floor(timeLeft/60).toString().padStart(2,'0')}:{(timeLeft%60).toString().padStart(2,'0')}
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to exit the test? Your progress will not be saved.')) {
                        setTestActive(false);
                        setCurrentTest(null);
                        setSelectedAnswers({});
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Exit Test
                  </Button>
                </div>
              </div>

              {/* Test Info Card */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-accent/30">
                  <div className="text-sm text-muted-foreground">Total Questions</div>
                  <div className="text-2xl font-bold text-foreground">{currentTest.questions?.length || 0}</div>
                </div>
                <div className="p-4 rounded-lg border bg-accent/30">
                  <div className="text-sm text-muted-foreground">Total Marks</div>
                  <div className="text-2xl font-bold text-foreground">{currentTest.total_marks || 0}</div>
                </div>
                <div className="p-4 rounded-lg border bg-accent/30">
                  <div className="text-sm text-muted-foreground">Answered</div>
                  <div className="text-2xl font-bold text-primary">
                    {Object.keys(selectedAnswers).length} / {currentTest.questions?.length || 0}
                  </div>
                </div>
              </div>

              {/* Time Warning */}
              {timeLeft < 300 && timeLeft > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                    Warning: Less than 5 minutes remaining!
                  </div>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-6">
                {(currentTest?.questions || []).map((q: any, idx: number) => (
                  <div key={idx} className="p-6 rounded-lg border bg-card shadow-sm">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-foreground mb-1">{q.question}</div>
                        <div className="text-xs text-muted-foreground">Marks: {q.marks || 1}</div>
                      </div>
                      {selectedAnswers[String(idx)] !== undefined && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {(q.options || []).map((opt: string, i: number) => {
                        const isSelected = selectedAnswers[String(idx)] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedAnswers(s => ({ ...s, [String(idx)]: i }))}
                            className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                : 'border-border hover:border-primary/50 hover:bg-accent'
                            }`}
                          >
                            <span className="font-semibold mr-2">{letters[i]}.</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between p-6 rounded-lg border bg-accent/30 sticky bottom-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{Object.keys(selectedAnswers).length}</span> of <span className="font-medium">{currentTest.questions?.length || 0}</span> questions answered
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (confirm('Are you sure you want to exit without submitting?')) {
                        setTestActive(false);
                        setCurrentTest(null);
                        setSelectedAnswers({});
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={submitTest}
                    size="lg"
                    className="btn-success px-8"
                    disabled={Object.keys(selectedAnswers).length === 0}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Submit Test
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // Default view: Show test list and statistics
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Tests</h1>
              <span className="text-sm text-muted-foreground">Select a test below to begin</span>
            </div>
            <div className="space-y-3">
              <div className="font-semibold">Available Tests</div>
              <div className="grid md:grid-cols-2 gap-3">
                {(tests || []).filter((t: any) => !attemptedTestIds.has(t._id || t.id)).map((t: any) => {
                  const totalQ = (t.questions?.length) ?? 0;
                  const dur = t.duration_minutes ?? 60;
                  const deadline = t.scheduled_at ? new Date(new Date(t.scheduled_at).getTime() + (dur * 60000)) : null;
                  return (
                    <div key={t._id || t.id} className="p-4 rounded border space-y-2 hover:shadow-md transition-shadow">
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                      <div className="text-xs text-muted-foreground">Duration: {dur} min • Questions: {totalQ} • Total Marks: {t.total_marks ?? 100}</div>
                      <div className="text-xs text-muted-foreground">Starts: {t.scheduled_at ? new Date(t.scheduled_at).toLocaleString() : '-'}</div>
                      <div className="text-xs text-muted-foreground">Deadline: {deadline ? deadline.toLocaleString() : '-'}</div>
                      <div className="flex justify-end">
                        <Button size="sm" className="btn-primary" onClick={() => startBackendTest(t._id || t.id)}>Start Test</Button>
                      </div>
                    </div>
                  );
                })}
                {((tests || []).filter((t: any) => !attemptedTestIds.has(t._id || t.id)).length === 0) && (
                  <div className="text-sm text-muted-foreground">No available tests.</div>
                )}
              </div>
            </div>
            {testResult && (
              <div className="p-4 rounded-lg border flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Result</div>
                  <div className="text-2xl font-bold">{testResult.score} / {testResult.total}</div>
                </div>
                <Button variant="outline" onClick={() => { setTestResult(null); }}>Close</Button>
              </div>
            )}

            {/* Previous Test Statistics Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Previous Test Statistics
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort by:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'date') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('date');
                        setSortOrder('desc');
                      }
                    }}
                    className={`gap-1 ${sortBy === 'date' ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Calendar className="h-3 w-3" />
                    Date
                    {sortBy === 'date' && (
                      <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'score') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('score');
                        setSortOrder('desc');
                      }
                    }}
                    className={`gap-1 ${sortBy === 'score' ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Trophy className="h-3 w-3" />
                    Score
                    {sortBy === 'score' && (
                      <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                    }}
                    className={`gap-1 ${sortBy === 'name' ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    Name
                    {sortBy === 'name' && (
                      <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                </div>
              </div>

              {loadingTestStats ? (
                <div className="p-8 text-center">
                  <div className="text-muted-foreground">Loading test statistics...</div>
                </div>
              ) : sortedTestStatistics.length === 0 ? (
                <div className="p-8 text-center border rounded-lg">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Test History</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete some tests to see your performance statistics here.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border rounded-lg">
                      <thead className="bg-accent/50">
                        <tr>
                          <th className="text-left p-4 font-semibold">Test Name</th>
                          <th className="text-left p-4 font-semibold">Date</th>
                          <th className="text-left p-4 font-semibold">Score</th>
                          <th className="text-left p-4 font-semibold">Total Marks</th>
                          <th className="text-left p-4 font-semibold">Percentage</th>
                          <th className="text-left p-4 font-semibold">Status</th>
                          <th className="text-left p-4 font-semibold">Course</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTestStatistics.map((stat, index) => (
                          <tr key={stat.id} className={`border-t ${index % 2 === 0 ? 'bg-background' : 'bg-accent/20'}`}>
                            <td className="p-4">
                              <div className="font-medium text-foreground">{stat.testName}</div>
                              {stat.remarks && (
                                <div className="text-xs text-muted-foreground mt-1">{stat.remarks}</div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground">
                                {stat.date ? new Date(stat.date).toLocaleDateString() : 'N/A'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {stat.date ? new Date(stat.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-lg">{stat.score}</div>
                            </td>
                            <td className="p-4">
                              <div className="font-semibold text-lg">{stat.totalMarks}</div>
                            </td>
                            <td className="p-4">
                              <div className={`font-bold text-lg ${
                                stat.percentage >= 80 ? 'text-green-600' :
                                stat.percentage >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {stat.percentage}%
                              </div>
                            </td>
                            <td className="p-4">
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                stat.status === 'Passed' 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {stat.status === 'Passed' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                                {stat.status}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground">{stat.course}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {sortedTestStatistics.map((stat) => (
                      <div key={stat.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{stat.testName}</h3>
                            <p className="text-sm text-muted-foreground">{stat.course}</p>
                          </div>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            stat.status === 'Passed' 
                              ? 'bg-green-100 text-green-800 border border-green-200' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {stat.status === 'Passed' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {stat.status}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Date:</span>
                            <div className="font-medium">
                              {stat.date ? new Date(stat.date).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Score:</span>
                            <div className="font-medium">{stat.score} / {stat.totalMarks}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="text-sm text-muted-foreground">Performance</div>
                          <div className={`font-bold text-lg ${
                            stat.percentage >= 80 ? 'text-green-600' :
                            stat.percentage >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {stat.percentage}%
                          </div>
                        </div>
                        
                        {stat.remarks && (
                          <div className="text-xs text-muted-foreground bg-accent/30 p-2 rounded">
                            {stat.remarks}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Statistics Summary */}
                  {sortedTestStatistics.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Total Tests</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-900">{sortedTestStatistics.length}</div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Passed</span>
                        </div>
                        <div className="text-2xl font-bold text-green-900">
                          {sortedTestStatistics.filter(s => s.status === 'Passed').length}
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">Average Score</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-900">
                          {Math.round(sortedTestStatistics.reduce((sum, s) => sum + s.percentage, 0) / sortedTestStatistics.length)}%
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">Best Score</span>
                        </div>
                        <div className="text-2xl font-bold text-purple-900">
                          {Math.max(...sortedTestStatistics.map(s => s.percentage))}%
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <Dialog open={testDialogOpen} onOpenChange={(o) => { setTestDialogOpen(o); if (!o) { setSelectedTestForSubmit(null); setTestUploadFile(null); setTestLink(""); setTestText(""); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Test</DialogTitle>
                  <DialogDescription>{selectedTestForSubmit?.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Upload File</label>
                      <input type="file" onChange={(e) => setTestUploadFile(e.target.files?.[0] || null)} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Submission Link (optional)</label>
                      <input className="w-full border rounded px-2 py-1" placeholder="https://..." value={testLink} onChange={(e) => setTestLink(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Notes (optional)</label>
                    <textarea className="w-full border rounded px-2 py-1" rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancel</Button>
                    <Button className="btn-primary" onClick={async () => {
                      try {
                        if (!selectedTestForSubmit) return;
                        if (!testUploadFile && !testLink && !testText) { alert('Please attach a file or add link/notes'); return; }
                        if (testUploadFile) {
                          await api.uploadAndSubmit({ file: testUploadFile, type: 'test', ref_id: selectedTestForSubmit.id, text: testText || undefined, link: testLink || undefined });
                        } else {
                          await api.submitWork({ type: 'test', ref_id: selectedTestForSubmit.id, text: testText || undefined, link: testLink || undefined });
                        }
                        
                        // Add notification for teacher
                        addNotification({
                          type: 'submission',
                          title: 'New Test Submission',
                          message: `${user?.name || 'A student'} submitted "${selectedTestForSubmit.title}"`,
                          relatedId: selectedTestForSubmit.id,
                          relatedName: selectedTestForSubmit.title,
                          studentName: user?.name || user?.email
                        });
                        
                        alert('Test submitted');
                        setTestDialogOpen(false);
                        setDashboardRefreshKey((key) => key + 1);
                      } catch (e) { alert('Failed to submit test'); }
                    }}>Submit</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
        
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} section coming soon...
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <RoleBasedHeader />
      <div className="dashboard-shell">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="dashboard-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
