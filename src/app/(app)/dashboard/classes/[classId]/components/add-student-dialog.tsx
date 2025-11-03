"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { User } from "@/lib/types";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";

interface AddStudentDialogProps {
  allStudents: User[];
  classId: string;
}

export function AddStudentDialog({ allStudents, classId }: AddStudentDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedStudentId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a student to enroll.",
      });
      return;
    }
    setLoading(true);

    const studentToEnroll = allStudents.find(s => s.id === selectedStudentId);
    if (!studentToEnroll) {
        toast({ variant: "destructive", title: "Student not found." });
        setLoading(false);
        return;
    }

    const studentData = {
      ...studentToEnroll,
      classId: classId, // Add classId to the student document in the subcollection
    };
    
    const studentDocRef = doc(firestore, 'classes', classId, 'students', selectedStudentId);

    setDoc(studentDocRef, studentData)
      .then(() => {
        toast({
          title: "Student Enrolled",
          description: `${studentToEnroll.name} has been enrolled in the class.`,
        });
        setSelectedStudentId("");
        setOpen(false);
      })
      .catch((error: any) => {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: studentDocRef.path,
            operation: 'create',
            requestResourceData: studentData,
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({
            variant: "destructive",
            title: "Failed to Enroll Student",
            description: error.message,
          });
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus />
          Enroll Student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll Student</DialogTitle>
          <DialogDescription>
            Select a student to enroll them in this class.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleEnrollStudent}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="student" className="text-right">Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a student..." />
                </SelectTrigger>
                <SelectContent>
                  {allStudents.length > 0 ? (
                    allStudents.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground p-4">No students available to enroll.</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !selectedStudentId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enroll Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
