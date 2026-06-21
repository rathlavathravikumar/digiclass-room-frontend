import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Eye, Trash2, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

interface AdminCourseListProps {
  onView: (id: string) => void;
  onEdit: (course: any) => void;
  onCreate: () => void;
  onChanged?: () => void;
}

const AdminCourseList = ({ onView, onEdit, onCreate, onChanged }: AdminCourseListProps) => {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ id?: string; name?: string } | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["courses"],
    queryFn: () => adminApi.listCourses(),
  });

  const list: any[] = Array.isArray(data?.data)
    ? (data?.data as any[])
    : (data?.data?.courses || data?.courses || []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((c: any) =>
      [c.name, c.code, c?.teacher?.name]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(term))
    );
  }, [list, q]);

  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteCourse(id),
    onSuccess: () => {
      toast.success("Course deleted");
      qc.invalidateQueries({ queryKey: ["courses"] });
      onChanged?.();
    },
    onError: () => toast.error("Failed to delete course"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Courses</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name, code, teacher"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" /> New Course
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading courses...</div>
        ) : isError ? (
          <div className="text-sm text-destructive">Failed to load courses.</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No courses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any, idx: number) => (
                  <TableRow key={c._id || c.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.code}</TableCell>
                    <TableCell>{c?.teacher?.name || "--"}</TableCell>
                    <TableCell>{c?.students?.length ?? c.students_count ?? "--"}</TableCell>
                    <TableCell>
                      {c?.course_plan ? (
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {String(c.course_plan).slice(0, 30)}{String(c.course_plan).length > 30 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="status-present">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onView(c._id || c.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => setConfirm({ id: c._id || c.id, name: c.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete course</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{confirm?.name}"? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={del.isPending}
                onClick={async () => {
                  if (!confirm?.id) return;
                  await del.mutateAsync(confirm.id);
                  setConfirm(null);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AdminCourseList;
