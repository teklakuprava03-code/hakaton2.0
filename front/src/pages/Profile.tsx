import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, User, Mail, Shield, Loader2, Save, Camera, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const profileSchema = z.object({
  full_name: z.string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(100, "Имя не должно превышать 100 символов"),
  phone: z.string()
    .trim()
    .optional()
    .refine((val) => !val || /^\+?[1-9]\d{1,14}$/.test(val), {
      message: "Введите корректный номер телефона"
    })
});

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;

      // Load user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const fullProfile = {
        ...profileData,
        role: roleData?.role || null
      };

      setProfile(fullProfile);
      setFormData({
        full_name: profileData.full_name || "",
        phone: profileData.phone || "",
      });
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error("Ошибка загрузки профиля");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    try {
      profileSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success("Профиль обновлен");
      loadProfile(); // Reload to show updated data
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || "Ошибка обновления профиля");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Пожалуйста, загрузите изображение");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5MB");
      return;
    }

    setUploadingAvatar(true);

    try {
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("Аватар обновлен");
      loadProfile();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || "Ошибка загрузки аватара");
    } finally {
      setUploadingAvatar(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;

    setUploadingAvatar(true);

    try {
      // Delete from storage
      const fileName = profile.avatar_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${fileName}`]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Аватар удален");
      loadProfile();
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      toast.error(error.message || "Ошибка удаления аватара");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleName = (role: string) => {
    const roleNames: { [key: string]: string } = {
      doctor: "Врач",
      nurse: "Медсестра",
      chief_doctor: "Главный врач",
      orderly: "Санитар",
      admin: "Администратор",
      department_head: "Заведующий отделением"
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'admin' || role === 'chief_doctor') return 'default';
    if (role === 'doctor') return 'secondary';
    return 'outline';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Профиль пользователя</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Avatar Card */}
          <Card className="p-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {profile?.full_name ? getInitials(profile.full_name) : <User className="w-12 h-12" />}
                  </AvatarFallback>
                </Avatar>
                
                {/* Avatar upload button */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />

                {/* Remove avatar button */}
                {profile?.avatar_url && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="absolute top-0 right-0 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    title="Удалить аватар"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
                <p className="text-muted-foreground">{profile?.email}</p>
                {profile?.role && (
                  <Badge variant={getRoleBadgeVariant(profile.role)} className="mt-2">
                    <Shield className="w-3 h-3 mr-1" />
                    {getRoleName(profile.role)}
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Edit Form */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Редактировать профиль</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="full_name">
                  Полное имя <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className={errors.full_name ? "border-destructive" : ""}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive mt-1">{errors.full_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="pl-10 bg-muted cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email нельзя изменить
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить изменения
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={saving}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </Card>

          {/* Role Info */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Информация о роли</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Ваша текущая роль: <span className="font-semibold text-foreground">{profile?.role ? getRoleName(profile.role) : "Не назначена"}</span>
              </p>
              <p className="text-muted-foreground">
                Изменить роль может только администратор системы.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
