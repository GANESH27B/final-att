
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
import { doc, deleteDoc, writeBatch } from "firebase/firestore";
import { Loader2 } from "lucide-react";


interface DeleteUserDialogProps {
    user: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDeleteUser = async () => {
    if (!firestore) {
        toast({ variant: "destructive", title: "Firebase not initialized" });
        return;
    }
    setLoading(true);

    const userDocRef = doc(firestore, "users", user.id);

    try {
        const batch = writeBatch(firestore);
        batch.delete(userDocRef);

        if (user.role === 'admin') {
            const adminRoleRef = doc(firestore, 'roles_admin', user.id);
            batch.delete(adminRoleRef);
        }
        
        await batch.commit();

        // Note: Deleting a Firebase Auth user requires admin privileges and is typically
        // done from a backend environment (e.g., Cloud Functions), not the client.
        // The user will still exist in Firebase Auth but will be unable to use the app
        // as their user document is gone.

        toast({
            title: "User Deleted",
            description: `${user.name} has been successfully deleted.`,
        });
        onOpenChange(false);
    } catch (error: any) {
         if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                variant: "destructive",
                title: "Failed to Delete User",
                description: error.message,
            });
        }
    } finally {
        setLoading(false);
    }
  };


  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the user account
            for <span className="font-semibold">{user.name}</span> and remove their data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
                 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete User
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
