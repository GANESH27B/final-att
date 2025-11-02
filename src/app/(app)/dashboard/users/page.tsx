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
import { mockUsers } from "@/lib/data";
import { AddUserDialog } from "./components/add-user-dialog";

export default function UserManagementPage() {
  const students = mockUsers.filter((user) => user.role === 'student');
  const faculty = mockUsers.filter((user) => user.role === 'faculty');
  const admins = mockUsers.filter((user) => user.role === 'admin');


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
          <TabsContent value="students">
            <DataTable columns={columns} data={students} />
          </TabsContent>
          <TabsContent value="faculty">
            <DataTable columns={columns} data={faculty} />
          </TabsContent>
           <TabsContent value="admins">
            <DataTable columns={columns} data={admins} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
