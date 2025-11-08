
"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { AddUserDialog } from "./components/add-user-dialog";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { User } from "@/lib/types";
import { collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserManagementPage() {
  const firestore = useFirestore();
  const usersCollection = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading } = useCollection<User>(usersCollection);

  const students = users?.filter((user) => user.role === 'student') || [];
  const faculty = users?.filter((user) => user.role === 'faculty') || [];
  const admins = users?.filter((user) => user.role === 'admin') || [];

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Add, edit, and manage faculty and student accounts.
          </CardDescription>
        </div>
        <AddUserDialog />
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="students">
          <TabsList className="grid w-full grid-cols-3 md:max-w-[480px]">
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="faculty">Faculty</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
          </TabsList>
          {isLoading ? (
            <div className="mt-4 space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <TabsContent value="students">
                <DataTable columns={columns} data={students} />
              </TabsContent>
              <TabsContent value="faculty">
                <DataTable columns={columns} data={faculty} />
              </TabsContent>
              <TabsContent value="admins">
                <DataTable columns={columns} data={admins} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
