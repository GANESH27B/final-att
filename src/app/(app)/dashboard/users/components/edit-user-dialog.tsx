
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { User, UserRole } from "@/lib/types";
import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";

interface EditUserDialogProps {
    user: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [registrationNumber, setRegistrationNumber] = useState(user.registrationNumber || "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
        setName(user.name);
        setEmail(user.email);
        setRegistrationNumber(user.registrationNumber || "");
        setRole(user.role);
    }
  }, [open, user]);

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Firebase not initialized",
        });
        return;
    }
    setLoading(true);

    const userDocRef = doc(firestore, "users", user.id);
    const userData = {
        ...user,
        name,
        email,
        role,
        registrationNumber: registrationNumber || null,
    };

    try {
        await setDoc(userDocRef, userData, { merge: true });
        
        // Handle admin role change
        const adminRoleRef = doc(firestore, 'roles_admin', user.id);
        if (role === 'admin' && user.role !== 'admin') {
            await setDoc(adminRoleRef, { role: 'admin' });
        } else if (role !== 'admin' && user.role === 'admin') {
            // Deleting a doc that might not exist is fine
            await setDoc(adminRoleRef, {}, { merge: false }); // or deleteDoc
        }

        toast({
            title: "User Updated",
            description: `${name} has been successfully updated.`,
        });
        onOpenChange(false);
    } catch (error: any) {
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: userData,
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: "destructive",
                title: "Failed to Update User",
                description: error.message,
            });
        }
    } finally {
        setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Modify the details for {user.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleEditUser}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name</Label>
              <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">Email</Label>
              <Input id="edit-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-registrationNumber" className="text-right">Reg. Number</Label>
              <Input id="edit-registrationNumber" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="col-span-3" placeholder="Optional" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Role</Label>
               <RadioGroup 
                value={role}
                onValueChange={(value: UserRole) => setRole(value)}
                className="col-span-3 flex items-center space-x-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="edit-admin" />
                  <Label htmlFor="edit-admin" className="font-normal">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="faculty" id="edit-faculty" />
                  <Label htmlFor="edit-faculty" className="font-normal">Faculty</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="student" id="edit-student" />
                  <Label htmlFor="edit-student" className="font-normal">Student</Label>
                </div>
              </RadioGroup>
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
