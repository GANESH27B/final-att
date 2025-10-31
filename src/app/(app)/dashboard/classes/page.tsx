import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, User, Users } from "lucide-react";
import { mockClasses } from "@/lib/data";

export default function ClassManagementPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold tracking-tight font-headline">Class Management</h1>
            <p className="text-muted-foreground">Create and manage classes and sections.</p>
        </div>
        <Button>
          <PlusCircle />
          Add Class
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockClasses.map((cls) => (
          <Card key={cls.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{cls.name}</CardTitle>
              <CardDescription>Section {cls.section}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{cls.faculty}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Users className="h-4 w-4" />
                <span>{cls.studentCount} Students</span>
              </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full">Manage Class</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
