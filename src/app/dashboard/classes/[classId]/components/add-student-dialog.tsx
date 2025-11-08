'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/lib/types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

const formSchema = z.object({
  studentId: z.string().min(1, 'Please select a student to enroll.'),
});

type FormValues = z.infer<typeof formSchema>;

interface AddStudentDialogProps {
  allStudents: User[];
  classId: string;
}

export function AddStudentDialog({ allStudents, classId }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!firestore || !classId) return;

    setIsPending(true);
    try {
      const studentToEnroll = allStudents.find(s => s.id === values.studentId);
      if (!studentToEnroll) {
        throw new Error("Selected student not found.");
      }
      
      const batch = writeBatch(firestore);

      // Add student to the class's subcollection
      const studentInClassRef = doc(firestore, `classes/${classId}/students`, studentToEnroll.id);
      const studentDataForClass = {
        ...studentToEnroll,
        classId: classId,
        studentId: studentToEnroll.id // Add studentId for querying
      };
      batch.set(studentInClassRef, studentDataForClass);

      await batch.commit();

      toast({
        title: 'Student Enrolled',
        description: `${studentToEnroll.name} has been enrolled in the class.`,
      });

      setOpen(false);
      form.reset();
    } catch (error: any) {
       if (error.code === 'permission-denied') {
          const studentToEnroll = allStudents.find(s => s.id === values.studentId);
          const studentInClassRef = doc(firestore, `classes/${classId}/students`, values.studentId);
          const permissionError = new FirestorePermissionError({ 
            path: studentInClassRef.path, 
            operation: 'create', 
            requestResourceData: { ...studentToEnroll, classId }
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: 'destructive',
                title: 'Enrollment Failed',
                description: error.message || 'Could not enroll student.',
            });
        }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Enroll Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enroll Student</DialogTitle>
          <DialogDescription>
            Select a student from the list to add them to this class.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allStudents.length > 0 ? (
                        allStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No students available to enroll
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending || allStudents.length === 0}>
                {isPending && <Loader2 className="animate-spin mr-2" />}
                Enroll Student
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
