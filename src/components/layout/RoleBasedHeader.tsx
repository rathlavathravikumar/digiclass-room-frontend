import { Search, User, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useNavigate } from "react-router-dom";

const RoleBasedHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getRoleColor = () => {
    switch (user?.role) {
      case 'student':
        return 'bg-primary text-primary-foreground';
      case 'teacher':
        return 'bg-success text-success-foreground';
      case 'admin':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleTitle = () => {
    switch (user?.role) {
      case 'student':
        return user.class_id ? `${user.class_id} Student` : 'Student';
      case 'teacher':
        return user.department ? `${user.department} Faculty` : 'Faculty';
      case 'admin':
        return 'System Administrator';
      default:
        return 'User';
    }
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 min-h-16 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="bg-gradient-hero p-2 rounded-lg">
            <h1 className="text-primary-foreground font-heading font-bold text-sm sm:text-lg whitespace-nowrap">
              Digital Classroom
            </h1>
          </div>
          <Badge className={`${getRoleColor()} hidden xs:inline-flex sm:inline-flex`}>
            {user?.role?.toUpperCase()}
          </Badge>
        </div>

        <div className="order-3 w-full md:order-none md:flex-1 md:max-w-md md:mx-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search courses, assignments, discussions..."
              className="pl-10 bg-muted/50 border-0 focus:bg-background transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <NotificationDropdown />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 px-2 sm:px-3">
                <User className="h-5 w-5" />
                <div className="hidden text-left sm:block">
                  <p className="font-medium text-sm leading-tight">{user?.name}</p>
                  <p className="text-muted-foreground text-xs">{getRoleTitle()}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default RoleBasedHeader;
