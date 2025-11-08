'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface RemoveStudentDialogProps {
  student: User;
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveStudentDialog({ student, classId, open, onOpenChange }: RemoveStudentDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleRemove = async () => {
    if (!firestore || !student) return;

    setIsPending(true);
    try {
        const batch = writeBatch(firestore);

        // Remove student from the class's subcollection
        const studentInClassRef = doc(firestore, `classes/${classId}/students`, student.id);
        batch.delete(studentInClassRef);
        
        await batch.commit();

        toast({
            title: 'Student Removed',
            description: `${student.name} has been removed from the class.`,
        });
        onOpenChange(false);
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const studentInClassRef = doc(firestore, `classes/${classId}/students`, student.id);
            const permissionError = new FirestorePermissionError({
                path: studentInClassRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: 'destructive',
                title: 'Removal Failed',
                description: error.message || 'Could not remove student.',
            });
        }
    } finally {
        setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will remove <strong>{student?.name}</strong> from this class. 
            This will not delete the student's account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin mr-2" />}
              Remove Student
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
