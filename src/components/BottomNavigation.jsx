import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, BookOpen, Users, MessageSquare } from 'lucide-react'

const BottomNavigation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path) => currentPath === path

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/explore', icon: Search, label: 'Explore' },
    // These routes need to be defined in your App component
    { path: '/my-books', icon: BookOpen, label: 'My Books' },
    { path: '/social', icon: Users, label: 'Social' },
    { path: '/chatbot', icon: MessageSquare, label: 'ChatBot' }
  ]

  return (
    <div className="bg-white border-t px-4 py-3 flex justify-between fixed bottom-0 left-0 right-0">
      {navItems.map((item) => (
        <div 
          key={item.path}
          className={`flex flex-col items-center ${isActive(item.path) ? 'text-indigo-600' : 'text-gray-400'} cursor-pointer`}
          onClick={() => navigate(item.path)}
        >
          <item.icon className="h-6 w-6" />
          <span className="text-xs mt-1">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default BottomNavigation