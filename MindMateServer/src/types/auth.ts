// types/auth.ts
import { Types } from 'mongoose';

export interface UserDocument {
  _id: Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  profile: {
    name: string;
    avatar?: string;
    joinDate: Date;
    isVerifiedProfessional: boolean;
    organizationAffiliation?: string;
    verificationDocuments: string[];
  };
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
}

export interface AuthState {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (response: { token: string; user: AuthenticatedUser }) => Promise<void>;
  signOut: () => Promise<void>;
}