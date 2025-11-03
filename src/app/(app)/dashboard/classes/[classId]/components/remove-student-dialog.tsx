"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { User } from "@/lib/types";
import { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";

interface RemoveStudentDialogProps {
    student: User;
    classId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RemoveStudentDialog({ student, classId, open, onOpenChange }: RemoveStudentDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleRemoveStudent = async () => {
    if (!firestore) return;
    setLoading(true);

    const studentInClassRef = doc(firestore, "classes", classId, "students", student.id);

    deleteDoc(studentInClassRef)
        .then(() => {
            toast({
                title: "Student Removed",
                description: `${student.name} has been removed from this class.`,
            });
            onOpenChange(false);
        })
        .catch(error => {
            if (error.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: studentInClassRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            } else {
                toast({
                    variant: "destructive",
                    title: "Failed to Remove Student",
                    description: error.message,
                });
            }
        })
        .finally(() => setLoading(false));
  };


  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <span className="font-semibold">{student.name}</span> from this class. 
            This action does not delete the student's main account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleRemoveStudent} disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove Student
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
