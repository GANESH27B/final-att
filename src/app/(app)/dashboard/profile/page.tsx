
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).optional(),
  email: z.string().email(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
    if (data.newPassword || data.confirmPassword || data.currentPassword) {
      return !!data.currentPassword && !!data.newPassword && !!data.confirmPassword;
    }
    return true;
}, {
    message: "To change your password, you must provide your current password, a new password, and confirm it.",
    path: ["currentPassword"], 
}).refine(data => {
    if (data.newPassword) {
        return data.newPassword === data.confirmPassword;
    }
    return true;
}, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});


type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isPending, setIsPending] = useState(false);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.displayName || "",
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange"
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.displayName || "",
        email: user.email || "",
      });
    }
  }, [user, form]);
  

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user || !auth || !firestore) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in or Firebase not initialized." });
      return;
    }
    setIsPending(true);

    let profileUpdated = false;
    let passwordUpdated = false;
    
    // Create a new avatar URL on every profile update to give the user a way to change it.
    const newAvatarUrl = `https://picsum.photos/seed/${user.uid}/${Date.now()}/40/40`;


    try {
      // Collect updates
      const profileUpdates: { displayName?: string, photoURL?: string } = {};
      const firestoreUpdates: { name?: string, avatarUrl?: string } = {};

      if (data.name && user.displayName !== data.name) {
        profileUpdates.displayName = data.name;
        firestoreUpdates.name = data.name;
        profileUpdated = true;
      }
      
      // We always update the avatar to a new random one on profile save.
      profileUpdates.photoURL = newAvatarUrl;
      firestoreUpdates.avatarUrl = newAvatarUrl;
      
      // Check if there are any actual changes before marking profile as updated.
      if (profileUpdates.displayName || profileUpdates.photoURL) {
        profileUpdated = true;
      }

      if (profileUpdated) {
        await updateProfile(user, profileUpdates);
        
        const userDocRef = doc(firestore, "users", user.uid);
        await setDoc(userDocRef, firestoreUpdates, { merge: true }).catch(error => {
            if (error.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: firestoreUpdates,
                });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError; 
            }
            throw error;
        });
      }

      // Update password if a new one is provided
      if (data.newPassword && data.currentPassword) {
        if (!user.email) {
            toast({ variant: "destructive", title: "Update Failed", description: "Cannot change password without a user email." });
            setIsPending(false);
            return;
        }
        const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, data.newPassword);
        passwordUpdated = true;
      }
      
      if(profileUpdated || passwordUpdated) {
        toast({
            title: "Profile Updated",
            description: "Your information has been successfully updated.",
        });
      } else {
        toast({
            title: "No Changes",
            description: "You haven't made any changes to your profile.",
        });
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsPending(false);
      form.reset({
        ...form.getValues(),
        name: data.name, // Keep the new name in the form
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    }
  };

  const getFallback = () => {
    if (user?.displayName) return user.displayName.substring(0, 2).toUpperCase();
    if (user?.email) return user.email.substring(0, 2).toUpperCase();
    return "AU";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
        <CardDescription>Manage your personal information and password.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
             <FormItem>
                <FormLabel>Profile Photo</FormLabel>
                <FormControl>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={user?.photoURL || undefined} alt="User avatar" />
                            <AvatarFallback>{getFallback()}</AvatarFallback>
                        </Avatar>
                        <FormDescription>
                            Your avatar is updated automatically when you save your profile.
                        </FormDescription>
                    </div>
                </FormControl>
                <FormMessage />
            </FormItem>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Your email" {...field} disabled />
                  </FormControl>
                   <FormDescription>
                    Email address cannot be changed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
                <h3 className="text-sm font-medium">Change Password</h3>
                 <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
