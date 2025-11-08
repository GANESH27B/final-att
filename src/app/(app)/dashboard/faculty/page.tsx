
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Users, BookOpen, Bot, FileText, ImageIcon, Lightbulb, Loader2 } from "lucide-react";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Class, User as UserType, AttendanceRecord } from "@/lib/types";
import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { generateAttendanceInsights, AttendanceInsightsOutput } from "@/ai/flows/attendance-analytics-insights";


const formSchema = z.object({
  targetId: z.string().min(1, "Please select a class."),
  reportFormat: z.enum(["PDF", "Excel"]),
});

type FormValues = z.infer<typeof formSchema>;


export default function FacultyDashboardPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  // States for dashboard stats
  const [studentCount, setStudentCount] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // States for analytics
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AttendanceInsightsOutput | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetId: "",
      reportFormat: "PDF",
    },
  });
  
  // 1. Fetch classes for the current faculty
  const facultyClassesQuery = useMemoFirebase(() => 
    firestore && currentUser ? query(collection(firestore, 'classes'), where('facultyId', '==', currentUser.uid)) : null,
    [firestore, currentUser]
  );
  const { data: facultyClasses, isLoading: isLoadingClasses } = useCollection<Class>(facultyClassesQuery);

  // 2. Fetch total students
  useEffect(() => {
    if (facultyClasses && firestore) {
      setIsLoadingStudents(true);
      let totalStudents = new Set<string>();

      if (facultyClasses.length === 0) {
        setStudentCount(0);
        setIsLoadingStudents(false);
        return;
      }

      const fetchStudentsPromises = facultyClasses.map(cls => {
        const studentsCollectionRef = collection(firestore, 'classes', cls.id, 'students');
        return getDocs(studentsCollectionRef);
      });

      Promise.all(fetchStudentsPromises)
        .then(snapshots => {
          snapshots.forEach(snapshot => {
            snapshot.forEach(doc => totalStudents.add(doc.id));
          });
          setStudentCount(totalStudents.size);
        })
        .finally(() => setIsLoadingStudents(false));
    } else if (!isLoadingClasses) {
      setIsLoadingStudents(false);
      setStudentCount(0);
    }
  }, [facultyClasses, firestore, isLoadingClasses]);

  const isLoading = isLoadingClasses || isLoadingStudents;

  // --- Analytics Logic ---
  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        setResult(null);
        if (!firestore) {
          throw new Error("Firestore is not initialized.");
        }

        const attendanceQuery = query(collection(firestore, `classes/${values.targetId}/attendance`));
        const attendanceSnap = await getDocs(attendanceQuery);
        const attendanceData = attendanceSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

        if(attendanceData.length === 0) {
            toast({ title: "No Data", description: "No attendance records found for the selected class." });
            return;
        }

        const insights = await generateAttendanceInsights({
          attendanceData: JSON.stringify(attendanceData),
          analysisPreferences: `Focus on class with ID ${values.targetId}`,
          reportFormat: values.reportFormat,
          visualizationTypes: ['bar', 'pie', 'line'],
        });

        setResult(insights);
        toast({
          title: "Report Generated",
          description: "Your AI-powered insights are ready.",
        });
      } catch (e: any) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: e.message || "An unexpected error occurred.",
        });
      }
    });
  };

  const handleDownloadReport = () => {
    if (!result || !result.report) return;
    
    const mimeType = result.reportFormat === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const fileExtension = result.reportFormat === 'PDF' ? '.pdf' : '.xlsx';
    
    try {
      const byteCharacters = atob(result.report);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {type: mimeType});

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_report_${new Date().toISOString().slice(0,10)}${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "The report data could not be processed for download."
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight font-headline">Faculty Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{facultyClasses?.length || 0}</div>}
            <p className="text-xs text-muted-foreground">This semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{studentCount}</div>}
            <p className="text-xs text-muted-foreground">Across all your classes</p>
          </CardContent>
        </Card>
      </div>

       {/* Analytics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics & Reporting</CardTitle>
          <CardDescription>
            Generate attendance reports and visualizations for your classes, powered by AI.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="targetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingClasses}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingClasses ? `Loading...` : `Select a class...`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facultyClasses?.map(item => <SelectItem key={item.id} value={item.id}>{item.name} - Section {item.section}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="reportFormat"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Report Format</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex items-center space-x-4 pt-2"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="PDF" />
                            </FormControl>
                            <FormLabel className="font-normal">PDF</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="Excel" />
                            </FormControl>
                            <FormLabel className="font-normal">Excel</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter>
               <Button type="submit" disabled={isPending}>
                 {isPending ? <Loader2 className="animate-spin" /> : "Generate Report"}
               </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      
      {isPending && (
          <Card>
              <CardContent className="p-6 flex justify-center items-center">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  <p className="ml-4 text-muted-foreground">Generating your report...</p>
              </CardContent>
          </Card>
      )}
      
      {result && !isPending && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot /> Generated Insights</CardTitle>
                <CardDescription>AI-powered analysis of the selected data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><FileText /> Report</h3>
                    <Button variant="link" className="p-0 h-auto text-sm" onClick={handleDownloadReport}>{`Download Report (${result.reportFormat})`}</Button>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><ImageIcon /> Visualizations</h3>
                    <div className="text-sm text-muted-foreground flex flex-col space-y-1 mt-2">
                        {result.visualizations.map((vis, i) => <a href={vis} key={i} target="_blank" rel="noopener noreferrer" className="hover:underline">Visualization {i+1}</a>)}
                    </div>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><Lightbulb /> Key Insights</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap font-code">{result.insights}</p>
                </div>
            </CardContent>
        </Card>
      )}

    </div>
  );
}

    