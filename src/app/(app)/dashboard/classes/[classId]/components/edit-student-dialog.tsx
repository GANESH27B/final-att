"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { User } from "@/lib/types";
import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";

interface EditStudentDialogProps {
    student: User;
    classId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditStudentDialog({ student, classId, open, onOpenChange }: EditStudentDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [name, setName] = useState(student.name);
  const [registrationNumber, setRegistrationNumber] = useState(student.registrationNumber || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
        setName(student.name);
        setRegistrationNumber(student.registrationNumber || "");
    }
  }, [open, student]);

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);
    
    // We update the student record in the class's subcollection
    const studentInClassRef = doc(firestore, "classes", classId, "students", student.id);
    const studentData = {
        name,
        registrationNumber: registrationNumber || null,
    };

    setDoc(studentInClassRef, studentData, { merge: true })
      .then(() => {
        toast({
            title: "Student Updated",
            description: `${name}'s details have been updated for this class.`,
        });
        onOpenChange(false);
      })
      .catch(error => {
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: studentInClassRef.path,
                operation: 'update',
                requestResourceData: studentData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: "destructive",
                title: "Failed to Update Student",
                description: error.message,
            });
        }
      })
      .finally(() => setLoading(false));
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Student in Class</DialogTitle>
          <DialogDescription>
            Modify details for <span className="font-semibold">{student.name}</span> in this class.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleEditStudent}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-reg-num" className="text-right">Reg. Number</Label>
              <Input id="edit-reg-num" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="col-span-3" placeholder="e.g. A1234567" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Email</Label>
              <div className="col-span-3">
                  <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <div className="col-span-3">
                 <Badge variant={student.status === 'Active' ? 'secondary' : 'destructive'}>
                    {student.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
