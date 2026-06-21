import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar, 
  Bell, 
  Settings,
  UserPlus,
  FileText,
  BarChart3,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { name: "User Management", icon: Users, id: "users" },
  { name: "Course Management", icon: BookOpen, id: "courses" },
  { name: "Course Progress", icon: BarChart3, id: "progress" },
  { name: "Create Courses", icon: UserPlus, id: "create-course" },
  { name: "Timetable Management", icon: Calendar, id: "timetable" },
  { name: "Notice Management", icon: Bell, id: "notices" },
];

const AdminSidebar = ({ activeSection, onSectionChange }: AdminSidebarProps) => {
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
                  ? "bg-warning text-warning-foreground shadow-md"
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

export default AdminSidebar;
