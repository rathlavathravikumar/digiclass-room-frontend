import { TrendingUp, TrendingDown, Clock, Target, BookOpen, CheckSquare } from "lucide-react";

interface StatsCardsProps {
  studentStats?: {
    enrolledCourses: number;
    completedAssignments: number;
    pendingAssignments: number;
    averageGrade: number;
  } | null;
  loading?: boolean;
}

const StatsCards = ({ studentStats, loading = false }: StatsCardsProps) => {
  const stats = [
    {
      title: "Enrolled Courses",
      value: loading ? "..." : (studentStats?.enrolledCourses?.toString() || "0"),
      change: "Active courses",
      trend: "up",
      icon: BookOpen,
      color: "primary"
    },
    {
      title: "Average Grade",
      value: loading ? "..." : `${studentStats?.averageGrade || 0}%`,
      change: "Overall performance",
      trend: "up", 
      icon: Target,
      color: "success"
    },
    {
      title: "Pending Assignments",
      value: loading ? "..." : (studentStats?.pendingAssignments?.toString() || "0"),
      change: "Need completion",
      trend: "down",
      icon: TrendingDown,
      color: "warning"
    },
    {
      title: "Completed Assignments",
      value: loading ? "..." : (studentStats?.completedAssignments?.toString() || "0"),
      change: "Submitted work",
      trend: "up",
      icon: CheckSquare,
      color: "success"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const isPositive = stat.trend === "up";
        
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
            <div className="mt-4 flex items-center">
              <span className="text-sm text-muted-foreground">
                {stat.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;
