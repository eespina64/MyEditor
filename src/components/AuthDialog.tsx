'use client';

import { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthStore, DEMO_USERS } from '@/store/authStore';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const { signIn, signUp, signInDemo, isLoading, error, clearError, mode } = useAuthStore();

  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError('Complete todos los campos');
      return;
    }

    await signIn(email, password);
    if (!error) {
      onClose();
      resetForm();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password || !name) {
      setLocalError('Complete todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    await signUp(email, password, name);
    if (!error) {
      setActiveTab('login');
      setLocalError(null);
    }
  };

  const handleDemoLogin = (user: typeof DEMO_USERS[0]) => {
    signInDemo(user);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setLocalError(null);
    clearError();
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acceder al Sistema</DialogTitle>
          <DialogDescription>
            {mode === 'demo'
              ? 'Modo demo: seleccione un usuario o inicie sesión'
              : 'Inicie sesión o cree una cuenta nueva'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1 gap-2">
              <LogIn className="h-4 w-4" />
              Iniciar Sesión
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1 gap-2" disabled={mode === 'demo'}>
              <UserPlus className="h-4 w-4" />
              Registrarse
            </TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login" className="space-y-4 mt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {displayError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {displayError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Iniciar Sesión
              </Button>
            </form>

            {/* Demo Users */}
            {mode === 'demo' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 text-center">
                    O seleccione un usuario demo:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_USERS.map((user) => (
                      <Button
                        key={user.id}
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-center gap-1"
                        onClick={() => handleDemoLogin(user)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate max-w-full">
                          {user.name.split(' ')[0]}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                          {user.role}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repita la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {displayError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {displayError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Crear Cuenta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
