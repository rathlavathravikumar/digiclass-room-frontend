import { 
  BookOpen, 
  ClipboardList, 
  MessageCircle, 
  PieChart, 
  FileText,
  Users,
  TestTube,
  CheckSquare,
  Bell,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeacherSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigation = [
  { name: "Dashboard", icon: PieChart, id: "dashboard" },
  { name: "My Courses", icon: BookOpen, id: "courses" },
  { name: "Meetings", icon: Video, id: "meetings" },
  { name: "Assignment", icon: ClipboardList, id: "assignment" },
  { name: "Test", icon: TestTube, id: "test" },
  { name: "Manage Attendance", icon: CheckSquare, id: "attendance" },
  { name: "Course Plan", icon: FileText, id: "course-plan" },
  { name: "Student Progress", icon: Users, id: "progress" },
  { name: "Notices", icon: Bell, id: "notices" },
];

const TeacherSidebar = ({ activeSection, onSectionChange }: TeacherSidebarProps) => {
  return (
    <aside className="w-full lg:w-64 bg-card/95 backdrop-blur border-b lg:border-b-0 lg:border-r border-border lg:h-[calc(100vh-4rem)] overflow-x-auto lg:overflow-y-auto">
      <nav className="flex gap-2 p-3 lg:block lg:p-4 lg:space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.name}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex shrink-0 items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all lg:w-full",
                isActive
                  ? "bg-success text-success-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default TeacherSidebar;
