import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, GraduationCap, BookOpen, LogOut, Menu, X, Wallet, UserRoundCheck, ShoppingBag, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Brand, initials } from './UI';
import { useAuth } from '../context/AuthContext';
const adminNav = [
 {label:'Overview', to:'/admin', Icon:LayoutDashboard},
 {label:'Certificates', to:'/admin/certificates', Icon:GraduationCap},
 {label:'Quizzes & assignments', to:'/admin/assessments', Icon:GraduationCap},
 {label:'Courses', to:'/admin/courses', Icon:BookOpen},
 {label:'Reports', to:'/admin/reports', Icon:LayoutDashboard},
 {label:'Students & progress', to:'/admin/students', Icon:GraduationCap},
 {label:'Grant / revoke access', to:'/admin/access', Icon:UserRoundCheck},
 {label:'Payments & requests', to:'/admin/orders', Icon:Wallet},
 {label:'Profile & security', to:'/admin/profile', Icon:UserRoundCheck},
];
const studentNav = [
 {label:'My learning', to:'/student', Icon:LayoutDashboard},
 {label:'Certificates', to:'/student/certificates', Icon:GraduationCap},
 {label:'Quizzes & assignments', to:'/student/assessments', Icon:GraduationCap},
 {label:'Explore courses', to:'/student/courses', Icon:ShoppingBag},
 {label:'Purchase history', to:'/student/orders', Icon:Wallet},
 {label:'Profile & security', to:'/student/profile', Icon:UserRoundCheck},
];
export function AppLayout() {
 const {me, logout} = useAuth(); const navigate = useNavigate(); const [opened, setOpened] = useState(false);
 const [collapsed, setCollapsed] = useState(false);
 const menuButton = useRef<HTMLButtonElement>(null);
 const { pathname } = useLocation();
 useEffect(() => setOpened(false), [pathname]);
 function closeMenu() { setOpened(false); menuButton.current?.focus(); }
 if (!me) return null;
 const isAdmin = me.scope === 'PLATFORM'; const nav = isAdmin ? adminNav : studentNav;
 async function signOut() { await logout(); navigate('/login'); }
 return <div className={`app-shell academy-shell ${isAdmin ? '' : 'student-shell'} ${collapsed ? 'student-sidebar-collapsed' : ''}`}
  onKeyDown={event => { if (opened && event.key === 'Escape') closeMenu(); }}>
  {opened && <button className="mobile-overlay" aria-label="Close menu" onClick={closeMenu}/>}
  <aside id="workspace-navigation" className={`sidebar ${opened ? 'sidebar-open' : ''}`}>
   <div className="sidebar-brand"><NavLink to={isAdmin ? "/admin" : "/student"}><Brand/></NavLink><button className="side-mobile-close" aria-label="Close navigation" onClick={closeMenu}><X size={18}/></button></div>
   {isAdmin ? <div className="academy-side-info"><strong>{isAdmin ? 'Academy administrator' : 'Student learning'}</strong><small>{isAdmin ? 'Course & enrollment management' : me.user.directStudent?.studentCode || 'My workspace'}</small></div> : <div className="student-sidebar-identity">
    <div className="profile-avatar" aria-hidden="true">{initials(me.user.name)}</div>
    <div><strong>{me.user.name}</strong><small>Student workspace</small></div>
   </div>}
   <div className="nav-label">{isAdmin ? 'ADMINISTRATION' : 'LEARNING'}</div>
   <nav className="side-nav">{nav.map(({to,label,Icon}) => <NavLink key={to} to={to} end={to !== "/student/courses"} onClick={()=>setOpened(false)} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
   <div className="sidebar-bottom"><NavLink className="nav-link" to="/"><Globe size={18}/>Visit website</NavLink><button className="nav-link signout" onClick={signOut}><LogOut size={18}/>Sign out</button></div>
  </aside>
  <div className="main-area"><header className="topbar"><div className="topbar-left"><button ref={menuButton} className="mobile-menu" onClick={()=>setOpened(true)} aria-label="Open menu" aria-expanded={opened} aria-controls="workspace-navigation"><Menu size={22}/></button>{!isAdmin && <button type="button" className="student-sidebar-toggle" aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
    aria-expanded={!collapsed} aria-controls="workspace-navigation" onClick={() => setCollapsed(value => !value)}>
    {collapsed ? <PanelLeftOpen size={21}/> : <PanelLeftClose size={21}/>}
   </button>}<span className="topbar-path">Aspireedge <span>/</span> {isAdmin ? 'Admin' : 'Student'}</span></div><div className="topbar-right"><div className="profile-avatar">{initials(me.user.name)}</div><div className="profile-info"><strong>{me.user.name}</strong><span>{isAdmin?'Administrator':'Student'}</span></div></div></header><main className="page-content"><Outlet/></main></div>
 </div>;
}
