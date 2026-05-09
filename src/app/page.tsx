'use client';

import { useState } from 'react';
import { BookOpen, LayoutDashboard, FileText, LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Dashboard } from '@/components/Dashboard';
import { OJSIntegration } from '@/components/OJSIntegration';
import { AddArticleDialog } from '@/components/AddArticleDialog';
import { useArticleStore } from '@/store/articleStore';

const demoUsers = [
  { id: '1', name: 'Dr. María García', email: 'mgarcia@revista.edu', role: 'admin' as const },
  { id: '2', name: 'Prof. Juan López', email: 'jlopez@revista.edu', role: 'editor' as const },
  { id: '3', name: 'Ana Martínez', email: 'amartinez@universidad.edu', role: 'reviewer' as const }
];

export default function HomePage() {
  const { currentUser, setCurrentUser, getFilteredArticles } = useArticleStore();
  const [activeTab, setActiveTab] = useState('board');

  const totalArticles = getFilteredArticles().length;

  const handleLogin = (user: typeof demoUsers[0]) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-2">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-900 tracking-tight">EDITIA</h1>
              <p className="text-xs text-slate-500">Revistas Electrónicas URBE</p>
            </div>
          </div>

          {/* User Menu */}
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 rounded-full px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="ml-2 text-sm font-medium">{currentUser.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser.name}</span>
                    <span className="text-xs font-normal text-slate-500">{currentUser.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-slate-500">
                  Rol: <span className="ml-1 capitalize text-slate-700">{currentUser.role}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Seleccionar Usuario (Demo)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {demoUsers.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => handleLogin(user)}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tablero de Artículos</h2>
            <p className="text-slate-500">{totalArticles} de {totalArticles} artículos</p>
          </div>

          <div className="flex items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white border">
                <TabsTrigger value="board" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Tablero
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="ojs" className="gap-2">
                  <FileText className="h-4 w-4" />
                  OJS
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <AddArticleDialog />
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'board' && <KanbanBoard />}
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'ojs' && <OJSIntegration />}
      </main>
    </div>
  );
}
