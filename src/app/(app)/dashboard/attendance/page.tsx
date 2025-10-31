import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { QrCode, ScanLine, ListChecks, CheckCircle, PlayCircle, StopCircle } from "lucide-react";
import { mockAttendanceRecords } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export default function AttendancePage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>Start Attendance Session</CardTitle>
                <CardDescription>Select a class and start taking attendance.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
                <Button><PlayCircle /> Start Session</Button>
                <Button variant="destructive"><StopCircle/> End Session</Button>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScanLine /> QR/Barcode Scanner</CardTitle>
            <CardDescription>
              Scan student QR codes to mark attendance. The system will provide audio feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center">
              <QrCode className="h-16 w-16 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Camera feed appears here</p>
              <Button variant="secondary" className="mt-4">Activate Camera</Button>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Input placeholder="Or enter registration number manually" />
              <Button>Submit</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks /> Attendance Summary</CardTitle>
            <CardDescription>
              Live summary for <strong>CS 101</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4 p-4 bg-secondary rounded-lg">
                <div>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold">35</p>
                </div>
                <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Present Today</p>
                    <p className="text-2xl font-bold text-green-500">32</p>
                </div>
                 <Separator orientation="vertical" className="h-12" />
                 <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-500">3</p>
                </div>
            </div>
            
            <h3 className="font-semibold mb-2">Present Students:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mockAttendanceRecords.filter(r => r.status === 'Present').map((record) => (
                <div key={record.id} className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium">{record.studentName}</span>
                  <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
              ))}
                <div className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium">Michael Scott</span>
                   <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border">
                  <span className="font-medium">Dwight Schrute</span>
                   <Badge variant="secondary" className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Present
                  </Badge>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
