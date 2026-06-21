import { useEffect, useState } from "react";
import RoleBasedHeader from "@/components/layout/RoleBasedHeader";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Users, 
  BookOpen, 
  Bell, 
  Calendar,
  BarChart3,
  Settings,
  UserPlus,
  Trash2,
  Edit
} from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AdminCourseList from "@/components/courses/AdminCourseList";
import AdminCourseForm from "@/components/courses/AdminCourseForm";
import AdminCourseDetail from "@/components/courses/AdminCourseDetail";
import AdminProgressDashboard from "@/components/progress/AdminProgressDashboard";
import { toast } from "sonner";

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [userFilter, setUserFilter] = useState<"all" | "teacher" | "student">("all");
  const [teachersData, setTeachersData] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [openAddTeacher, setOpenAddTeacher] = useState(false);
  const [openAddStudent, setOpenAddStudent] = useState(false);
  const [formTeacher, setFormTeacher] = useState({ name: "", email: "", password: "", clg_id: "" });
  const [formStudent, setFormStudent] = useState({ name: "", email: "", password: "", clg_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  // Notices state
  const [notices, setNotices] = useState<any[]>([]);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'students' | 'teachers'>('all');
  const [openCreateNotice, setOpenCreateNotice] = useState(false);
  const [noticeForm, setNoticeForm] = useState<{ title: string; content: string; priority: 'normal' | 'important' | 'urgent'; target: 'all' | 'students' | 'teachers' }>({ title: '', content: '', priority: 'normal', target: 'all' });
  // Dashboard stats state
  const [dashboardStats, setDashboardStats] = useState<{ totalStudents: number; totalTeachers: number; totalCourses: number; totalNotices: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  const displayUsers = ((): any[] => {
    if (userFilter === "teacher") return teachersData.map(t => ({ ...t, role: "teacher" }));
    if (userFilter === "student") return studentsData.map(s => ({ ...s, role: "student" }));
    // merge both
    return [
      ...teachersData.map(t => ({ ...t, role: "teacher" })),
      ...studentsData.map(s => ({ ...s, role: "student" })),
    ];
  })();

  const refreshUsers = async () => {
    try {
      if (userFilter === "teacher") {
        const res = await adminApi.listUsers("teacher");
        setTeachersData((res as any)?.data?.users || []);
      } else if (userFilter === "student") {
        const res = await adminApi.listUsers("student");
        setStudentsData((res as any)?.data?.users || []);
      } else {
        const res = await adminApi.listUsers();
        setTeachersData((res as any)?.data?.teachers || []);
        setStudentsData((res as any)?.data?.students || []);
      }
    } catch (e) {
      // noop
    }
  };

  useEffect(() => {
    if (activeSection === "users") {
      refreshUsers();
    }
  }, [activeSection]);

  useEffect(() => {
    const loadNotices = async () => {
      try {
        const res = await adminApi.listNotices(noticeFilter !== 'all' ? { target: noticeFilter } as any : undefined);
        setNotices((res as any)?.data || (res as any) || []);
      } catch (_) {
        // noop
      }
    };
    if (activeSection === 'notices') loadNotices();
  }, [activeSection, noticeFilter]);

  useEffect(() => {
    if (activeSection === "users") {
      refreshUsers();
    }
  }, [userFilter]);

  // Load dashboard stats
  useEffect(() => {
    if (activeSection === "dashboard") {
      const loadStats = async () => {
        setLoadingStats(true);
        try {
          const res = await api.getAdminStats();
          setDashboardStats((res as any)?.data || { totalStudents: 0, totalTeachers: 0, totalCourses: 0, totalNotices: 0 });
          const usersRes = await adminApi.listUsers();
          setTeachersData((usersRes as any)?.data?.teachers || []);
          setStudentsData((usersRes as any)?.data?.students || []);
        } catch (e) {
          console.error('Failed to load admin stats:', e);
          setDashboardStats({ totalStudents: 0, totalTeachers: 0, totalCourses: 0, totalNotices: 0 });
        } finally {
          setLoadingStats(false);
        }
      };
      loadStats();
    }
  }, [activeSection, dashboardRefreshKey]);

  // Load recent courses for dashboard
  useEffect(() => {
    if (activeSection === "dashboard") {
      const loadRecentCourses = async () => {
        try {
          const res = await adminApi.listCourses();
          const courses = (res as any)?.data || [];
          setRecentCourses(courses.slice(0, 3)); // Show only first 3 for dashboard
        } catch (e) {
          setRecentCourses([]);
        }
      };
      loadRecentCourses();
    }
  }, [activeSection, dashboardRefreshKey]);

  const adminStats = [
    {
      title: "Total Students",
      value: dashboardStats?.totalStudents?.toString() || "0",
      change: "Enrolled students",
      icon: Users,
      color: "primary"
    },
    {
      title: "Active Teachers",
      value: dashboardStats?.totalTeachers?.toString() || "0",
      change: "Teaching staff",
      icon: UserPlus,
      color: "success"
    },
    {
      title: "Active Courses",
      value: dashboardStats?.totalCourses?.toString() || "0",
      change: "Across all departments",
      icon: BookOpen,
      color: "warning"
    },
    {
      title: "System Notices",
      value: dashboardStats?.totalNotices?.toString() || "0",
      change: "Active announcements",
      icon: Bell,
      color: "success"
    }
  ];

  // Recent users will be fetched from displayUsers function
  const [recentCourses, setRecentCourses] = useState<any[]>([]);

  // Mock course plans (by courseId)
  const coursePlans: Record<string, { week: number; topic: string; resources?: string; assessment?: string }[]> = {
    "1": [
      { week: 1, topic: "Algorithm Analysis & Big-O", resources: "Slides, Book Ch.1", assessment: "Quiz" },
      { week: 2, topic: "Stacks & Queues", resources: "Lab sheet", assessment: "Assignment 1" },
    ],
    "2": [
      { week: 1, topic: "Relational Model & Keys", resources: "Slides", assessment: "Quiz" },
      { week: 2, topic: "SQL Basics", resources: "Practice sheet", assessment: "Assignment 1" },
    ],
    "3": [
      { week: 1, topic: "OSI Model", resources: "Slides", assessment: "Quiz" },
      { week: 2, topic: "Transport Layer", resources: "Book Ch.3", assessment: "Assignment 1" },
    ],
  };

  // Timetable data
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const periods = ["9:00", "10:00", "11:00", "1:00", "2:00"];
  const initialTimetable: Record<string, Record<string, string>> = {
    Mon: { "9:00": "DSA", "10:00": "DBMS", "11:00": "CN", "1:00": "--", "2:00": "--" },
    Tue: { "9:00": "DBMS", "10:00": "CN", "11:00": "--", "1:00": "DSA", "2:00": "--" },
    Wed: { "9:00": "CN", "10:00": "--", "11:00": "DSA", "1:00": "--", "2:00": "DBMS" },
    Thu: { "9:00": "--", "10:00": "DSA", "11:00": "DBMS", "1:00": "--", "2:00": "CN" },
    Fri: { "9:00": "DBMS", "10:00": "--", "11:00": "--", "1:00": "CN", "2:00": "DSA" },
  } as any;
  const [ttData, setTtData] = useState<Record<string, Record<string, string>>>(initialTimetable);
  const [isEditingTimetable, setIsEditingTimetable] = useState(false);
  const [ttSaving, setTtSaving] = useState(false);

  const saveCell = async (day: string, period: string, value: string) => {
    const nextData = {
      ...ttData,
      [day]: { ...(ttData?.[day] || {}), [period]: value || "--" },
    } as Record<string, Record<string, string>>;
    setTtSaving(true);
    try {
      await adminApi.setTimetable({ data: nextData });
      setTtData(nextData);
      setDashboardRefreshKey((key) => key + 1);
      toast.success('Timetable updated');
    } catch (_) {
      toast.error('Failed to save timetable');
    } finally {
      setTtSaving(false);
    }
  };

  useEffect(() => {
    const loadTt = async () => {
      try {
        const res = await adminApi.getTimetable();
        const data = (res as any)?.data || (res as any) || {};
        if (data && typeof data === 'object') setTtData(data as any);
      } catch (_) {
        // noop
      }
    };
    if (activeSection === 'timetable') {
      loadTt();
    }
  }, [activeSection]);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <div className="space-y-8">
            <div className="dashboard-section-header">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-muted-foreground">System overview and management</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDashboardRefreshKey((key) => key + 1)} disabled={loadingStats}>
                Refresh
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
              {adminStats.map((stat, index) => {
                const Icon = stat.icon;
                
                return (
                  <div key={index} className="stat-card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold text-foreground">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        stat.color === 'success' ? 'bg-success-light' :
                        stat.color === 'warning' ? 'bg-warning-light' :
                        stat.color === 'primary' ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        <Icon className={`h-6 w-6 ${
                          stat.color === 'success' ? 'text-success' :
                          stat.color === 'warning' ? 'text-warning' :
                          stat.color === 'primary' ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-sm text-muted-foreground">
                        {stat.change}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Recent User Activity</h2>
                  <Button size="sm" onClick={() => setActiveSection("users")}>
                    View All
                  </Button>
                </div>
                <div className="space-y-3">
                  {displayUsers.slice(0, 4).map((user) => (
                    <div key={user._id || user.id} className="card-academic p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={user.role === 'student' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}>
                          {user.role === 'student' ? 'Student' : 'Teacher'}
                        </Badge>
                        <Badge className="status-present">
                          Active
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {displayUsers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      {loadingStats ? "Loading users..." : "No users found"}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    className="h-20 flex-col"
                    onClick={() => setActiveSection("create-course")}
                  >
                    <Plus className="h-6 w-6 mb-2" />
                    Create Course
                  </Button>
                  <Button 
                    className="h-20 flex-col"
                    onClick={() => setActiveSection("users")}
                  >
                    <UserPlus className="h-6 w-6 mb-2" />
                    Add User
                  </Button>
                  <Button 
                    className="h-20 flex-col"
                    onClick={() => setActiveSection("notices")}
                  >
                    <Bell className="h-6 w-6 mb-2" />
                    Post Notice
                  </Button>
                  <Button 
                    className="h-20 flex-col"
                    onClick={() => setActiveSection("timetable")}
                  >
                    <Calendar className="h-6 w-6 mb-2" />
                    Manage Schedule
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "courses":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Course Management</h1>
              <Button className="btn-primary" onClick={() => { setEditingCourse(null); setActiveSection("create-course"); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            </div>
            <AdminCourseList
              onView={(id) => { setSelectedCourseId(id); setActiveSection("course-detail"); }}
              onEdit={(course) => { setEditingCourse(course); setActiveSection("edit-course"); }}
              onCreate={() => { setEditingCourse(null); setActiveSection("create-course"); }}
              onChanged={() => setDashboardRefreshKey((key) => key + 1)}
            />
          </div>
        );

      case "progress":
        return <AdminProgressDashboard />;

      case "timetable":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Timetable Management</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Configure Slots
                </Button>
                <Button onClick={() => setIsEditingTimetable((v) => !v)} className={isEditingTimetable ? "btn-primary" : undefined}>
                  {isEditingTimetable ? "Done Editing" : "Edit Timetable"}
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Timetable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
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
                            <td key={p} className="p-1">
                            <div className="p-2 rounded-md border">
                              {isEditingTimetable ? (
                                <Input
                                  value={ttData?.[d]?.[p] || ""}
                                  placeholder="--"
                                  className="h-8"
                                  onChange={(e) =>
                                    setTtData((prev) => ({
                                      ...prev,
                                      [d]: { ...(prev?.[d] || {}), [p]: e.target.value },
                                    }))
                                  }
                                  onBlur={(e) => saveCell(d, p, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  disabled={ttSaving}
                                />
                              ) : (
                                <span>{ttData?.[d]?.[p] || "--"}</span>
                              )}
                            </div>
                          </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "users":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">User Management</h1>
              <div className="flex items-center gap-2">
                <Dialog open={openAddTeacher} onOpenChange={setOpenAddTeacher}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" /> Add Instructor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Instructor</DialogTitle>
                      <DialogDescription>Enter instructor details below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2">
                        <Label htmlFor="tname">Name</Label>
                        <Input id="tname" value={formTeacher.name} onChange={(e) => setFormTeacher({ ...formTeacher, name: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="temail">Email</Label>
                        <Input id="temail" type="email" placeholder="name@eduemail.com" value={formTeacher.email} onChange={(e) => setFormTeacher({ ...formTeacher, email: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tpass">Temporary Password</Label>
                        <Input id="tpass" type="password" value={formTeacher.password} onChange={(e) => setFormTeacher({ ...formTeacher, password: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="tclgid">College ID</Label>
                        <Input id="tclgid" placeholder="Enter college ID" value={formTeacher.clg_id} onChange={(e) => setFormTeacher({ ...formTeacher, clg_id: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenAddTeacher(false)}>Cancel</Button>
                      <Button disabled={submitting} onClick={async () => {
                        if (!formTeacher.name || !formTeacher.email || !formTeacher.password) return;
                        setSubmitting(true);
                        await adminApi.createTeacher(formTeacher as any);
                        setSubmitting(false);
                        setOpenAddTeacher(false);
                        setFormTeacher({ name: "", email: "", password: "", clg_id: "" });
                        await refreshUsers();
                        setDashboardRefreshKey((key) => key + 1);
                      }}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={openAddStudent} onOpenChange={setOpenAddStudent}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <UserPlus className="h-4 w-4 mr-2" /> Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Student</DialogTitle>
                      <DialogDescription>Enter student details below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2">
                        <Label htmlFor="sname">Name</Label>
                        <Input id="sname" value={formStudent.name} onChange={(e) => setFormStudent({ ...formStudent, name: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="semail">Email</Label>
                        <Input id="semail" type="email" placeholder="name@eduemail.com" value={formStudent.email} onChange={(e) => setFormStudent({ ...formStudent, email: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="spass">Temporary Password</Label>
                        <Input id="spass" type="password" value={formStudent.password} onChange={(e) => setFormStudent({ ...formStudent, password: e.target.value })} />
                      </div>
                      {/* Class ID removed */}
                      <div className="grid gap-2">
                        <Label htmlFor="sclgid">College ID</Label>
                        <Input id="sclgid" placeholder="Enter college ID" value={formStudent.clg_id} onChange={(e) => setFormStudent({ ...formStudent, clg_id: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenAddStudent(false)}>Cancel</Button>
                      <Button disabled={submitting} onClick={async () => {
                        if (!formStudent.name || !formStudent.email || !formStudent.password || !formStudent.clg_id) return;
                        setSubmitting(true);
                        await adminApi.createStudent(formStudent as any);
                        setSubmitting(false);
                        setOpenAddStudent(false);
                        setFormStudent({ name: "", email: "", password: "", clg_id: "" });
                        await refreshUsers();
                        setDashboardRefreshKey((key) => key + 1);
                      }}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Users</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter</span>
                    <Select value={userFilter} onValueChange={(v) => setUserFilter(v as any)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="teacher">Instructors</SelectItem>
                        <SelectItem value="student">Students</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {displayUsers.map((u: any) => (
                    <div key={u._id || u.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div>
                            <p className="font-medium">{u.name}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                          {u.role && (
                            <Badge className={u.role === 'student' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}>
                              {u.role === 'student' ? 'Student' : 'Teacher'}
                            </Badge>
                          )}
                          {u.clg_id && (
                            <span className="text-sm text-muted-foreground">College ID: {u.clg_id}</span>
                          )}
                          {/* Class removed */}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete ${u.name}? This action cannot be undone.`)) {
                              try {
                                await adminApi.deleteUser(u._id || u.id, u.role);
                                await refreshUsers();
                                setDashboardRefreshKey((key) => key + 1);
                                toast.success(`${u.role === 'student' ? 'Student' : 'Teacher'} deleted successfully`);
                              } catch (error) {
                                console.error('Failed to delete user:', error);
                                toast.error('Failed to delete user');
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {displayUsers.length === 0 && (
                    <div className="text-sm text-muted-foreground">No users found for this filter.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "create-course":
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Create New Course</h1>
            <AdminCourseForm mode="create" onSuccess={() => { setDashboardRefreshKey((key) => key + 1); setActiveSection("courses"); }} />
          </div>
        );

      case "edit-course":
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Edit Course</h1>
            <AdminCourseForm mode="edit" initialData={editingCourse} onSuccess={() => { setDashboardRefreshKey((key) => key + 1); setActiveSection("courses"); }} />
          </div>
        );

      case "course-detail":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Course Detail</h1>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setActiveSection("courses")}>Back</Button>
                <Button onClick={() => setActiveSection("edit-course")}>Edit</Button>
              </div>
            </div>
            {selectedCourseId ? (
              <AdminCourseDetail id={selectedCourseId} />
            ) : (
              <div className="text-sm text-muted-foreground">Select a course from the list.</div>
            )}
          </div>
        );

      case "notices":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Notice Management</h1>
              <Dialog open={openCreateNotice} onOpenChange={setOpenCreateNotice}>
                <DialogTrigger asChild>
                  <Button className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Notice
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Notice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ntitle">Title</Label>
                      <Input id="ntitle" value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="ncontent">Content</Label>
                      <Textarea id="ncontent" value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} rows={4} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Priority</Label>
                        <Select value={noticeForm.priority} onValueChange={(v) => setNoticeForm({ ...noticeForm, priority: v as any })}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="important">Important</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Target</Label>
                        <Select value={noticeForm.target} onValueChange={(v) => setNoticeForm({ ...noticeForm, target: v as any })}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Target" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="students">Students</SelectItem>
                            <SelectItem value="teachers">Teachers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenCreateNotice(false)}>Cancel</Button>
                    <Button onClick={async () => {
                      if (!noticeForm.title || !noticeForm.content) {
                        toast.error('Please fill in all required fields');
                        return;
                      }
                      try {
                        console.log('Creating notice with form data:', noticeForm);
                        const result = await adminApi.createNotice(noticeForm);
                        console.log('Notice creation result:', result);
                        setOpenCreateNotice(false);
                        setNoticeForm({ title: '', content: '', priority: 'normal', target: 'all' });
                        const res = await adminApi.listNotices(noticeFilter !== 'all' ? { target: noticeFilter } as any : undefined);
                        setNotices((res as any)?.data || (res as any) || []);
                        setDashboardRefreshKey((key) => key + 1);
                        toast.success('Notice created successfully');
                      } catch (error) { 
                        console.error('Failed to create notice:', error);
                        toast.error(`Failed to create notice: ${error.response?.data?.message || error.message || 'Unknown error'}`);
                      }
                    }}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Notices</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Filter by Target</span>
                    <Select value={noticeFilter} onValueChange={(v) => setNoticeFilter(v as any)}>
                      <SelectTrigger className="w-44"><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="students">Students</SelectItem>
                        <SelectItem value="teachers">Teachers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notices.map((n) => (
                    <div key={n._id} className="p-4 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-sm text-muted-foreground">{n.priority?.toUpperCase()} • {n.target}</div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          <div>Created: {n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}</div>
                          <div>Updated: {n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '-'}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">{n.content}</div>
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" className="text-destructive" onClick={async () => {
                          try { await adminApi.deleteNotice(n._id); setNotices(notices.filter(x => x._id !== n._id)); setDashboardRefreshKey((key) => key + 1); toast.success('Deleted'); } catch (_) { toast.error('Failed to delete'); }
                        }}>Delete</Button>
                      </div>
                    </div>
                  ))}
                  {notices.length === 0 && (
                    <div className="text-sm text-muted-foreground">No notices found.</div>
                  )}
                </div>
              </CardContent>
            </Card>
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
        <AdminSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="dashboard-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
