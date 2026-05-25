import "server-only";

import type { StaffAuthRecord, StudentAuthRecord } from "./types";

// bcrypt hash of "1111" generated with cost factor 10
const BCRYPT_HASH_1111 = "$2b$10$OHg3xVXNN8PdcXnOVrQ/YuC5F9Tw1ypSMHU2NuT72/JDUQ4Ehj3Ey";

export const bootstrapStaffAccounts: StaffAuthRecord[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    role: "super_admin",
    email: "admin@platform.local",
    passwordHash: "$2b$10$PMDObCRPXhMJZklE7RwUDun8XdcYwIzZwI6spI.NV/jBeNahhON7q",
    displayName: "Platform Admin",
    status: "active",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    role: "teacher",
    email: "teacher@platform.local",
    passwordHash: "$2b$10$sTp3l53VLk2bKEjybsGW0OH8gMxvx5uKroETcZlaEt0jBnDRelfny",
    displayName: "Demo Teacher",
    status: "active",
  },

];

export const bootstrapStudentAccounts: StudentAuthRecord[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    studentLogin: "ST-100001",
    displayName: "Alex Morozov",
    pinHash: BCRYPT_HASH_1111,
    status: "active",
  },
];
