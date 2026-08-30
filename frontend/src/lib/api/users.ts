import { apiRequest } from "./client";
import type { User } from "@/types";

export interface UpdateProfileData {
  full_name?: string;
  preferences?: Record<string, unknown>;
}

export async function updateProfile(data: UpdateProfileData): Promise<User> {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    body: data,
  });
}

export async function updateAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<User>("/users/me/avatar", {
    method: "POST",
    body: formData,
  });
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  return apiRequest<void>("/users/me/password", {
    method: "PATCH",
    body: { current_password, new_password },
  });
}

export async function deleteAccount(): Promise<void> {
  return apiRequest<void>("/users/me", {
    method: "DELETE",
  });
}
