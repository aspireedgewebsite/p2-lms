import { lazy } from 'react';
import { PageMotion } from './components/PageMotion';
import { SiteFooter } from './components/SiteFooter';
import { createBrowserRouter, createRoutesFromElements, Link, Navigate, Outlet, Route, RouterProvider, ScrollRestoration } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout';
import { Spinner } from './components/UI';
import { Information } from './pages/Information';
import { AdminCertificates, StudentCertificates, VerifyCertificate } from './pages/Certificates';
import { AccountLink, Profile } from './pages/Account';
import { VerifyEmail } from './pages/VerifyEmail';
import { Login, Register } from './pages/Access';
import { Landing, Catalog, CourseDetails, PublicHeader } from './pages/Public';
const AdminCourseBuilder = lazy(() => import('./pages/CourseBuilder').then(module => ({ default: module.AdminCourseBuilder })));
const AdminAccess = lazy(() => import('./pages/CourseAccess').then(module => ({ default: module.AdminAccess })));
const StudentProfile = lazy(() => import('./pages/Analytics').then(module => ({ default: module.StudentProfile })));
const EnrollmentReport = lazy(() => import('./pages/Analytics').then(module => ({ default: module.EnrollmentReport })));
const AdminAssessments = lazy(() => import('./pages/Assessments').then(module => ({ default: module.AdminAssessments })));
const StudentAssessments = lazy(() => import('./pages/Assessments').then(module => ({ default: module.StudentAssessments })));
const AdminDashboard = lazy(() => import('./pages/AcademyAdmin').then(module => ({ default: module.AdminDashboard })));
const AdminCourses = lazy(() => import('./pages/AcademyAdmin').then(module => ({ default: module.AdminCourses })));
const AdminStudents = lazy(() => import('./pages/AcademyAdmin').then(module => ({ default: module.AdminStudents })));
const AdminOrders = lazy(() => import('./pages/AcademyAdmin').then(module => ({ default: module.AdminOrders })));
const StudentDashboard = lazy(() => import('./pages/AcademyStudent').then(module => ({ default: module.StudentDashboard })));
const StudentLearn = lazy(() => import('./pages/AcademyStudent').then(module => ({ default: module.StudentLearn })));
const StudentOrders = lazy(() => import('./pages/AcademyStudent').then(module => ({ default: module.StudentOrders })));

function Guard({ role }: { role: 'PLATFORM' | 'STUDENT' }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="app-loader"><Spinner/></div>;
  if (!me) return <Navigate to="/login" replace/>;
  if (me.scope !== role) return <Navigate to={me.scope === 'PLATFORM' ? '/admin' : '/student'} replace/>;
  return <AppLayout/>;
}
function RootLayout() {
 return <AuthProvider><PageMotion/><Outlet/><SiteFooter/><ScrollRestoration/></AuthProvider>;
}
const router = createBrowserRouter(createRoutesFromElements(<Route element={<RootLayout/>}>
   <Route path="/" element={<Landing/>}/>
   <Route path="/verify-certificate" element={<VerifyCertificate/>}/>
   <Route path="/verify-certificate/:id" element={<VerifyCertificate/>}/>
   <Route path="/about" element={<Information page="about"/>}/>
   <Route path="/faq" element={<Information page="faq"/>}/>
   <Route path="/contact" element={<Information page="contact"/>}/>
   <Route path="/courses" element={<Catalog/>}/>
   <Route path="/courses/:id" element={<CourseDetails/>}/>
   <Route path="/login" element={<Login/>}/>
   <Route path="/forgot-password" element={<AccountLink mode="forgot"/>}/>
   <Route path="/reset-password" element={<AccountLink mode="reset"/>}/>
   <Route path="/verify-email" element={<VerifyEmail/>}/>
   <Route path="/register" element={<Register/>}/>
   <Route element={<Guard role="PLATFORM"/>}>
     <Route path="/admin/profile" element={<Profile/>}/>
     <Route path="/admin" element={<AdminDashboard/>}/>
     <Route path="/admin/courses" element={<AdminCourses/>}/>
     <Route path="/admin/courses/:id" element={<AdminCourseBuilder/>}/>
     <Route path="/admin/certificates" element={<AdminCertificates/>}/>
     <Route path="/admin/assessments" element={<AdminAssessments/>}/>
     <Route path="/admin/reports" element={<EnrollmentReport/>}/>
     <Route path="/admin/students/:id" element={<StudentProfile/>}/>
     <Route path="/admin/students" element={<AdminStudents/>}/>
     <Route path="/admin/access" element={<AdminAccess/>}/>
     <Route path="/admin/orders" element={<AdminOrders/>}/>
   </Route>
   <Route element={<Guard role="STUDENT"/>}>
     <Route path="/student/certificates" element={<StudentCertificates/>}/>
     <Route path="/student/assessments" element={<StudentAssessments/>}/>
     <Route path="/student/profile" element={<Profile/>}/>
     <Route path="/student" element={<StudentDashboard/>}/>
     <Route path="/student/courses" element={<Catalog student/>}/>
     <Route path="/student/courses/:id" element={<CourseDetails student/>}/>
     <Route path="/student/learn/:id" element={<StudentLearn/>}/>
     <Route path="/student/orders" element={<StudentOrders/>}/>
   </Route>
   <Route path="*" element={<><PublicHeader/><main className="academy-container academy-section public-content"><h1>Page not found</h1><Link className="primary-button inline-button" to="/">Return home</Link></main></>}/>
</Route>));

export default function App() {
 return <RouterProvider router={router}/>;
}
