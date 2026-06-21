import { useEffect, useState } from "react";
import RoleBasedHeader from "@/components/layout/RoleBasedHeader";
import TeacherSidebar from "@/components/layout/TeacherSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Upload, 
  Users, 
  BookOpen, 
  ClipboardList, 
  TestTube,
  CheckSquare,
  Calendar,
  FileText,
  TrendingUp,
  Video,
  Trash2,
  Bell,
  ChevronDown,
  ChevronUp,
  Eye,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { api } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";
import UpcomingMeetings from "@/components/meetings/UpcomingMeetings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import MeetingForm from "@/components/meetings/MeetingForm";
import MeetingsList from "@/components/meetings/MeetingsList";
import TeacherCoursesList from "@/components/courses/TeacherCoursesList";
import CourseDetailPage from "@/components/courses/CourseDetailPage";
import CourseProgress from "@/components/progress/CourseProgress";
import StudentProgressTracker from "@/components/progress/StudentProgressTracker";



const TeacherDashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedProgressCourseId, setSelectedProgressCourseId] = useState<string | null>(null);
  const [questions, setQuestions] = useState([
    { question: "", options: ["", "", "", ""], correct: "A", marks: 1 },
  ]);

  // Data for Notices / Assignments / Tests
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [notices, setNotices] = useState<any[]>([]);
  const [expandedNotices, setExpandedNotices] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<any | null>(null);
  const [marksEdits, setMarksEdits] = useState<Record<string, number>>({});
  const [tests, setTests] = useState<any[]>([]);
  const [assignmentMarks, setAssignmentMarks] = useState<any[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [testMarks, setTestMarks] = useState<any[]>([]);
  // New state for inline submissions and scores
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [inlineSubmissions, setInlineSubmissions] = useState<Record<string, any[]>>({});
  const [inlineMarksEdits, setInlineMarksEdits] = useState<Record<string, Record<string, number>>>({});
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [inlineTestScores, setInlineTestScores] = useState<Record<string, any[]>>({});
  // Courses for form selects (rename to avoid collision with mock 'courses')
  const [teacherCourses, setTeacherCourses] = useState<any[]>([]);
  // Create Assignment form state
  const [showCreateAssignmentForm, setShowCreateAssignmentForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState<{ course_id: string; title: string; description: string; due_date: string; total_marks: string }>({ course_id: "", title: "", description: "", due_date: "", total_marks: "100" });
  // Create Test form state
  const [showCreateTestPage, setShowCreateTestPage] = useState(false);
  const [newTest, setNewTest] = useState<{ course_id: string; title: string; description: string; scheduled_at: string; duration?: string }>({ course_id: "", title: "", description: "", scheduled_at: "", duration: "" });
  // Meeting dialog state
  const [isCreateMeetingDialogOpen, setIsCreateMeetingDialogOpen] = useState(false);
  // Dashboard stats state
  const [teacherStats, setTeacherStats] = useState<{ activeCourses: number; totalStudents: number; pendingSubmissions: number; testsCreated: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  useEffect(() => {
    if (activeSection === 'notices') {
      (async () => {
        try {
          const res = await api.listPublicNotices({ target: 'teachers' });
          const all = await api.listPublicNotices({ target: 'all' });
          const data = (res as any)?.data || (res as any) || [];
          const dataAll = (all as any)?.data || (all as any) || [];
          setNotices([...(data || []), ...(dataAll || [])]);
        } catch (_) { setNotices([]); }
      })();
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'assignment' && user?._id) {
      (async () => {
        try {
          const res = await api.getAssignments({ teacher_id: user._id });
          const list = (res as any)?.data || (res as any) || [];
          setAssignments(list);
        } catch (_) { setAssignments([]); }
      })();
    }
  }, [activeSection, user?._id, dashboardRefreshKey]);

  // Load courses for selects when landing on assignment/test/attendance sections (load only teacher's courses)
  useEffect(() => {
    if (activeSection === 'assignment' || activeSection === 'test' || activeSection === 'courses' || activeSection === 'dashboard' || activeSection === 'course-plan' || activeSection === 'attendance') {
      (async () => {
        // Set loading state if on dashboard
        if (activeSection === 'dashboard') {
          setLoadingStats(true);
        }
        
        try {
          // Fetch courses, assignments, and tests for statistics
          const [coursesRes, assignmentsRes, testsRes] = await Promise.all([
            api.getCourses({ teacher_id: user?._id }),
            api.getAssignments({ teacher_id: user?._id }),
            api.getTests()
          ]);
          
          const courses = (coursesRes as any)?.data || (coursesRes as any) || [];
          const allAssignments = (assignmentsRes as any)?.data || (assignmentsRes as any) || [];
          const allTests = (testsRes as any)?.data || (testsRes as any) || [];
          
          // For course-plan section, fetch detailed course data including syllabus
          let enrichedCourses;
          if (activeSection === 'course-plan') {
            // Fetch complete course details for each course to get syllabus data
            const detailedCoursesPromises = courses.map(async (course: any) => {
              try {
                const detailedCourseRes = await api.getCourse(course._id || course.id);
                const detailedCourse = (detailedCourseRes as any)?.data || detailedCourseRes || course;
                return detailedCourse;
              } catch (error) {
                console.error(`Failed to fetch details for course ${course._id}:`, error);
                return course; // Fallback to basic course data
              }
            });
            
            const detailedCourses = await Promise.all(detailedCoursesPromises);
            enrichedCourses = detailedCourses;
          } else {
            // Enrich courses with computed statistics for other sections
            enrichedCourses = courses.map((course: any) => {
              // Count students enrolled in the course
              const students_count = course.students?.length || 0;
              
              // Count tests for this course
              const tests_count = allTests.filter((test: any) => 
                test.course_id === course._id || test.course_id?._id === course._id
              ).length;
              
              // Count assignments for this course
              const assignments_count = allAssignments.filter((assignment: any) => 
                assignment.course_id === course._id || assignment.course_id?._id === course._id
              ).length;
              
              // Count pending submissions (assignments without marks)
              const courseAssignments = allAssignments.filter((assignment: any) => 
                assignment.course_id === course._id || assignment.course_id?._id === course._id
              );
              
              return {
                ...course,
                students_count,
                tests_count,
                assignments_count,
                resourceCount: assignments_count, // Using assignments as resources for now
                pendingSubmissions: courseAssignments.length, // Can be enhanced with actual submission data
                schedule: course.schedule || `${course.department || 'General'} - Sem ${course.semester || '1'}`
              };
            });
          }
          
          setTeacherCourses(enrichedCourses);
          
          // Compute dashboard statistics from actual data
          if (activeSection === 'dashboard') {
            const totalStudents = enrichedCourses.reduce((sum: number, course: any) => 
              sum + (course.students_count || 0), 0
            );
            const totalPendingSubmissions = enrichedCourses.reduce((sum: number, course: any) => 
              sum + (course.pendingSubmissions || 0), 0
            );
            const totalTests = allTests.filter((test: any) => 
              test.teacher_id === user?._id || test.teacher_id?._id === user?._id
            ).length;
            
            setTeacherStats({
              activeCourses: enrichedCourses.length,
              totalStudents,
              pendingSubmissions: totalPendingSubmissions,
              testsCreated: totalTests
            });
          }
        } catch (error) { 
          console.error('Error fetching course data:', error);
          setTeacherCourses([]);
          if (activeSection === 'dashboard') {
            setTeacherStats({ activeCourses: 0, totalStudents: 0, pendingSubmissions: 0, testsCreated: 0 });
          }
        } finally {
          // Clear loading state if on dashboard
          if (activeSection === 'dashboard') {
            setLoadingStats(false);
          }
        }
      })();
    }
  }, [activeSection, user?._id]);

  useEffect(() => {
    if (selectedAssignmentId) {
      (async () => {
        try {
          // fetch assignment meta
          const res = await api.getAssignment(selectedAssignmentId);
          const detail = (res as any)?.data || (res as any) || null;
          setAssignmentDetail(detail);
          // fetch marks for this assignment to derive student list
          const marksRes = await api.getMarksByItem('assignment', selectedAssignmentId);
          const items = (marksRes as any)?.data || (marksRes as any) || [];
          setAssignmentMarks(items);
          // fetch submissions for this assignment
          const subsRes = await api.getSubmissionsByItem('assignment', selectedAssignmentId);
          const subs = (subsRes as any)?.data || (subsRes as any) || [];
          setAssignmentSubmissions(subs);
          const m: Record<string, number> = {};
          (items || []).forEach((it: any) => {
            const sid = it.student_id?._id || it.student_id?.id || it.student_id;
            if (typeof it?.score === 'number') m[sid] = it.score;
          });
          setMarksEdits(m);
        } catch (_) {
          setAssignmentDetail(null);
          setAssignmentMarks([]);
          setAssignmentSubmissions([]);
        }
      })();
    } else {
      setAssignmentDetail(null);
      setAssignmentMarks([]);
      setAssignmentSubmissions([]);
      setMarksEdits({});
    }
  }, [selectedAssignmentId]);

  useEffect(() => {
    if (activeSection === 'test') {
      (async () => {
        try {
          const res = await api.getTests();
          const list = (res as any)?.data || (res as any) || [];
          setTests(list);
        } catch (_) { setTests([]); }
      })();
    }
  }, [activeSection]);

  useEffect(() => {
    if (selectedTestId) {
      (async () => {
        try {
          const marksRes = await api.getMarksByItem('test', selectedTestId);
          const items = (marksRes as any)?.data || (marksRes as any) || [];
          setTestMarks(items);
        } catch (_) { setTestMarks([]); }
      })();
    } else {
      setTestMarks([]);
    }
  }, [selectedTestId]);

  // ✅ Handlers for create-test
  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correct: "A", marks: 1 }]);
  };

  const handleQuestionChange = (index, value) => {
    const updated = [...questions];
    updated[index].question = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const handleCorrectChange = (index, value) => {
    const updated = [...questions];
    updated[index].correct = value;
    setQuestions(updated);
  };

  const handleMarksChange = (index, value) => {
    const updated = [...questions];
    updated[index].marks = Number(value) || 0;
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  // Calculate total marks from all questions
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  const teacherStatsCards = [
    {
      title: "Active Courses",
      value: teacherStats?.activeCourses?.toString() || "0",
      change: "This semester",
      icon: BookOpen,
      color: "success"
    },
    {
      title: "Total Students",
      value: teacherStats?.totalStudents?.toString() || "0",
      change: "Across all courses",
      icon: Users,
      color: "primary"
    },
    {
      title: "Pending Submissions",
      value: teacherStats?.pendingSubmissions?.toString() || "0",
      change: "Need grading",
      icon: ClipboardList,
      color: "warning"
    },
    {
      title: "Tests Created",
      value: teacherStats?.testsCreated?.toString() || "0",
      change: "This month",
      icon: TestTube,
      color: "success"
    }
  ];

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [selectedCourseForAttendance, setSelectedCourseForAttendance] = useState<string>("");
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const handleAttendanceChange = (id: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [id]: status }));
  };

  const fetchStudentsForCourse = async (courseId: string) => {
    if (!courseId) {
      setAttendanceStudents([]);
      setAttendance({});
      return;
    }

    setLoadingStudents(true);
    try {
      const res = await api.getCourse(courseId);
      const courseData = (res as any)?.data || {};
      const students = courseData.students || [];
      setAttendanceStudents(students);
      
      // Initialize attendance state for all students as "Present" by default
      const initialAttendance: Record<string, string> = {};
      students.forEach((student: any) => {
        initialAttendance[student._id || student.id] = "Present";
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setAttendanceStudents([]);
      setAttendance({});
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedCourseForAttendance) {
      alert("Please select a course first");
      return;
    }

    if (attendanceStudents.length === 0) {
      alert("No students found for this course");
      return;
    }

    setSavingAttendance(true);
    try {
      // Prepare attendance records
      const records = attendanceStudents.map((student) => ({
        student_id: student._id || student.id,
        status: (attendance[student._id || student.id] || "Present").toLowerCase() as "present" | "absent"
      }));

      await api.markAttendance({
        course_id: selectedCourseForAttendance,
        date: selectedDate,
        records
      });
      setDashboardRefreshKey((key) => key + 1);

      alert(`Attendance saved successfully for ${selectedDate}`);
    } catch (error) {
      console.error("Failed to save attendance:", error);
      alert("Failed to save attendance. Please try again.");
    } finally {
      setSavingAttendance(false);
    }
  };

  // Effect to fetch students when course selection changes
  useEffect(() => {
    if (selectedCourseForAttendance) {
      fetchStudentsForCourse(selectedCourseForAttendance);
    }
  }, [selectedCourseForAttendance]);

  // Functions for inline submissions and scores
  const toggleAssignmentSubmissions = async (assignmentId: string) => {
    const newExpanded = new Set(expandedAssignments);
    
    if (expandedAssignments.has(assignmentId)) {
      // Collapse - remove from expanded set and clear data
      newExpanded.delete(assignmentId);
      const newSubmissions = { ...inlineSubmissions };
      delete newSubmissions[assignmentId];
      setInlineSubmissions(newSubmissions);
    } else {
      // Expand - add to expanded set and fetch data
      newExpanded.add(assignmentId);
      try {
        const [assignmentRes, submissionsRes, marksRes] = await Promise.all([
          api.getAssignment(assignmentId),
          api.getSubmissionsByItem('assignment', assignmentId),
          api.getMarksByItem('assignment', assignmentId)
        ]);
        
        const submissions = (submissionsRes as any)?.data || [];
        setInlineSubmissions(prev => ({ ...prev, [assignmentId]: submissions }));
        
        // Initialize marks edits for this assignment
        const marks = (marksRes as any)?.data || [];
        const marksMap: Record<string, number> = {};
        marks.forEach((m: any) => {
          const studentId = m.student_id?._id || m.student_id?.id || m.student_id;
          if (studentId) marksMap[studentId] = m.score || 0;
        });
        setInlineMarksEdits(prev => ({ ...prev, [assignmentId]: marksMap }));
      } catch (error) {
        console.error('Failed to fetch assignment submissions:', error);
      }
    }
    
    setExpandedAssignments(newExpanded);
  };

  const toggleTestScores = async (testId: string) => {
    const newExpanded = new Set(expandedTests);
    
    if (expandedTests.has(testId)) {
      // Collapse - remove from expanded set and clear data
      newExpanded.delete(testId);
      const newScores = { ...inlineTestScores };
      delete newScores[testId];
      setInlineTestScores(newScores);
    } else {
      // Expand - add to expanded set and fetch data
      newExpanded.add(testId);
      try {
        const marksRes = await api.getMarksByItem('test', testId);
        const scores = (marksRes as any)?.data || [];
        setInlineTestScores(prev => ({ ...prev, [testId]: scores }));
      } catch (error) {
        console.error('Failed to fetch test scores:', error);
      }
    }
    
    setExpandedTests(newExpanded);
  };

  // Discussions are now handled within individual course pages - removed mock data
  
  // Resource state
const [resources, setResources] = useState<
  { id: string; title: string; type: string; url: string; date: string }[]
>([]);

// Upload form states
const [showUploadForm, setShowUploadForm] = useState(false);
const [uploadTitle, setUploadTitle] = useState("");
const [uploadFile, setUploadFile] = useState<File | null>(null);
const [courseResourceTitle, setCourseResourceTitle] = useState("");
const [courseResourceDescription, setCourseResourceDescription] = useState("");
const [courseResourceFile, setCourseResourceFile] = useState<File | null>(null);
const [selectedCourseForUpload, setSelectedCourseForUpload] = useState<string>("");

// Handle upload submit
const handleUploadSubmit = () => {
  if (!uploadFile || !uploadTitle.trim()) {
    alert("Please enter a title and choose a file!");
    return;
  }

  const fileType = uploadFile.name.endsWith(".mp4")
    ? "video"
    : uploadFile.name.endsWith(".pdf")
    ? "pdf"
    : "document";

  const newResource = {
    id: Date.now().toString(),
    title: uploadTitle,
    type: fileType,
    url: URL.createObjectURL(uploadFile),
    date: new Date().toLocaleDateString(),
  };

  setResources((prev) => [newResource, ...prev]);
  setUploadFile(null);
  setUploadTitle("");
  setShowUploadForm(false);
  alert("Resource uploaded successfully!");
};

// Handle course resource upload
const handleCourseResourceUpload = async () => {
  if (!courseResourceFile || !courseResourceTitle.trim()) {
    alert("Please enter a title and choose a file!");
    return;
  }

  if (!selectedCourseForUpload) {
    alert("Please select a course!");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", courseResourceFile);
    formData.append("title", courseResourceTitle);
    formData.append("description", courseResourceDescription);

    await api.uploadCourseResource(selectedCourseForUpload, formData);
    
    setCourseResourceFile(null);
    setCourseResourceTitle("");
    setCourseResourceDescription("");
    setSelectedCourseForUpload("");
    alert("Resource uploaded successfully!");
  } catch (err: any) {
    alert(`Upload failed: ${err.message || "Unknown error"}`);
  }
};

  const renderContent = () => {
    switch (activeSection) {
      case "resources" :
        return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Course Resources</h1>
        {!showUploadForm ? (
          <Button
            className="btn-primary"
            onClick={() => setShowUploadForm(true)}
          >
            Upload Resource
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowUploadForm(false)}
          >
            ← Back to Resources
          </Button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm ? (
        <div className="max-w-xl border rounded-lg p-6 bg-card shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Upload New Resource</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Enter resource title (e.g. DSA Lecture Notes)"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Select File</label>
              <input
                type="file"
                accept=".pdf,.mp4,.docx,.pptx,.txt"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </div>

            <Button
              className="btn-primary w-full"
              onClick={handleUploadSubmit}
            >
              Upload Resource
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {resources.length === 0 ? (
            <p className="text-muted-foreground text-center col-span-full">No resources uploaded yet. Click "Upload Resource" to add new files.</p>
          ) : (
            resources.map((res) => (
              <div
                key={res.id}
                className="border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-semibold text-lg truncate">
                    {res.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {res.type.toUpperCase()} • {res.date}
                  </p>
                </div>

                <div className="mt-3">
                  {res.type === "video" ? (
                    <video
                      src={res.url}
                      controls
                      className="rounded-md w-full mt-2"
                    />
                  ) : (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline"
                    >
                      View / Download Resource
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

      // Discussions removed - now handled within individual course pages

      case "course-plan":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Course Plan</h1>
              <p className="text-muted-foreground">View the plan uploaded by Admin</p>
            </div>
            <div className="space-y-4">
              {teacherCourses.length > 0 ? (
                teacherCourses.map((c: any) => {
                  // Backend stores course_plan as a string
                  const coursePlanText = c.course_plan || "";
                  const hasPlan = coursePlanText.trim().length > 0;
                  
                  // Parse the course plan text into lines for better display
                  const planLines = coursePlanText.split('\n').filter((line: string) => line.trim());
                  
                  return (
                    <Card key={c._id || c.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{c.name || c.title}</span>
                          <Badge variant={hasPlan ? "default" : "secondary"}>
                            {hasPlan ? `${planLines.length} items` : "No plan"}
                          </Badge>
                        </CardTitle>
                        {c.description && (
                          <p className="text-sm text-muted-foreground">{c.description}</p>
                        )}
                        {c.code && (
                          <p className="text-xs text-muted-foreground font-mono">Code: {c.code}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {hasPlan ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-4">
                                <FileText className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-foreground">Course Syllabus</h3>
                              </div>
                              {planLines.map((line: string, index: number) => {
                                // Check if line starts with "Week" to give it special formatting
                                const isWeekHeader = line.trim().toLowerCase().startsWith('week');
                                
                                return (
                                  <div 
                                    key={index} 
                                    className={`p-3 rounded-lg border transition-colors ${
                                      isWeekHeader 
                                        ? 'bg-primary/5 border-primary/20 font-semibold' 
                                        : 'bg-muted/30 hover:bg-muted/50'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {index + 1}
                                      </Badge>
                                      <p className="text-sm leading-relaxed flex-1">{line.trim()}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-sm text-muted-foreground mb-2">No course plan available for this course.</p>
                              <p className="text-xs text-muted-foreground">Contact your admin to upload a course plan.</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No courses assigned yet</p>
                  <p className="text-sm text-muted-foreground">Contact your admin to get assigned to courses.</p>
                </div>
              )}
            </div>
          </div>
        );

      case "dashboard":
        return (
          <div className="min-h-screen bg-gradient-to-br from-background via-muted/5 to-background">
            {/* Enhanced Header Section */}
            <div className="mb-10 px-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <h1 className="text-4xl lg:text-5xl font-heading font-bold text-foreground tracking-tight mb-3">
                    Teacher Dashboard
                  </h1>
                  <p className="text-muted-foreground text-lg font-light">
                    Manage your courses and students efficiently
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => setDashboardRefreshKey((key) => key + 1)} disabled={loadingStats}>
                    Refresh
                  </Button>
                  <div className="px-6 py-3 bg-primary/10 rounded-full border border-primary/20">
                    <span className="text-sm font-semibold text-primary">
                      {loadingStats ? 'Loading...' : `${teacherCourses.length} Active Courses`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Enhanced Stats Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12">
              {teacherStatsCards.map((stat, index) => {
                const Icon = stat.icon;
                
                return (
                  <div 
                    key={index} 
                    className="group relative bg-card border-2 border-border/30 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
                  >
                    {/* Enhanced Background Gradient */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${
                      stat.color === 'success' ? 'bg-gradient-to-br from-success via-success/50 to-success' :
                      stat.color === 'warning' ? 'bg-gradient-to-br from-warning via-warning/50 to-warning' :
                      stat.color === 'primary' ? 'bg-gradient-to-br from-primary via-purple-600 to-primary' : 'bg-gradient-to-br from-muted to-muted'
                    }`} />
                    
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">
                            {stat.title}
                          </p>
                          <p className="text-4xl lg:text-5xl font-heading font-bold text-foreground leading-none">
                            {loadingStats ? (
                              <span className="animate-pulse">...</span>
                            ) : stat.value}
                          </p>
                        </div>
                        <div className={`p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ${
                          stat.color === 'success' ? 'bg-gradient-to-br from-success/20 to-success/10 text-success' :
                          stat.color === 'warning' ? 'bg-gradient-to-br from-warning/20 to-warning/10 text-warning' :
                          stat.color === 'primary' ? 'bg-gradient-to-br from-primary/20 to-purple-600/10 text-primary' : 'bg-muted/20 text-muted-foreground'
                        }`}>
                          <Icon className="h-7 w-7" strokeWidth={2} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-4 border-t border-border/30">
                        <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                          stat.color === 'success' ? 'bg-success' :
                          stat.color === 'warning' ? 'bg-warning' :
                          stat.color === 'primary' ? 'bg-primary' : 'bg-muted-foreground'
                        }`} />
                        <span className="text-sm text-muted-foreground font-medium">
                          {stat.change}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Enhanced My Courses Section */}
              <div className="lg:col-span-5">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <BookOpen className="h-6 w-6 text-primary" strokeWidth={2} />
                    </div>
                    My Courses
                  </h2>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setActiveSection('courses')}
                    className="text-sm font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all rounded-xl px-4 py-2"
                  >
                    View All →
                  </Button>
                </div>
                <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {teacherCourses.length > 0 ? (
                    teacherCourses.map((course: any) => (
                      <div 
                        key={course._id || course.id} 
                        className="group relative bg-card border-2 border-border/30 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 overflow-hidden"
                      >
                        {/* Card Hover Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div className="relative z-10">
                          <div className="flex items-start justify-between mb-5">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-heading font-bold text-foreground mb-3 truncate group-hover:text-primary transition-colors">
                                {course.name || course.title}
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2 font-medium">
                                  <div className="p-1.5 bg-primary/10 rounded-lg">
                                    <Users className="h-4 w-4 text-primary" />
                                  </div>
                                  {course.students_count || course.studentCount || 0} students
                                </span>
                                <span className="flex items-center gap-2 font-medium">
                                  <div className="p-1.5 bg-purple-500/10 rounded-lg">
                                    <TestTube className="h-4 w-4 text-purple-600" />
                                  </div>
                                  {course.tests_count || 0} tests
                                </span>
                                <span className="flex items-center gap-2 font-medium">
                                  <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                  </div>
                                  {course.resourceCount || 0} resources
                                </span>
                              </div>
                            </div>
                            <Badge className="status-due shrink-0 ml-4 px-3 py-1.5 text-sm font-semibold">
                              {course.pendingSubmissions || 0} pending
                            </Badge> 
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-border/30">
                            <span className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                              <Calendar className="h-4 w-4" />
                              {course.schedule || 'No schedule'}
                            </span>
                            <Button 
                              size="sm" 
                              className="btn-gradient h-10 px-6 text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                              onClick={() => {
                                setSelectedCourseId(course._id || course.id);
                                setActiveSection('courses');
                              }}
                            >
                              View Course →
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No courses available yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Meetings Section */}
              <div className="lg:col-span-4">
                <div className="h-full">
                  <UpcomingMeetings 
                    userRole="teacher"
                    limit={4}
                    showCreateButton={true}
                    onCreateMeeting={() => setIsCreateMeetingDialogOpen(true)}
                    onViewAll={() => setActiveSection("meetings")}
                  />
                </div>
              </div>

              {/* Quick Actions Section */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Quick Actions
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    className="group h-20 flex-col gap-2 bg-gradient-to-br from-success/10 to-success/5 border border-success/20 text-success hover:from-success/20 hover:to-success/10 hover:border-success/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => setActiveSection("upload")}
                  >
                    <Upload className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Upload Resource</span>
                  </Button>
                  <Button 
                    className="group h-20 flex-col gap-2 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-primary hover:from-primary/20 hover:to-primary/10 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => setActiveSection("assignment")}
                  >
                    <ClipboardList className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Assignment</span>
                  </Button>
                  <Button 
                    className="group h-20 flex-col gap-2 bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 text-warning hover:from-warning/20 hover:to-warning/10 hover:border-warning/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => setActiveSection("test")}
                  >
                    <TestTube className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Create Test</span>
                  </Button>
                  <Button 
                    className="group h-20 flex-col gap-2 bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 text-accent-foreground hover:from-accent/20 hover:to-accent/10 hover:border-accent/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                    onClick={() => setActiveSection("meetings")}
                  >
                    <Video className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-medium">Meetings</span>
                  </Button>
                </div>
                
                {/* Additional Quick Stats */}
                <div className="mt-6 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl border border-border/50">
                  <h3 className="text-sm font-medium text-foreground mb-3">Today's Overview</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">{teacherCourses.length}</div>
                      <div className="text-muted-foreground">Active Courses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-success">{teacherStats?.totalStudents || 0}</div>
                      <div className="text-muted-foreground">Total Students</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

case "attendance" :
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Mark Attendance</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
        />
      </div>

      {/* Course Selection */}
      <div className="bg-card p-4 rounded-lg border">
        <Label htmlFor="courseSelect" className="text-sm font-medium mb-2 block">
          Select Course *
        </Label>
        <select
          id="courseSelect"
          className="w-full p-3 border rounded-lg bg-background"
          value={selectedCourseForAttendance}
          onChange={(e) => setSelectedCourseForAttendance(e.target.value)}
        >
          <option value="">Choose a course to mark attendance...</option>
          {teacherCourses.map((course: any) => (
            <option key={course._id || course.id} value={course._id || course.id}>
              {course.name || course.title} ({course.code || 'No Code'})
            </option>
          ))}
        </select>
        {!selectedCourseForAttendance && (
          <p className="text-sm text-muted-foreground mt-1">
            Please select a course to view and mark attendance for students
          </p>
        )}
      </div>

      {/* Students Table */}
      {selectedCourseForAttendance && (
        <div className="bg-card rounded-lg border">
          {loadingStudents ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Loading students...</p>
            </div>
          ) : attendanceStudents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                No students enrolled in this course
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold">
                  Students ({attendanceStudents.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  Mark attendance for {selectedDate}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Student ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Student Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceStudents.map((student) => {
                      const studentId = student._id || student.id;
                      return (
                        <tr key={studentId} className="hover:bg-muted/40 border-b">
                          <td className="px-4 py-3 text-sm">{student.clg_id || studentId}</td>
                          <td className="px-4 py-3 text-sm font-medium">{student.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{student.email}</td>
                          <td className="px-4 py-3">
                            <select
                              value={attendance[studentId] || "Present"}
                              onChange={(e) => handleAttendanceChange(studentId, e.target.value)}
                              className="border rounded-md px-3 py-1 text-sm bg-background"
                            >
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Save Button */}
      {selectedCourseForAttendance && attendanceStudents.length > 0 && (
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedCourseForAttendance("");
              setAttendanceStudents([]);
              setAttendance({});
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveAttendance} 
            className="btn-primary"
            disabled={savingAttendance}
          >
            {savingAttendance ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      )}
    </div>
  );
case "upload":
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Upload Resources</h1>
            <Card>
              <CardHeader>
                <CardTitle>Add Learning Material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="course">Course</Label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={selectedCourseForUpload}
                      onChange={(e) => setSelectedCourseForUpload(e.target.value)}
                    >
                      <option value="">Select a course...</option>
                      {teacherCourses.length > 0 ? (
                        teacherCourses.map((course: any) => (
                          <option key={course._id || course.id} value={course._id || course.id}>
                            {course.name || course.title}
                          </option>
                        ))
                      ) : (
                        <option disabled>No courses available</option>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="Enter resource title"
                    value={courseResourceTitle}
                    onChange={(e) => setCourseResourceTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe the resource"
                    value={courseResourceDescription}
                    onChange={(e) => setCourseResourceDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="file">Upload File</Label>
                  <Input 
                    id="file" 
                    type="file" 
                    onChange={(e) => setCourseResourceFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button className="btn-success" onClick={handleCourseResourceUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Resource
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case "notices":
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Notices</h1>
            <Card>
              <CardHeader>
                <CardTitle>Admin Notices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(notices || []).map((n: any) => {
                  const isExpanded = expandedNotices.has(n._id || (n.title + n.createdAt));
                  const shouldTruncate = n.content && n.content.length > 200;
                  
                  return (
                    <div key={n._id || (n.title + n.createdAt)} className="p-4 border rounded-md">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="font-semibold">{n.title}</div>
                            {n.priority === 'urgent' && (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Urgent</Badge>
                            )}
                            {n.priority === 'important' && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Important</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {(n.priority || '').toUpperCase()} • {n.target} • Created: {n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}
                          </div>
                          <div className="text-sm">
                            {shouldTruncate && !isExpanded ? (
                              <p className="whitespace-pre-wrap break-words">
                                {n.content.substring(0, 200)}...
                              </p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">
                                {n.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2">
                        {shouldTruncate && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs"
                            onClick={() => {
                              const newExpanded = new Set(expandedNotices);
                              const noticeKey = n._id || (n.title + n.createdAt);
                              if (isExpanded) {
                                newExpanded.delete(noticeKey);
                              } else {
                                newExpanded.add(noticeKey);
                              }
                              setExpandedNotices(newExpanded);
                            }}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Show Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Read More
                              </>
                            )}
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              View Full
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center space-x-2">
                                <span>{n.title}</span>
                                {n.priority === 'urgent' && (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Urgent</Badge>
                                )}
                                {n.priority === 'important' && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Important</Badge>
                                )}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <Bell className="h-4 w-4" />
                                  <span>{n.target === 'students' ? 'For Students' : n.target === 'teachers' ? 'For Teachers' : 'For All'}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                                </div>
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap break-words text-foreground leading-relaxed">
                                  {n.content}
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
                {(notices || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No notices.</div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "assignment":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
              <Button 
                className="btn-primary"
                onClick={() => setShowCreateAssignmentForm(!showCreateAssignmentForm)}
              >
                {showCreateAssignmentForm ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Hide Form
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Assignment
                  </>
                )}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>My Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(assignments || []).map((a: any) => {
                  const assignmentId = a._id || a.id;
                  const isExpanded = expandedAssignments.has(assignmentId);
                  const submissions = inlineSubmissions[assignmentId] || [];
                  const marksForAssignment = inlineMarksEdits[assignmentId] || {};
                  
                  return (
                    <div key={assignmentId} className="border rounded-lg">
                      {/* Assignment Header */}
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{a.title || a.name || 'Assignment'}</div>
                          <div className="text-xs text-muted-foreground">Total Marks: {a.total_marks ?? a.total ?? '--'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant={isExpanded ? "secondary" : "default"}
                            onClick={() => toggleAssignmentSubmissions(assignmentId)}
                          >
                            {isExpanded ? 'Hide Submissions' : 'View Submissions'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete "${a.title || 'this assignment'}"? This action cannot be undone.`)) {
                                try {
                                  await api.deleteAssignment(assignmentId);
                                  // Refresh assignments list
                                  if (user?._id) {
                                    const res = await api.getAssignments({ teacher_id: user._id });
                                  const list = (res as any)?.data || (res as any) || [];
                                  setAssignments(list);
                                  }
                                  setDashboardRefreshKey((key) => key + 1);
                                  alert('Assignment deleted successfully');
                                } catch (error) {
                                  console.error('Failed to delete assignment:', error);
                                  alert('Failed to delete assignment');
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Inline Submissions */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20">
                          <div className="p-4">
                            <h4 className="font-medium mb-3 text-sm">Submissions ({submissions.length})</h4>
                            {submissions.length > 0 ? (
                              <div className="space-y-3">
                                {submissions.map((s: any) => {
                                  const sid = s.student_id?._id || s.student_id?.id || s.student_id;
                                  const scoreVal = marksForAssignment[sid] ?? '';
                                  return (
                                    <div key={s._id || sid} className="p-3 bg-background border rounded-md flex items-center justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">{s.student_id?.name || 'Student'}</div>
                                        <div className="text-xs text-muted-foreground">{s.student_id?.email || ''}</div>
                                        {s?.file_url && (
                                          <a className="text-xs text-blue-600 hover:underline" href={s.file_url} target="_blank" rel="noreferrer">📎 View submission</a>
                                        )}
                                        {s?.link && (
                                          <a className="block text-xs text-blue-600 hover:underline" href={s.link} target="_blank" rel="noreferrer">🔗 External link</a>
                                        )}
                                        {s?.text && (
                                          <div className="text-xs text-muted-foreground mt-1 truncate">{s.text}</div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="number"
                                          className="w-20 h-8"
                                          value={scoreVal}
                                          onChange={(e) => {
                                            const newValue = Number(e.target.value);
                                            setInlineMarksEdits(prev => ({
                                              ...prev,
                                              [assignmentId]: {
                                                ...prev[assignmentId],
                                                [sid]: newValue
                                              }
                                            }));
                                          }}
                                          placeholder="Score"
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8"
                                          onClick={async () => {
                                            try {
                                              const maxScore = (a.total_marks as number) || 100;
                                              const scoreValNum = Number(marksForAssignment[sid]);
                                              if (!Number.isFinite(scoreValNum)) { alert('Enter a valid score'); return; }
                                              await api.upsertMarks({
                                                type: 'assignment',
                                                ref_id: assignmentId,
                                                student_id: sid,
                                                score: scoreValNum,
                                                max_score: maxScore,
                                                remarks: '',
                                                course_id: a.course_id || undefined,
                                              });
                                              setDashboardRefreshKey((key) => key + 1);
                                              alert('Marks saved successfully!');
                                            } catch (e) { alert('Failed to save marks'); }
                                          }}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                No submissions yet for this assignment
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(assignments || []).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">No assignments found.</div>
                )}
              </CardContent>
            </Card>
            
            {/* Create Assignment Form - Toggle Visibility */}
            {showCreateAssignmentForm && (
              <Card id="create-assignment-form">
                <CardHeader>
                  <CardTitle>New Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="course">Course</Label>
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={newAssignment.course_id}
                      onChange={(e) => setNewAssignment({ ...newAssignment, course_id: e.target.value })}
                    >
                      <option value="">Select course</option>
                      {teacherCourses.map((c: any) => (
                        <option key={c._id || c.id} value={c._id || c.id}>{c.name || c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="marks">Total Marks</Label>
                    <Input 
                      id="marks" 
                      type="number" 
                      placeholder="100" 
                      value={newAssignment.total_marks}
                      onChange={(e) => setNewAssignment({ ...newAssignment, total_marks: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="title">Assignment Title</Label>
                  <Input id="title" placeholder="Enter assignment title" value={newAssignment.title} onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Assignment instructions and requirements" value={newAssignment.description} onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input id="dueDate" type="date" value={newAssignment.due_date} onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="submissionType">Submission Type</Label>
                    <select className="w-full p-2 border rounded-lg">
                      <option>File Upload</option>
                      <option>Text Submission</option>
                      <option>Link Submission</option>
                    </select>
                  </div>
                </div>
                <Button className="btn-primary" onClick={async () => {
                  if (!newAssignment.title || !newAssignment.due_date || !newAssignment.course_id) { alert('Please fill course, title and due date'); return; }
                  try {
                    await api.createAssignment({
                      title: newAssignment.title,
                      description: newAssignment.description,
                      due_date: newAssignment.due_date,
                      course_id: newAssignment.course_id,
                      total_marks: Number(newAssignment.total_marks) || 100,
                    });
                    
                    // Find course name for notification
                    const selectedCourse = teacherCourses.find(c => c._id === newAssignment.course_id);
                    
                    // Add notification for students (they will see this when they login)
                    addNotification({
                      type: 'assignment',
                      title: 'New Assignment Posted',
                      message: `New assignment "${newAssignment.title}" has been posted${selectedCourse ? ` in ${selectedCourse.name}` : ''}`,
                      relatedId: newAssignment.course_id,
                      relatedName: newAssignment.title
                    });
                    
                    setNewAssignment({ course_id: '', title: '', description: '', due_date: '', total_marks: '100' });
                    // Hide form after successful creation
                    setShowCreateAssignmentForm(false);
                    // refresh list
                    if (user?._id) {
                      const res = await api.getAssignments({ teacher_id: user._id });
                      const list = (res as any)?.data || (res as any) || [];
                      setAssignments(list);
                    }
                    setDashboardRefreshKey((key) => key + 1);
                    alert('Assignment created');
                  } catch (e) {
                    alert('Failed to create assignment');
                  }
                }}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Create Assignment
                </Button>
              </CardContent>
            </Card>
            )}
          </div>
        );

    case "test":
        // If in create mode, show only the create form page
        if (showCreateTestPage) {
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Create New Test</h1>
                  <p className="text-muted-foreground mt-2">Add questions and configure test settings</p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowCreateTestPage(false);
                    // Reset form
                    setNewTest({ course_id: '', title: '', description: '', scheduled_at: '', duration: '' });
                    setQuestions([{ question: "", options: ["", "", "", ""], correct: "A", marks: 1 }]);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel & Back to Tests
                </Button>
              </div>
              <Card id="create-test-form">
                <CardHeader>
                  <CardTitle>Test Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Test Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Course</Label>
                      <select className="w-full p-2 border rounded-lg" value={newTest.course_id} onChange={(e) => setNewTest({ ...newTest, course_id: e.target.value })}>
                        <option value="">Select course</option>
                        {teacherCourses.map((c: any) => (
                          <option key={c._id || c.id} value={c._id || c.id}>{c.name || c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Duration (minutes)</Label>
                      <Input type="number" placeholder="60" value={newTest.duration} onChange={(e) => setNewTest({ ...newTest, duration: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label>Schedule (date & time)</Label>
                    <Input type="datetime-local" value={newTest.scheduled_at} onChange={(e) => setNewTest({ ...newTest, scheduled_at: e.target.value })} />
                  </div>

                  <div>
                    <Label>Test Title</Label>
                    <Input placeholder="Enter test title" value={newTest.title} onChange={(e) => setNewTest({ ...newTest, title: e.target.value })} />
                  </div>

                  <div>
                    <Label>Instructions</Label>
                    <Textarea placeholder="Test instructions for students" value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} />
                  </div>

                  {/* Questions */}
                  <div className="space-y-6">
                    <Label className="text-lg font-semibold">Questions</Label>
                    {questions.map((q, index) => (
                      <div key={index} className="border p-4 rounded-lg bg-muted/30 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-semibold">Question {index + 1}</h3>
                          {questions.length > 1 && (
                            <Button variant="destructive" size="sm" onClick={() => removeQuestion(index)}>
                              Remove
                            </Button>
                          )}
                        </div>

                        <Input
                          placeholder={`Enter question ${index + 1}`}
                          value={q.question}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          {["A", "B", "C", "D"].map((label, optIndex) => (
                            <Input
                              key={optIndex}
                              placeholder={`Option ${label}`}
                              value={q.options[optIndex]}
                              onChange={(e) => handleOptionChange(index, optIndex, e.target.value)}
                            />
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Correct Answer</Label>
                            <select
                              className="w-full p-2 border rounded-lg"
                              value={q.correct}
                              onChange={(e) => handleCorrectChange(index, e.target.value)}
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                            </select>
                          </div>
                          <div>
                            <Label>Marks</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="1"
                              value={q.marks || 1}
                              onChange={(e) => handleMarksChange(index, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="h-4 w-4 mr-2" />Add Question
                    </Button>
                    
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Marks:</span>
                        <span className="text-2xl font-bold text-primary">{totalMarks}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="btn-success flex-1"
                      onClick={async () => {
                        try {
                          if (!newTest.course_id || !newTest.title || !newTest.scheduled_at) {
                            alert('Please select a course, enter a title, and set schedule');
                            return;
                          }
                          const iso = new Date(newTest.scheduled_at).toISOString();
                          await api.createTest({
                            title: newTest.title,
                            description: newTest.description || '',
                            scheduled_at: iso,
                            course_id: newTest.course_id,
                            // @ts-ignore - backend accepts extra fields
                            duration_minutes: Number(newTest.duration) || 60,
                            // @ts-ignore - backend accepts this array
                            questions: questions.map((q: any) => ({ 
                              question: q.question, 
                              options: q.options, 
                              correct: q.correct, 
                              marks: q.marks || 1 
                            })),
                          } as any);
                          
                          // Find course name for notification
                          const selectedCourse = teacherCourses.find(c => c._id === newTest.course_id);
                          
                          // Add notification for students
                          addNotification({
                            type: 'test',
                            title: 'New Test Scheduled',
                            message: `New test "${newTest.title}" has been scheduled${selectedCourse ? ` for ${selectedCourse.name}` : ''}`,
                            relatedId: newTest.course_id,
                            relatedName: newTest.title
                          });
                          
                          // refresh tests list
                          const res = await api.getTests();
                          const list = (res as any)?.data || (res as any) || [];
                          setTests(list);
                          setDashboardRefreshKey((key) => key + 1);
                          // reset form
                          setNewTest({ course_id: '', title: '', description: '', scheduled_at: '', duration: '' });
                          setQuestions([{ question: "", options: ["", "", "", ""], correct: "A", marks: 1 }]);
                          // Return to test list view
                          setShowCreateTestPage(false);
                          alert('Test created successfully!');
                        } catch (e) {
                          alert('Failed to create test');
                        }
                      }}
                    >
                      <TestTube className="h-4 w-4 mr-2" />Create Test
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateTestPage(false);
                        setNewTest({ course_id: '', title: '', description: '', scheduled_at: '', duration: '' });
                        setQuestions([{ question: "", options: ["", "", "", ""], correct: "A", marks: 1 }]);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }
        
        // Default view: Show test list
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Tests</h1>
              <Button 
                className="btn-primary"
                onClick={() => setShowCreateTestPage(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Test
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>My Tests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(tests || []).map((t: any) => {
                  const testId = t._id || t.id;
                  const isExpanded = expandedTests.has(testId);
                  const scores = inlineTestScores[testId] || [];
                  
                  return (
                    <div key={testId} className="border rounded-lg">
                      {/* Test Header */}
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{t.title || t.name || 'Test'}</div>
                          <div className="text-xs text-muted-foreground">
                            Duration: {t.duration_minutes ?? '--'} min • Total Marks: {t.total_marks ?? 0}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant={isExpanded ? "secondary" : "default"}
                            onClick={() => toggleTestScores(testId)}
                          >
                            {isExpanded ? 'Hide Scores' : 'View Scores'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete "${t.title || 'this test'}"? This action cannot be undone.`)) {
                                try {
                                  await api.deleteTest(testId);
                                  // Refresh tests list
                                  const res = await api.getTests();
                                  const list = (res as any)?.data || (res as any) || [];
                                  setTests(list);
                                  setDashboardRefreshKey((key) => key + 1);
                                  alert('Test deleted successfully');
                                } catch (error) {
                                  console.error('Failed to delete test:', error);
                                  alert('Failed to delete test');
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Inline Scores */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20">
                          <div className="p-4">
                            <h4 className="font-medium mb-3 text-sm">Test Scores ({scores.length})</h4>
                            {scores.length > 0 ? (
                              <div className="space-y-3">
                                {scores.map((score: any) => (
                                  <div key={score._id} className="p-3 bg-background border rounded-md flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium truncate">{score.student_id?.name || 'Student'}</div>
                                      <div className="text-xs text-muted-foreground">{score.student_id?.email || ''}</div>
                                      {score.remarks && (
                                        <div className="text-xs text-muted-foreground mt-1">{score.remarks}</div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold">{score.score ?? 0} / {score.max_score ?? 0}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {score.max_score > 0 ? Math.round((score.score / score.max_score) * 100) : 0}%
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                No scores available for this test
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(tests || []).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">No tests found.</div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case "courses":
        if (selectedCourseId) {
          return (
            <div>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedCourseId(null)}
                className="mb-4"
              >
                ← Back to Courses
              </Button>
              <CourseDetailPage courseId={selectedCourseId} />
            </div>
          );
        }
        return <TeacherCoursesList onCourseSelect={setSelectedCourseId} />;

      case "progress":
        if (selectedProgressCourseId) {
          return (
            <div>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedProgressCourseId(null)}
                className="mb-4"
              >
                ← Back to Course Selection
              </Button>
              <CourseProgress courseId={selectedProgressCourseId} />
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Student Progress</h1>
            <p className="text-muted-foreground">Select a course to view detailed student progress</p>
            <TeacherCoursesList onCourseSelect={setSelectedProgressCourseId} />
          </div>
        );

      case "meetings":
        return <MeetingsList userRole="teacher" userId={user?._id || user?.id || ""} />;

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

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    // Reset progress course selection when leaving progress section
    if (section !== "progress") {
      setSelectedProgressCourseId(null);
    }
    // Reset main course selection when leaving courses section
    if (section !== "courses") {
      setSelectedCourseId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <RoleBasedHeader />
      <div className="dashboard-shell">
        <TeacherSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
        <main className="dashboard-main">
          {renderContent()}
        </main>
      </div>

      {/* Meeting Creation Dialog */}
      <Dialog open={isCreateMeetingDialogOpen} onOpenChange={setIsCreateMeetingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule New Meeting</DialogTitle>
            <DialogDescription>
              Create a new online meeting for your course. Students will be able to join when the meeting starts.
            </DialogDescription>
          </DialogHeader>
          <MeetingForm 
            onSuccess={() => setIsCreateMeetingDialogOpen(false)}
            onCancel={() => setIsCreateMeetingDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDashboard;
