import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Topbar />
      <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] p-6">
        <Outlet />
      </main>
    </div>
  )
}
