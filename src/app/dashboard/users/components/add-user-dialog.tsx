
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase";
import { UserRole } from "@/lib/types";
import { useState } from "react";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { firebaseConfig } from "@/firebase/config";

export function AddUserDialog() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Firebase not initialized",
            description: "The application is not connected to Firebase services.",
        });
        return;
    }
    setLoading(true);

    // Create a temporary, secondary Firebase app for user creation
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const user = userCredential.user;

      const userData = {
        name,
        email,
        role,
        registrationNumber: registrationNumber || null,
        avatarUrl: `https://picsum.photos/seed/${user.uid}/40/40`,
        status: "Active",
      };
      
      const userDocRef = doc(firestore, "users", user.uid);

      if (role === 'admin') {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        await setDoc(adminRoleRef, { role: 'admin' });
      }

      await setDoc(userDocRef, userData);
      
      toast({
        title: "User Created",
        description: `${name} has been successfully added.`,
      });

      // Reset form and close dialog
      setName("");
      setEmail("");
      setPassword("");
      setRegistrationNumber("");
      setRole("student");
      setOpen(false);

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        // This assumes the createUserWithEmailAndPassword succeeded but Firestore failed.
        const uid = tempAuth.currentUser?.uid || "new-user-uid-placeholder";
        const userDocRef = doc(firestore, "users", uid);
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: { name, email, role, registrationNumber },
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({
            variant: "destructive",
            title: "Failed to Add User",
            description: error.message,
        });
      }
    } finally {
      // IMPORTANT: Clean up the temporary app instance
      await deleteApp(tempApp);
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Enter the details to create a new user account. An initial password can be set, which the user can change later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddUser}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="col-span-3" required />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="registrationNumber" className="text-right">Reg. Number</Label>
              <Input id="registrationNumber" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} className="col-span-3" placeholder="Optional" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="col-span-3" required minLength={6} />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Role</Label>
               <RadioGroup 
                value={role}
                onValueChange={(value: UserRole) => setRole(value)}
                className="col-span-3 flex items-center space-x-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="font-normal">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="faculty" id="faculty" />
                  <Label htmlFor="faculty" className="font-normal">Faculty</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="student" id="student" />
                  <Label htmlFor="student" className="font-normal">Student</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
