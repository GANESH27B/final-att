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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { User } from "@/lib/types";
import { useState } from "react";
import { collection, addDoc, serverTimestamp, doc, runTransaction } from "firebase/firestore";

interface AddClassDialogProps {
    faculty: User[];
}

export function AddClassDialog({ faculty }: AddClassDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser(); // Use useUser to get the currently logged-in user

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in to create a class.",
        });
        return;
    }
    setLoading(true);

    // If an admin is creating a class, they can choose a faculty member.
    // If a faculty member is creating, it defaults to their own ID.
    const assignedFacultyId = facultyId || user.uid;

    const classData = {
      name,
      section,
      facultyId: assignedFacultyId,
      createdAt: serverTimestamp(),
    };

    // The document is created in two places: 
    // 1. Under the faculty's user profile for ownership tracking.
    // 2. In a root-level 'classes' collection for easier querying by students/admins.
    const facultyClassesCollectionRef = collection(firestore, 'users', assignedFacultyId, 'classes');
    const rootClassesCollectionRef = collection(firestore, 'classes');

    try {
        await runTransaction(firestore, async (transaction) => {
            // Create the class document in the root collection
            const newClassRef = doc(rootClassesCollectionRef);
            transaction.set(newClassRef, classData);

            // Create a mirrored document under the faculty's subcollection for ownership/listing
            const facultyClassRef = doc(facultyClassesCollectionRef, newClassRef.id);
            transaction.set(facultyClassRef, classData);
        });

        toast({
            title: "Class Created",
            description: `${name} - Section ${section} has been successfully created.`,
        });

        // Reset form and close dialog
        setName("");
        setSection("");
        setFacultyId("");
        setOpen(false);

    } catch (error: any) {
        if (error.code === 'permission-denied') {
          // Emitting a general error as the transaction involves multiple paths
          const permissionError = new FirestorePermissionError({
              path: `users/${assignedFacultyId}/classes and /classes`,
              operation: 'create',
              requestResourceData: classData,
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          toast({
              variant: "destructive",
              title: "Failed to Create Class",
              description: error.message,
          });
        }
    } finally {
        setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle />
          Add Class
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Enter the details for the new class and assign it to a faculty member.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddClass}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required placeholder="e.g. Computer Science 101" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="section" className="text-right">Section</Label>
              <Input id="section" value={section} onChange={e => setSection(e.target.value)} className="col-span-3" required placeholder="e.g. A" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="faculty" className="text-right">Faculty</Label>
                <Select value={facultyId} onValueChange={setFacultyId}>
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a faculty member (defaults to you)" />
                    </SelectTrigger>
                    <SelectContent>
                        {faculty.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Class
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
