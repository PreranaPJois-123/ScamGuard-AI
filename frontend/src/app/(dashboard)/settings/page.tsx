"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { User as UserIcon, Shield, Key, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { updateProfile, changePassword, deleteAccount } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  
  const [fullName, setFullName] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showDangerModal, setShowDangerModal] = useState(false);
  
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      if (user.preferences) {
        setDarkMode(user.preferences.theme === "dark");
        setEmailNotifications(user.preferences.email_notifications !== false);
      }
    }
  }, [user]);

  const TABS = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "security", label: "Security", icon: Shield },
    { id: "api", label: "API Keys", icon: Key },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle, danger: true },
  ];

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    try {
      await updateProfile({
        full_name: fullName,
        preferences: {
          ...user?.preferences,
          theme: darkMode ? "dark" : "light",
          email_notifications: emailNotifications,
        }
      });
      await refreshUser();
      toast({ title: "Profile updated successfully", variant: "success" });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Failed to update profile";
      toast({ title: msg, variant: "error" });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast({ title: "Please fill in all password fields", variant: "error" });
      return;
    }
    setIsSubmittingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: "Password updated successfully", variant: "success" });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Failed to update password";
      toast({ title: msg, variant: "error" });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      await logout();
      toast({ title: "Account deleted", variant: "success" });
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Failed to delete account";
      toast({ title: msg, variant: "error" });
      setShowDangerModal(false);
      setIsDeleting(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: (c: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings, preferences, and security.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Menu */}
        <div className="w-full md:w-64 flex flex-col gap-1 bg-card/50 backdrop-blur-md border border-border/50 rounded-xl p-2 shadow-sm shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? (tab.danger ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary') 
                    : (tab.danger ? 'text-destructive/70 hover:bg-destructive/10' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-card/50 backdrop-blur-md border border-border/50 rounded-xl p-8 shadow-sm min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-semibold mb-1">Profile Information</h2>
                <p className="text-sm text-muted-foreground mb-6">Update your personal details and preferences.</p>
                
                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-6 max-w-xl">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Email</label>
                    <input type="text" value={user?.email || ""} disabled className="h-10 rounded-md border border-input bg-muted px-3 text-sm focus:outline-none opacity-70 cursor-not-allowed" />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                  
                  <div className="flex flex-col gap-4 pt-4 border-t border-border/50">
                    <h3 className="text-sm font-semibold">Preferences</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Dark Mode</span>
                        <span className="text-xs text-muted-foreground">Toggle dark theme appearance</span>
                      </div>
                      <ToggleSwitch checked={darkMode} onChange={setDarkMode} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Email Notifications</span>
                        <span className="text-xs text-muted-foreground">Receive weekly threat reports</span>
                      </div>
                      <ToggleSwitch checked={emailNotifications} onChange={setEmailNotifications} />
                    </div>
                  </div>
                  
                  <Button type="submit" isLoading={isSubmittingProfile} className="w-fit mt-4 bg-primary text-primary-foreground shadow-sm">Save Changes</Button>
                </form>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-semibold mb-1">Security</h2>
                <p className="text-sm text-muted-foreground mb-6">Manage your password and security settings.</p>
                
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-6 max-w-xl">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Current Password</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" required />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" required />
                  </div>
                  <Button type="submit" isLoading={isSubmittingPassword} className="w-fit mt-2">Update Password</Button>
                </form>
              </motion.div>
            )}

            {activeTab === "api" && (
              <motion.div key="api" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-semibold mb-1">API Keys</h2>
                <p className="text-sm text-muted-foreground mb-6">Manage your API keys for integrations.</p>
                <div className="p-4 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-between">
                  <span className="font-mono text-sm tracking-widest">sk_live_xxxxxxxxxxxxxxxxx</span>
                  <Button variant="ghost" size="sm" className="h-8">Regenerate</Button>
                </div>
              </motion.div>
            )}

            {activeTab === "danger" && (
              <motion.div key="danger" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-semibold mb-1 text-destructive">Danger Zone</h2>
                <p className="text-sm text-muted-foreground mb-6">Irreversible actions for your account.</p>
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6">
                  <h3 className="font-semibold text-foreground mb-2">Delete Account</h3>
                  <p className="text-sm text-muted-foreground mb-6">Once you delete your account, there is no going back. Please be certain.</p>
                  <Button variant="destructive" onClick={() => setShowDangerModal(true)}>Delete Account</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Danger Modal */}
      <AnimatePresence>
        {showDangerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card border border-border rounded-xl p-8 max-w-md w-full m-4 shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-4 text-destructive">
                <AlertTriangle className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Are you sure?</h2>
              </div>
              <p className="text-muted-foreground mb-8">
                This action cannot be undone. This will permanently delete your account and remove your data from our servers.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDangerModal(false)} disabled={isDeleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteAccount} isLoading={isDeleting}>Yes, delete my account</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
