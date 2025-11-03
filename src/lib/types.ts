export type UserRole = "admin" | "faculty" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string;
  status: "Active" | "Inactive";
  registrationNumber?: string;
  classId?: string; // This represents enrollment in a specific class instance for a term, not the general course.
};

export type Class = {
  id: string;
  name: string;
  facultyId: string;
  section: string;
};

export type AttendanceRecord = {
  id: string;
  studentName: string;
  studentId: string;
  date: string;
  status: "Present" | "Absent";
};

export type StudentAttendance = {
  subject: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
};
