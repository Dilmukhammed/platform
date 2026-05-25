# LMS Platform - Comprehensive Manual QA Test Scenarios

## Overview
This document contains ALL test scenarios for manual QA testing of the LMS platform, organized by role and feature area.

---

# 1. AUTHENTICATION

## 1.1 Teacher Authentication

### TC-AUTH-T-001: Teacher Registration
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can register a new account |
| **Steps** | 1. Navigate to signup page 2. Enter name, email, password 3. Confirm password 4. Submit form |
| **Expected Result** | Account created, user redirected to onboarding or login |
| **How to Verify** | Check database for new teacher record with status 'active' |
| **Result** | ⏳ PENDING |
| **Notes** | |

### TC-AUTH-T-002: Teacher Login - Valid Credentials
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can login with correct email/password |
| **Steps** | 1. Navigate to login page 2. Enter valid email 3. Enter valid password 4. Submit |
| **Expected Result** | Session created, redirected to teacher dashboard |
| **How to Verify** | Auth cookie set, dashboard displays teacher's name |

### TC-AUTH-T-003: Teacher Login - Invalid Password
| Field | Value |
|-------|-------|
| **What to Test** | Login fails with incorrect password |
| **Steps** | 1. Navigate to login page 2. Enter valid email 3. Enter wrong password 4. Submit |
| **Expected Result** | Error message displayed, no session created |
| **How to Verify** | No auth cookie, error message visible |

### TC-AUTH-T-004: Teacher Login - Non-existent Email
| Field | Value |
|-------|-------|
| **What to Test** | Login fails for unregistered email |
| **Steps** | 1. Navigate to login page 2. Enter unregistered email 3. Enter any password 4. Submit |
| **Expected Result** | Error message displayed |
| **How to Verify** | No auth cookie, generic error message |

### TC-AUTH-T-005: Teacher Logout
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can logout successfully |
| **Steps** | 1. Login as teacher 2. Click logout button 3. Confirm logout |
| **Expected Result** | Session cleared, redirected to login page |
| **How to Verify** | Auth cookie deleted, cannot access protected routes |

### TC-AUTH-T-006: Teacher Password Change - Valid
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can change password with valid current password |
| **Steps** | 1. Login as teacher 2. Go to Settings 3. Click "Change Password" 4. Enter current password 5. Enter new password 6. Confirm new password 7. Submit |
| **Expected Result** | Password updated, success message displayed |
| **How to Verify** | Login with new password succeeds |

### TC-AUTH-T-007: Teacher Password Change - Wrong Current
| Field | Value |
|-------|-------|
| **What to Test** | Password change fails with wrong current password |
| **Steps** | 1. Login as teacher 2. Go to Settings 3. Click "Change Password" 4. Enter WRONG current password 5. Enter new password 6. Submit |
| **Expected Result** | Error message, password not changed |
| **How to Verify** | Login with old password still works |

### TC-AUTH-T-008: Teacher Password Reset Request
| Field | Value |
|-------|-------|
| **What to Test** | Password reset email can be requested |
| **Steps** | 1. Navigate to login page 2. Click "Forgot Password" 3. Enter registered email 4. Submit |
| **Expected Result** | Reset email sent (or simulated in dev) |
| **How to Verify** | Check email inbox or dev logs |

### TC-AUTH-T-009: Teacher Session Expiration
| Field | Value |
|-------|-------|
| **What to Test** | Session expires after max age (8 hours) |
| **Steps** | 1. Login as teacher 2. Wait for session to expire 3. Attempt to access protected page |
| **Expected Result** | Redirected to login page |
| **How to Verify** | Session warning shown at 5 minutes before expiry |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-19. Session expires after 8 hours, user redirected to login |

### TC-AUTH-T-010: Teacher Rate Limiting on Login
| Field | Value |
|-------|-------|
| **What to Test** | Login is rate-limited after multiple failures |
| **Steps** | 1. Attempt login with wrong credentials 5+ times rapidly |
| **Expected Result** | Rate limit error, temporary lockout |
| **How to Verify** | Error message indicates rate limiting |

---

## 1.2 Student Authentication

### TC-AUTH-S-001: Student Login - Valid PIN
| Field | Value |
|-------|-------|
| **What to Test** | Student can login with student login and PIN |
| **Steps** | 1. Navigate to student login page 2. Enter student login 3. Enter valid PIN 4. Submit |
| **Expected Result** | Session created, redirected to student dashboard |
| **How to Verify** | Auth cookie set, dashboard shows student's name |

### TC-AUTH-S-002: Student Login - Invalid PIN
| Field | Value |
|-------|-------|
| **What to Test** | Login fails with incorrect PIN |
| **Steps** | 1. Navigate to student login page 2. Enter valid student login 3. Enter wrong PIN 4. Submit |
| **Expected Result** | Error message displayed |
| **How to Verify** | No session created, error visible |

### TC-AUTH-S-003: Student Login - Non-existent Login
| Field | Value |
|-------|-------|
| **What to Test** | Login fails for unregistered student login |
| **Steps** | 1. Navigate to student login page 2. Enter non-existent student login 3. Enter any PIN 4. Submit |
| **Expected Result** | Error message displayed |
| **How to Verify** | No session created |

### TC-AUTH-S-004: Student Logout
| Field | Value |
|-------|-------|
| **What to Test** | Student can logout successfully |
| **Steps** | 1. Login as student 2. Click logout button |
| **Expected Result** | Session cleared, redirected to login |
| **How to Verify** | Cannot access student pages |

### TC-AUTH-S-005: Student Self-Registration via Join Code
| Field | Value |
|-------|-------|
| **What to Test** | New student can create profile when joining class |
| **Steps** | 1. Navigate to /join with valid class code 2. Enter first name, last name 3. Set PIN 4. Submit |
| **Expected Result** | Profile created, enrolled in class, logged in |
| **How to Verify** | Student appears in class roster, can access dashboard |

### TC-AUTH-S-006: Student Profile Creation - Existing Login
| Field | Value |
|-------|-------|
| **What to Test** | Existing student can join additional class |
| **Steps** | 1. Navigate to /join with valid class code 2. Enter existing student login 3. Enter PIN 4. Submit |
| **Expected Result** | Enrolled in new class, logged in |
| **How to Verify** | Student now appears in both class rosters |

### TC-AUTH-S-007: Blocked Student Login
| Field | Value |
|-------|-------|
| **What to Test** | Blocked student cannot login |
| **Steps** | 1. Admin blocks student 2. Student attempts login |
| **Expected Result** | Login denied with appropriate message |
| **How to Verify** | Error message indicates account blocked |

---

## 1.3 Admin Authentication

### TC-AUTH-A-001: Admin Login
| Field | Value |
|-------|-------|
| **What to Test** | Super admin can login |
| **Steps** | 1. Navigate to admin login 2. Enter admin email 3. Enter password 4. Submit |
| **Expected Result** | Session created with super_admin role |
| **How to Verify** | Can access admin dashboard at /admin |

### TC-AUTH-A-002: Admin Logout
| Field | Value |
|-------|-------|
| **What to Test** | Admin can logout |
| **Steps** | 1. Login as admin 2. Click logout |
| **Expected Result** | Session cleared, redirected |
| **How to Verify** | Cannot access admin pages |

---

## 1.4 Cross-Role Authentication

### TC-AUTH-X-001: Teacher Cannot Access Student Pages
| Field | Value |
|-------|-------|
| **What to Test** | Teacher is redirected when accessing student routes |
| **Steps** | 1. Login as teacher 2. Navigate to /student/any-page |
| **Expected Result** | Redirected to teacher dashboard or login |
| **How to Verify** | URL changes, student content not shown |

### TC-AUTH-X-002: Student Cannot Access Teacher Pages
| Field | Value |
|-------|-------|
| **What to Test** | Student is redirected when accessing teacher routes |
| **Steps** | 1. Login as student 2. Navigate to /teacher/any-page |
| **Expected Result** | Redirected to student dashboard or login |
| **How to Verify** | URL changes, teacher content not shown |

### TC-AUTH-X-003: Student Cannot Access Admin Pages
| Field | Value |
|-------|-------|
| **What to Test** | Student is redirected when accessing admin routes |
| **Steps** | 1. Login as student 2. Navigate to /admin/any-page |
| **Expected Result** | Redirected away |
| **How to Verify** | URL changes, admin content not shown |

### TC-AUTH-X-004: Teacher Cannot Access Admin Pages
| Field | Value |
|-------|-------|
| **What to Test** | Regular teacher cannot access admin routes |
| **Steps** | 1. Login as teacher (not super_admin) 2. Navigate to /admin/any-page |
| **Expected Result** | Redirected away |
| **How to Verify** | URL changes, admin content not shown |

### TC-AUTH-X-005: Unauthenticated Access to Protected Routes
| Field | Value |
|-------|-------|
| **What to Test** | Unauthenticated users cannot access protected pages |
| **Steps** | 1. Clear all cookies 2. Navigate to /teacher, /student, /admin |
| **Expected Result** | Redirected to login pages |
| **How to Verify** | Login page displayed |

---

# 2. CLASS MANAGEMENT

## 2.1 Teacher Class Operations

### TC-CLASS-T-001: Create New Class
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can create a new class |
| **Steps** | 1. Login as teacher 2. Navigate to Classes 3. Click "Create Class" 4. Enter title (min 3 chars) 5. Enter description (optional) 6. Submit |
| **Expected Result** | Class created with auto-generated join code, appears in class list |
| **How to Verify** | Class visible in /teacher/classes, join code generated |

### TC-CLASS-T-002: Create Class - No Organization Selected
| Field | Value |
|-------|-------|
| **What to Test** | Cannot create class without selecting organization |
| **Steps** | 1. Login as teacher with no org selected 2. Navigate to Classes 3. Attempt to create class |
| **Expected Result** | Prompted to select or create organization first |
| **How to Verify** | Redirect to organizations or message displayed |

### TC-CLASS-T-003: View Class Details
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view class details |
| **Steps** | 1. Navigate to Classes 2. Click on a class card |
| **Expected Result** | Class detail page shows: title, description, student count, join code, assignments |
| **How to Verify** | All class info displayed correctly |

### TC-CLASS-T-004: Update Class Title
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can update class title |
| **Steps** | 1. Navigate to class detail 2. Edit title 3. Save |
| **Expected Result** | Title updated, changes reflected |
| **How to Verify** | New title visible in class list and detail |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-005: Update Class Description
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can update class description |
| **Steps** | 1. Navigate to class detail 2. Edit description 3. Save |
| **Expected Result** | Description updated |
| **How to Verify** | New description visible |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-006: View Class Roster
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view enrolled students |
| **Steps** | 1. Navigate to class detail 2. Click "View Roster" |
| **Expected Result** | List of students with: name, login, join date, enrollment source |
| **How to Verify** | All enrolled students displayed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-007: Add Student Manually
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can add a student to class |
| **Steps** | 1. Navigate to Students page 2. Click "Add Student" 3. Select class 4. Enter login, first name, last name, PIN 5. Submit |
| **Expected Result** | Student created and enrolled in class |
| **How to Verify** | Student appears in class roster |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-008: Add Student - Duplicate Login
| Field | Value |
|-------|-------|
| **What to Test** | Cannot add student with existing login in same org |
| **Steps** | 1. Attempt to add student with login that already exists |
| **Expected Result** | Error message, student not created |
| **How to Verify** | Duplicate not created |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18. Fixed error message: now shows "A student with this login already exists with a different PIN" when PIN doesn't match. If login+PIN match, student is added to class (reuse existing profile). |

### TC-CLASS-T-009: Bulk Import Students via CSV
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can import multiple students via CSV |
| **Steps** | 1. Navigate to Students > Import 2. Upload CSV file 3. Preview data 4. Confirm import |
| **Expected Result** | Students created and enrolled, import report generated |
| **How to Verify** | Students appear in roster, import report shows results |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Feature not implemented yet |

### TC-CLASS-T-010: CSV Import - Invalid Format
| Field | Value |
|-------|-------|
| **What to Test** | Invalid CSV shows validation errors |
| **Steps** | 1. Upload CSV with wrong columns or invalid data |
| **Expected Result** | Validation errors displayed, import blocked |
| **How to Verify** | Errors shown per row |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Feature not implemented yet |

### TC-CLASS-T-011: Download CSV Template
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can download CSV template |
| **Steps** | 1. Navigate to Students > Import 2. Click "Download Template" |
| **Expected Result** | CSV template downloaded |
| **How to Verify** | File contains correct column headers |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Feature not implemented yet |

### TC-CLASS-T-012: View Join Code
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view active join code |
| **Steps** | 1. Navigate to class detail 2. Click "Manage Join Code" |
| **Expected Result** | 6-digit join code displayed |
| **How to Verify** | Code visible, can be copied |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-013: Rotate Join Code
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can generate new join code |
| **Steps** | 1. Navigate to join code management 2. Click "Rotate Join Code" |
| **Expected Result** | New code generated, old code deactivated |
| **How to Verify** | New code displayed, old code no longer works |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-014: Join Code History
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view join code history |
| **Steps** | 1. Navigate to join code management 2. Rotate code multiple times 3. View history |
| **Expected Result** | List of all previous codes with dates |
| **How to Verify** | History shows all rotated codes |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-T-015: Copy Join Code
| Field | Value |
|-------|-------|
| **What to Test** | Join code can be copied to clipboard |
| **Steps** | 1. Navigate to join code 2. Click copy button |
| **Expected Result** | Code copied to clipboard |
| **How to Verify** | Paste shows the code |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18. Fixed: added CopyButton client component with clipboard API |

### TC-CLASS-T-016: Class Owner Permissions
| Field | Value |
|-------|-------|
| **What to Test** | Only class owner can rotate join codes |
| **Steps** | 1. Login as different teacher in same org 2. Attempt to rotate join code |
| **Expected Result** | Action denied or hidden |
| **How to Verify** | Button not visible or error shown |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Skipped 2026-04-18 |

---

## 2.2 Student Class Operations

### TC-CLASS-S-001: View Enrolled Classes
| Field | Value |
|-------|-------|
| **What to Test** | Student can view their enrolled classes |
| **Steps** | 1. Login as student 2. Navigate to Classes |
| **Expected Result** | List of all classes student is enrolled in |
| **How to Verify** | All enrolled classes displayed with status |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-S-002: View Class Detail
| Field | Value |
|-------|-------|
| **What to Test** | Student can view class details |
| **Steps** | 1. Navigate to Classes 2. Click on a class |
| **Expected Result** | Class detail shows: title, description, teacher, assignments |
| **How to Verify** | All info displayed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-S-003: Join Class via Code - New Student
| Field | Value |
|-------|-------|
| **What to Test** | New student can join class with code |
| **Steps** | 1. Navigate to /join 2. Enter valid 6-digit code 3. Create profile (name, PIN) 4. Submit |
| **Expected Result** | Profile created, enrolled in class, logged in |
| **How to Verify** | Class appears in student's class list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-S-004: Join Class via Code - Existing Student
| Field | Value |
|-------|-------|
| **What to Test** | Existing student can join additional class |
| **Steps** | 1. Login as student 2. Navigate to join class 3. Enter valid code |
| **Expected Result** | Enrolled in new class |
| **How to Verify** | New class appears in class list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-S-005: Join Class - Invalid Code
| Field | Value |
|-------|-------|
| **What to Test** | Cannot join with invalid code |
| **Steps** | 1. Enter invalid or expired code |
| **Expected Result** | Error message displayed |
| **How to Verify** | Not enrolled, error shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-CLASS-S-006: Join Class - Already Enrolled
| Field | Value |
|-------|-------|
| **What to Test** | Cannot join class already enrolled in |
| **Steps** | 1. Enter code for class already enrolled in |
| **Expected Result** | Message indicating already enrolled |
| **How to Verify** | No duplicate enrollment |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18. Fixed join flow to show explicit already-enrolled message instead of generic join success. |

### TC-CLASS-S-007: View Class Assignments
| Field | Value |
|-------|-------|
| **What to Test** | Student can see assignments for a class |
| **Steps** | 1. Navigate to class detail 2. View assignments section |
| **Expected Result** | List of assignments with deadlines and status |
| **How to Verify** | All published assignments visible |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18. Fixed student class detail assignments to link to assignment detail route. |

---

## 2.3 Admin Class Operations

### TC-CLASS-A-001: View All Classes
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view all classes across organizations |
| **Steps** | 1. Login as admin 2. Navigate to Classes |
| **Expected Result** | List of all classes in system |
| **How to Verify** | All classes from all orgs visible |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Skipped 2026-04-18 |

### TC-CLASS-A-002: View Class Details
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view any class details |
| **Steps** | 1. Navigate to Classes 2. Select a class |
| **Expected Result** | Full class details including join code |
| **How to Verify** | All info displayed |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Skipped 2026-04-18 |

---

# 3. MATERIALS

## 3.1 Teacher Material Operations

### TC-MAT-T-001: Create Personal Material
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can create personal material |
| **Steps** | 1. Navigate to Materials 2. Enter title 3. Enter description 4. Upload file 5. Submit |
| **Expected Result** | Material created with status 'personal' |
| **How to Verify** | Material appears in personal materials list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-002: Upload File for Material
| Field | Value |
|-------|-------|
| **What to Test** | File upload works correctly |
| **Steps** | 1. Create material 2. Select file 3. Upload |
| **Expected Result** | File uploaded to storage, linked to material |
| **How to Verify** | File can be downloaded/viewed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-003: View Personal Materials
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view their materials |
| **Steps** | 1. Navigate to Materials |
| **Expected Result** | List of all personal materials with status |
| **How to Verify** | All materials displayed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-004: Edit Material Title
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can edit material title |
| **Steps** | 1. Navigate to material 2. Edit title 3. Save |
| **Expected Result** | Title updated |
| **How to Verify** | New title visible |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-005: Edit Material Description
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can edit material description |
| **Steps** | 1. Navigate to material 2. Edit description 3. Save |
| **Expected Result** | Description updated |
| **How to Verify** | New description visible |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-006: Submit Material to School Library
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can submit material for approval |
| **Steps** | 1. Navigate to material 2. Click "Submit to School Library" |
| **Expected Result** | Status changes to 'pending_school' |
| **How to Verify** | Material shows pending status |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-T-007: View School Materials Library
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view approved school materials |
| **Steps** | 1. Navigate to Library > School Materials |
| **Expected Result** | List of admin-approved materials |
| **How to Verify** | Only approved materials shown |

### TC-MAT-T-008: Material Status - Approved
| Field | Value |
|-------|-------|
| **What to Test** | Approved material shows correct status |
| **Steps** | 1. Admin approves material 2. Teacher views material |
| **Expected Result** | Status shows 'approved_school', visible in library |
| **How to Verify** | Material in school library |

### TC-MAT-T-009: Material Status - Rejected
| Field | Value |
|-------|-------|
| **What to Test** | Rejected material shows reason |
| **Steps** | 1. Admin rejects material with reason 2. Teacher views material |
| **Expected Result** | Status shows 'rejected_school', rejection reason visible |
| **How to Verify** | Reason displayed |

### TC-MAT-T-010: Resubmit Rejected Material
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can resubmit after rejection |
| **Steps** | 1. View rejected material 2. Make changes 3. Resubmit |
| **Expected Result** | Status changes to 'pending_school' |
| **How to Verify** | New submission in approval queue |

---

## 3.2 Admin Material Approvals

### TC-MAT-A-001: View Pending Material Approvals
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view pending material submissions |
| **Steps** | 1. Login as admin 2. Navigate to Material Approvals |
| **Expected Result** | List of materials pending approval |
| **How to Verify** | All pending materials shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-A-002: Approve Material
| Field | Value |
|-------|-------|
| **What to Test** | Admin can approve material |
| **Steps** | 1. Navigate to Material Approvals 2. Select material 3. Click Approve |
| **Expected Result** | Material status changes to 'approved_school' |
| **How to Verify** | Material appears in school library |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18. Fixed NEXT_REDIRECT error in server action catch block |

### TC-MAT-A-003: Reject Material with Reason
| Field | Value |
|-------|-------|
| **What to Test** | Admin can reject material with reason |
| **Steps** | 1. Navigate to Material Approvals 2. Select material 3. Enter rejection reason 4. Click Reject |
| **Expected Result** | Material status changes to 'rejected_school', reason saved |
| **How to Verify** | Teacher sees rejection reason |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-18 |

### TC-MAT-A-004: Material Approval Notification
| Field | Value |
|-------|-------|
| **What to Test** | Teacher receives notification on approval |
| **Steps** | 1. Admin approves material 2. Check teacher notifications |
| **Expected Result** | Notification sent to submitting teacher |
| **How to Verify** | Notification visible in teacher's inbox |

---

# 4. TESTS

## 4.1 Teacher Test Operations

### TC-TEST-T-001: Create Manual Test
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can create test manually |
| **Steps** | 1. Navigate to Tests 2. Create new test 3. Add title, description 4. Add questions with answers 5. Save |
| **Expected Result** | Test created with status 'personal_draft' |
| **How to Verify** | Test appears in tests list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. Create manual test works |

### TC-TEST-T-002: Add Question to Test
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can add questions |
| **Steps** | 1. Edit test 2. Add question with prompt, answer, explanation 3. Save |
| **Expected Result** | Question added to test |
| **How to Verify** | Question count increases |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. Add question to test works |

### TC-TEST-T-003: Edit Question
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can edit existing question |
| **Steps** | 1. Edit test 2. Modify question prompt/answer 3. Save |
| **Expected Result** | Question updated |
| **How to Verify** | Changes visible |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. Edit question works |

### TC-TEST-T-004: Delete Question
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can delete question |
| **Steps** | 1. Edit test 2. Delete a question 3. Save |
| **Expected Result** | Question removed |
| **How to Verify** | Question count decreases |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. Delete question works |

### TC-TEST-T-005: Generate AI Test Draft
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can generate test via AI |
| **Steps** | 1. Navigate to Tests > AI Draft 2. Enter prompt 3. Set question count (3-5) 4. Generate |
| **Expected Result** | Test draft generated with questions |
| **How to Verify** | Draft appears with questions |

### TC-TEST-T-006: Edit AI Generated Test
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can edit AI-generated test |
| **Steps** | 1. View AI draft 2. Edit title, questions 3. Save |
| **Expected Result** | Changes saved |
| **How to Verify** | Modified content visible |

### TC-TEST-T-007: Submit Test to School Approval
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can submit test for approval |
| **Steps** | 1. Navigate to test 2. Click "Submit to School Approval" |
| **Expected Result** | Status changes to 'pending_school' |
| **How to Verify** | Test shows pending status |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. Submit test to school approval works |

### TC-TEST-T-008: View Test Status
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can see test status |
| **Steps** | 1. Navigate to Tests |
| **Expected Result** | Each test shows status badge |
| **How to Verify** | Status badges correct |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-20. View test status works |

### TC-TEST-T-009: View School Test Library
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view approved tests |
| **Steps** | 1. Navigate to Library > Tests |
| **Expected Result** | List of approved tests |
| **How to Verify** | Only approved tests shown |
| **Result** | ⚠️ PARTIAL |
| **Notes** | Tested 2026-04-21. School test library list works, but the tests themselves cannot be opened for viewing |

### TC-TEST-T-010: Link Test to Assignment
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can link test to assignment template |
| **Steps** | 1. Create/edit assignment template 2. Select test to link |
| **Expected Result** | Test linked to assignment |
| **How to Verify** | Test appears in assignment details |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Link test to assignment works |

---

## 4.2 Admin Test Approvals

### TC-TEST-A-001: View Pending Test Approvals
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view pending test submissions |
| **Steps** | 1. Navigate to Test Approvals |
| **Expected Result** | List of tests pending approval |
| **How to Verify** | All pending tests shown |

### TC-TEST-A-002: Approve Test
| Field | Value |
|-------|-------|
| **What to Test** | Admin can approve test |
| **Steps** | 1. Select test 2. Click Approve |
| **Expected Result** | Test status changes to 'approved_school' |
| **How to Verify** | Test appears in school library |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Approve test works |

### TC-TEST-A-003: Reject Test with Reason
| Field | Value |
|-------|-------|
| **What to Test** | Admin can reject test with reason |
| **Steps** | 1. Select test 2. Enter reason 3. Click Reject |
| **Expected Result** | Test rejected with reason saved |
| **How to Verify** | Teacher sees rejection reason |

---

## 4.3 Student Test Taking

### TC-TEST-S-001: Start Test
| Field | Value |
|-------|-------|
| **What to Test** | Student can start a test |
| **Steps** | 1. Navigate to assignment 2. Click "Start Test" |
| **Expected Result** | Test attempt created, first question shown |
| **How to Verify** | Test interface displayed |

### TC-TEST-S-002: Answer Question
| Field | Value |
|-------|-------|
| **What to Test** | Student can answer questions |
| **Steps** | 1. View question 2. Select answer 3. Navigate to next |
| **Expected Result** | Answer saved |
| **How to Verify** | Progress indicator updates |

### TC-TEST-S-003: Navigate Between Questions
| Field | Value |
|-------|-------|
| **What to Test** | Student can navigate questions |
| **Steps** | 1. Use Previous/Next buttons 2. Use question grid |
| **Expected Result** | Can move between questions freely |
| **How to Verify** | Correct question displayed |

### TC-TEST-S-004: Review Answers Before Submit
| Field | Value |
|-------|-------|
| **What to Test** | Student can review all answers |
| **Steps** | 1. Click "Review Answers" 2. View all questions and answers |
| **Expected Result** | All questions and selected answers shown |
| **How to Verify** | Can see all responses |

### TC-TEST-S-005: Submit Test
| Field | Value |
|-------|-------|
| **What to Test** | Student can submit completed test |
| **Steps** | 1. Complete all questions 2. Click "Submit Test" |
| **Expected Result** | Test submitted, score calculated |
| **How to Verify** | Submission confirmed, redirected to results |

### TC-TEST-S-006: Timed Test - Auto Submit
| Field | Value |
|-------|-------|
| **What to Test** | Test auto-submits when time expires |
| **Steps** | 1. Start timed test 2. Wait for timer to expire |
| **Expected Result** | Test auto-submitted |
| **How to Verify** | Submission confirmed |

### TC-TEST-S-007: Continue In-Progress Test
| Field | Value |
|-------|-------|
| **What to Test** | Student can continue incomplete test |
| **Steps** | 1. Start test 2. Navigate away 3. Return to assignment 4. Click "Continue Test" |
| **Expected Result** | Resume at last question |
| **How to Verify** | Previous answers preserved |

### TC-TEST-S-008: View Test Result
| Field | Value |
|-------|-------|
| **What to Test** | Student can view test score |
| **Steps** | 1. Navigate to assignment 2. View test result |
| **Expected Result** | Score displayed |
| **How to Verify** | Score matches submitted answers |

---

# 5. ASSIGNMENTS

## 5.1 Teacher Assignment Operations

### TC-ASGN-T-001: Create Assignment Template
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can create assignment template |
| **Steps** | 1. Navigate to Assignments 2. Click "Create Template" 3. Enter title, description, instructions 4. Link materials 5. Link tests 6. Save |
| **Expected Result** | Template created |
| **How to Verify** | Template appears in list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Create assignment template works |

### TC-ASGN-T-002: Link Materials to Template
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can link materials |
| **Steps** | 1. Create/edit template 2. Select materials from list |
| **Expected Result** | Materials linked |
| **How to Verify** | Material count shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Link materials to template works |

### TC-ASGN-T-003: Link Tests to Template
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can link tests |
| **Steps** | 1. Create/edit template 2. Select tests from list |
| **Expected Result** | Tests linked |
| **How to Verify** | Test count shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Link tests to template works |

### TC-ASGN-T-004: Edit Assignment Template
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can edit template |
| **Steps** | 1. Navigate to template 2. Edit fields 3. Save |
| **Expected Result** | Changes saved |
| **How to Verify** | Updated content visible |

### TC-ASGN-T-005: Publish Assignment to Classes
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can publish assignment |
| **Steps** | 1. Navigate to template 2. Click "Publish" 3. Select classes 4. Set deadline 5. Publish |
| **Expected Result** | Publication created, students can see assignment |
| **How to Verify** | Assignment appears in student's list |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Publish assignment to classes works |

### TC-ASGN-T-006: Publish to Multiple Classes
| Field | Value |
|-------|-------|
| **What to Test** | Can publish to multiple classes at once |
| **Steps** | 1. Select multiple classes 2. Publish |
| **Expected Result** | Publication created for each class |
| **How to Verify** | All selected classes have assignment |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Publish to multiple classes works |

### TC-ASGN-T-007: Set Class-Specific Deadline
| Field | Value |
|-------|-------|
| **What to Test** | Can override deadline per class |
| **Steps** | 1. Set default deadline 2. Override for specific class |
| **Expected Result** | Class has different deadline |
| **How to Verify** | Class shows overridden deadline |

### TC-ASGN-T-008: View Publications
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view all publications |
| **Steps** | 1. Navigate to Publications |
| **Expected Result** | List of all published assignments |
| **How to Verify** | All publications shown with status |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. View publications works |

### TC-ASGN-T-009: View Publication Details
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view publication details |
| **Steps** | 1. Click on publication |
| **Expected Result** | Details: title, classes, deadlines, submission stats |
| **How to Verify** | All info displayed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. View publication details works |

### TC-ASGN-T-010: View Publication Gradebook
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view grades for publication |
| **Steps** | 1. Navigate to publication 2. Click "View Gradebook" |
| **Expected Result** | All student grades displayed |
| **How to Verify** | Grades visible with scores |

---

## 5.2 Student Assignment Operations

### TC-ASGN-S-001: View Assignments List
| Field | Value |
|-------|-------|
| **What to Test** | Student can view all assignments |
| **Steps** | 1. Navigate to Assignments |
| **Expected Result** | List of all assignments with status, deadline |
| **How to Verify** | All published assignments shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Student assignments list shows all published assignments with status, deadline, and links to assignment details |

### TC-ASGN-S-002: Filter Assignments by Status
| Field | Value |
|-------|-------|
| **What to Test** | Student can filter assignments |
| **Steps** | 1. Click filter tabs (All/Active/Overdue/Completed/Reviewed) |
| **Expected Result** | List filtered by status |
| **How to Verify** | Only matching assignments shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Student filter tabs work (All/Active/Overdue/Completed/Reviewed). Also added status filter tabs to teacher assignments page (All/Draft/Active/Archived) |

### TC-ASGN-S-003: View Assignment Detail
| Field | Value |
|-------|-------|
| **What to Test** | Student can view assignment details |
| **Steps** | 1. Click on assignment |
| **Expected Result** | Details: title, description, instructions, deadline, linked content |
| **How to Verify** | All info displayed |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Student assignment detail page shows title, description, deadline, linked content |

### TC-ASGN-S-004: View Linked Materials
| Field | Value |
|-------|-------|
| **What to Test** | Student can view linked materials |
| **Steps** | 1. Navigate to assignment 2. View materials section |
| **Expected Result** | List of linked materials |
| **How to Verify** | Can access materials |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Materials shown inline on assignment detail page (not separate page like teacher). Works fine — no need for separate material page for students |

### TC-ASGN-S-005: Upload Practical Work
| Field | Value |
|-------|-------|
| **What to Test** | Student can upload work file |
| **Steps** | 1. Navigate to assignment 2. Click "Upload Work" 3. Select file 4. Submit |
| **Expected Result** | File uploaded, submission created |
| **How to Verify** | File listed in submission |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Upload practical work works |

### TC-ASGN-S-006: Upload - Invalid File Type
| Field | Value |
|-------|-------|
| **What to Test** | Invalid file types rejected |
| **Steps** | 1. Attempt to upload unsupported file type |
| **Expected Result** | Error message, upload blocked |
| **How to Verify** | File not uploaded |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Invalid file types rejected with error message |

### TC-ASGN-S-007: Upload - File Too Large
| Field | Value |
|-------|-------|
| **What to Test** | Files over 1GB rejected |
| **Steps** | 1. Attempt to upload file > 1GB |
| **Expected Result** | Error message |
| **How to Verify** | Upload blocked |
| **Result** | ⏭️ SKIPPED |
| **Notes** | Skipped 2026-04-21 — no large file available to test |

### TC-ASGN-S-008: Replace Uploaded File
| Field | Value |
|-------|-------|
| **What to Test** | Student can replace uploaded file |
| **Steps** | 1. Upload file 2. Click "Replace" 3. Upload new file |
| **Expected Result** | New file replaces old |
| **How to Verify** | Only new file shown |

### TC-ASGN-S-009: Submit Assignment
| Field | Value |
|-------|-------|
| **What to Test** | Student can submit assignment |
| **Steps** | 1. Upload work 2. Click "Submit" |
| **Expected Result** | Assignment submitted, status changes |
| **How to Verify** | Status shows "submitted" |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Submit flow works: upload → init → signed-url upload → complete → submit API → success screen |

### TC-ASGN-S-010: View Submission Status
| Field | Value |
|-------|-------|
| **What to Test** | Student can see submission status |
| **Steps** | 1. Navigate to assignment |
| **Expected Result** | Status displayed (not_started/in_progress/submitted/reviewed) |
| **How to Verify** | Correct status shown |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. StatusChip shows all 5 statuses on assignment detail and list page |

### TC-ASGN-S-011: View Deadline Countdown
| Field | Value |
|-------|-------|
| **What to Test** | Deadline countdown displayed |
| **Steps** | 1. View assignment with approaching deadline |
| **Expected Result** | Time remaining shown |
| **How to Verify** | Countdown accurate |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. `formatDeadline()` shows countdown: "Due in N days/hours", "Due soon", red styling when urgent |

### TC-ASGN-S-012: Overdue Assignment Indicator
| Field | Value |
|-------|-------|
| **What to Test** | Overdue assignments marked |
| **Steps** | 1. View assignment past deadline |
| **Expected Result** | Overdue indicator shown |
| **How to Verify** | Visual indicator present |
| **Result** | ✅ PASS |
| **Notes** | Tested 2026-04-21. Overdue badge and red styling are shown correctly for past-deadline assignments |

---

## 5.3 Admin Assignment Operations

### TC-ASGN-A-001: View All Assignment Templates
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view all templates |
| **Steps** | 1. Navigate to Assignments |
| **Expected Result** | List of all templates in system |
| **How to Verify** | All templates shown |

---

# 6. GRADES

## 6.1 Teacher Grade Operations

### TC-GRD-T-001: View Gradebook
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view cross-class gradebook |
| **Steps** | 1. Navigate to Gradebook |
| **Expected Result** | All student grades across publications |
| **How to Verify** | Grades displayed with scores |

### TC-GRD-T-002: Filter Gradebook by Publication
| Field | Value |
|-------|-------|
| **What to Test** | Can filter by publication |
| **Steps** | 1. Select publication from dropdown |
| **Expected Result** | Only grades for that publication |
| **How to Verify** | Filtered results shown |

### TC-GRD-T-003: Filter Gradebook by Class
| Field | Value |
|-------|-------|
| **What to Test** | Can filter by class |
| **Steps** | 1. Select class from dropdown |
| **Expected Result** | Only grades for that class |
| **How to Verify** | Filtered results shown |

### TC-GRD-T-004: Search Students in Gradebook
| Field | Value |
|-------|-------|
| **What to Test** | Can search by student name/login |
| **Steps** | 1. Enter search term |
| **Expected Result** | Matching students shown |
| **How to Verify** | Search works |

### TC-GRD-T-005: Export Gradebook to CSV
| Field | Value |
|-------|-------|
| **What to Test** | Can export grades to CSV |
| **Steps** | 1. Click "Export" button |
| **Expected Result** | CSV file downloaded |
| **How to Verify** | File contains grade data |

### TC-GRD-T-006: View Score Distribution
| Field | Value |
|-------|-------|
| **What to Test** | Score distribution displayed |
| **Steps** | 1. View gradebook |
| **Expected Result** | Distribution chart (excellent/good/average/below) |
| **How to Verify** | Percentages shown |

### TC-GRD-T-007: View Grading Formula
| Field | Value |
|-------|-------|
| **What to Test** | Grading formula visible |
| **Steps** | 1. View publication gradebook |
| **Expected Result** | Practice weight + Test weight shown |
| **How to Verify** | Formula displayed |

### TC-GRD-T-008: View Publication Gradebook
| Field | Value |
|-------|-------|
| **What to Test** | Can view grades per publication |
| **Steps** | 1. Navigate to publication 2. Click "View Gradebook" |
| **Expected Result** | All student grades for that publication |
| **How to Verify** | Grades shown |

---

## 6.2 Student Grade Viewing

### TC-GRD-S-001: View Results List
| Field | Value |
|-------|-------|
| **What to Test** | Student can view released results |
| **Steps** | 1. Navigate to Results |
| **Expected Result** | List of released grades |
| **How to Verify** | All released results shown |

### TC-GRD-S-002: View Result Detail
| Field | Value |
|-------|-------|
| **What to Test** | Student can view detailed result |
| **Steps** | 1. Click on result |
| **Expected Result** | Practice score, test score, final score, grade |
| **How to Verify** | All scores displayed |

### TC-GRD-S-003: View Grade Breakdown
| Field | Value |
|-------|-------|
| **What to Test** | Score breakdown visible |
| **Steps** | 1. View result detail |
| **Expected Result** | Practice score with weight, test score with weight |
| **How to Verify** | Weights shown |

### TC-GRD-S-004: View Override Reason
| Field | Value |
|-------|-------|
| **What to Test** | Override reason displayed if grade overridden |
| **Steps** | 1. View result with override |
| **Expected Result** | Override reason shown |
| **How to Verify** | Reason visible |

### TC-GRD-S-005: Cannot View Unreleased Grades
| Field | Value |
|-------|-------|
| **What to Test** | Student cannot see unreleased grades |
| **Steps** | 1. Check results before teacher releases |
| **Expected Result** | Grade not visible |
| **How to Verify** | No grade shown |

---

# 7. REVIEWS

## 7.1 Teacher Review Operations

### TC-REV-T-001: View Pending Reviews
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view submissions needing review |
| **Steps** | 1. Navigate to Reviews |
| **Expected Result** | List of pending submissions |
| **How to Verify** | All pending shown |

### TC-REV-T-002: Filter Reviews by Publication
| Field | Value |
|-------|-------|
| **What to Test** | Can filter by publication |
| **Steps** | 1. Select publication filter |
| **Expected Result** | Only submissions for that publication |
| **How to Verify** | Filtered list shown |

### TC-REV-T-003: Filter Reviews by Class
| Field | Value |
|-------|-------|
| **What to Test** | Can filter by class |
| **Steps** | 1. Select class filter |
| **Expected Result** | Only submissions from that class |
| **How to Verify** | Filtered list shown |

### TC-REV-T-004: Filter Reviews by Status
| Field | Value |
|-------|-------|
| **What to Test** | Can filter by review status |
| **Steps** | 1. Select status (pending/in review/released) |
| **Expected Result** | Only matching submissions |
| **How to Verify** | Filtered list shown |

### TC-REV-T-005: Search Reviews by Student
| Field | Value |
|-------|-------|
| **What to Test** | Can search by student name/login |
| **Steps** | 1. Enter search term |
| **Expected Result** | Matching submissions shown |
| **How to Verify** | Search works |

### TC-REV-T-006: View Submission for Review
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view submitted work |
| **Steps** | 1. Click "Review" on submission |
| **Expected Result** | Submission files displayed |
| **How to Verify** | Files viewable |

### TC-REV-T-007: Add Annotations
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can annotate submission |
| **Steps** | 1. Open review workspace 2. Draw annotations on document |
| **Expected Result** | Annotations saved |
| **How to Verify** | Annotations visible |

### TC-REV-T-008: Add Review Comment
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can add comments |
| **Steps** | 1. Open review 2. Add comment 3. Save |
| **Expected Result** | Comment saved |
| **How to Verify** | Comment visible |

### TC-REV-T-009: Set Grade
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can set grade |
| **Steps** | 1. Open review 2. Enter practice score 3. Enter test score 4. Save |
| **Expected Result** | Grade calculated and saved |
| **How to Verify** | Final score shown |

### TC-REV-T-010: Override Grade
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can override calculated grade |
| **Steps** | 1. Open review 2. Override final score 3. Enter reason 4. Save |
| **Expected Result** | Override saved with reason |
| **How to Verify** | Override indicator shown |

### TC-REV-T-011: Release Review to Student
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can release review |
| **Steps** | 1. Complete review 2. Click "Release" |
| **Expected Result** | Review visible to student |
| **How to Verify** | Student can see review |

### TC-REV-T-012: Review Priority Indicators
| Field | Value |
|-------|-------|
| **What to Test** | Overdue/due soon indicators shown |
| **Steps** | 1. View reviews list |
| **Expected Result** | Priority badges on submissions |
| **How to Verify** | Indicators correct |

---

## 7.2 Student Review Viewing

### TC-REV-S-001: View Released Review
| Field | Value |
|-------|-------|
| **What to Test** | Student can view released review |
| **Steps** | 1. Navigate to Results 2. Click on released result |
| **Expected Result** | Review with annotations and comments visible |
| **How to Verify** | All review content shown |

### TC-REV-S-002: View Teacher Annotations
| Field | Value |
|-------|-------|
| **What to Test** | Student can see annotations |
| **Steps** | 1. Open review |
| **Expected Result** | Annotations displayed on document |
| **How to Verify** | Drawings visible |

### TC-REV-S-003: View Teacher Comments
| Field | Value |
|-------|-------|
| **What to Test** | Student can see comments |
| **Steps** | 1. Open review |
| **Expected Result** | Comments displayed |
| **How to Verify** | Comments visible |

### TC-REV-S-004: Cannot View Unreleased Review
| Field | Value |
|-------|-------|
| **What to Test** | Student cannot see unreleased review |
| **Steps** | 1. Check assignment before release |
| **Expected Result** | Review not accessible |
| **How to Verify** | Access denied |

---

# 8. NOTIFICATIONS

## 8.1 Teacher Notifications

### TC-NOTIF-T-001: View Notifications
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view notifications |
| **Steps** | 1. Navigate to Notifications |
| **Expected Result** | List of notifications |
| **How to Verify** | All notifications shown |

### TC-NOTIF-T-002: Mark Notification as Read
| Field | Value |
|-------|-------|
| **What to Test** | Can mark notification as read |
| **Steps** | 1. Click "Mark Read" on notification |
| **Expected Result** | Notification marked read |
| **How to Verify** | Unread indicator removed |

### TC-NOTIF-T-003: Unread Count Badge
| Field | Value |
|-------|-------|
| **What to Test** | Unread count shown in navigation |
| **Steps** | 1. Have unread notifications |
| **Expected Result** | Badge with count in sidebar |
| **How to Verify** | Count accurate |

### TC-NOTIF-T-004: Notification - Class Joined
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified when student joins |
| **Steps** | 1. Student joins class via code |
| **Expected Result** | Teacher receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-005: Notification - Assignment Submitted
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on submission |
| **Steps** | 1. Student submits assignment |
| **Expected Result** | Teacher receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-006: Notification - Material Approved
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on material approval |
| **Steps** | 1. Admin approves material |
| **Expected Result** | Teacher receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-007: Notification - Material Rejected
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on material rejection |
| **Steps** | 1. Admin rejects material |
| **Expected Result** | Teacher receives notification with reason |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-008: Notification - Test Approved
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on test approval |
| **Steps** | 1. Admin approves test |
| **Expected Result** | Teacher receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-009: Notification - Test Rejected
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on test rejection |
| **Steps** | 1. Admin rejects test |
| **Expected Result** | Teacher receives notification with reason |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-T-010: Notification - Org Approved
| Field | Value |
|-------|-------|
| **What to Test** | Teacher notified on org approval |
| **Steps** | 1. Admin approves organization |
| **Expected Result** | Teacher receives notification |
| **How to Verify** | Notification in inbox |

---

## 8.2 Student Notifications

### TC-NOTIF-S-001: View Notifications
| Field | Value |
|-------|-------|
| **What to Test** | Student can view notifications |
| **Steps** | 1. Navigate to Notifications |
| **Expected Result** | List of notifications |
| **How to Verify** | All notifications shown |

### TC-NOTIF-S-002: Mark Notification as Read
| Field | Value |
|-------|-------|
| **What to Test** | Can mark notification as read |
| **Steps** | 1. Click "Mark Read" |
| **Expected Result** | Notification marked read |
| **How to Verify** | Unread indicator removed |

### TC-NOTIF-S-003: Notification - Class Joined
| Field | Value |
|-------|-------|
| **What to Test** | Student notified on class join |
| **Steps** | 1. Join class via code |
| **Expected Result** | Student receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-S-004: Notification - Assignment Published
| Field | Value |
|-------|-------|
| **What to Test** | Student notified on new assignment |
| **Steps** | 1. Teacher publishes assignment |
| **Expected Result** | Student receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-S-005: Notification - Deadline Changed
| Field | Value |
|-------|-------|
| **What to Test** | Student notified on deadline change |
| **Steps** | 1. Teacher changes deadline |
| **Expected Result** | Student receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-S-006: Notification - Review Completed
| Field | Value |
|-------|-------|
| **What to Test** | Student notified on review release |
| **Steps** | 1. Teacher releases review |
| **Expected Result** | Student receives notification |
| **How to Verify** | Notification in inbox |

### TC-NOTIF-S-007: Notification - Grade Updated
| Field | Value |
|-------|-------|
| **What to Test** | Student notified on grade change |
| **Steps** | 1. Teacher updates grade |
| **Expected Result** | Student receives notification |
| **How to Verify** | Notification in inbox |

---

## 8.3 Admin Notifications

### TC-NOTIF-A-001: View All Notifications
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view system notifications |
| **Steps** | 1. Navigate to Notifications |
| **Expected Result** | List of all notifications |
| **How to Verify** | All notifications shown |

---

# 9. ORGANIZATIONS

## 9.1 Teacher Organization Operations

### TC-ORG-T-001: Create Organization
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can create organization |
| **Steps** | 1. Navigate to Organizations 2. Click "Create Organization" 3. Enter name, slug 4. Submit |
| **Expected Result** | Organization created with status 'pending' |
| **How to Verify** | Organization appears in list |

### TC-ORG-T-002: View Organizations
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view their organizations |
| **Steps** | 1. Navigate to Organizations |
| **Expected Result** | List of organizations teacher belongs to |
| **How to Verify** | All memberships shown |

### TC-ORG-T-003: Select Active Organization
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can select organization |
| **Steps** | 1. Click "Select" on organization |
| **Expected Result** | Organization becomes active |
| **How to Verify** | Selected org banner shown |

### TC-ORG-T-004: Join via Invite Token
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can join via invite |
| **Steps** | 1. Navigate to Organizations 2. Click "Join via Invite" 3. Enter token |
| **Expected Result** | Added to organization |
| **How to Verify** | Organization appears in list |

### TC-ORG-T-005: View Pending Organization Status
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can see pending approval status |
| **Steps** | 1. Create organization 2. View pending status |
| **Expected Result** | Status shows 'pending', wait time shown |
| **How to Verify** | Pending approval page accessible |

### TC-ORG-T-006: Organization Approved
| Field | Value |
|-------|-------|
| **What to Test** | Organization becomes active after approval |
| **Steps** | 1. Admin approves org 2. Teacher views organizations |
| **Expected Result** | Status changes to 'active' |
| **How to Verify** | Can create classes in org |

---

## 9.2 Admin Organization Operations

### TC-ORG-A-001: View All Organizations
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view all organizations |
| **Steps** | 1. Navigate to Organizations |
| **Expected Result** | List of all organizations |
| **How to Verify** | All orgs shown |

### TC-ORG-A-002: View Organization Details
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view org details |
| **Steps** | 1. Click on organization |
| **Expected Result** | Details: name, status, members, classes |
| **How to Verify** | All info displayed |

### TC-ORG-A-003: View Pending Organization Approvals
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view pending approvals |
| **Steps** | 1. Navigate to Organization Approvals |
| **Expected Result** | List of pending organizations |
| **How to Verify** | All pending shown |

### TC-ORG-A-004: Approve Organization
| Field | Value |
|-------|-------|
| **What to Test** | Admin can approve organization |
| **Steps** | 1. Select pending org 2. Click Approve |
| **Expected Result** | Status changes to 'active' |
| **How to Verify** | Org shows as active |

### TC-ORG-A-005: Reject Organization
| Field | Value |
|-------|-------|
| **What to Test** | Admin can reject organization |
| **Steps** | 1. Select pending org 2. Enter reason 3. Click Reject |
| **Expected Result** | Organization rejected |
| **How to Verify** | Teacher notified |

### TC-ORG-A-006: Quick Approve from List
| Field | Value |
|-------|-------|
| **What to Test** | Can approve directly from org list |
| **Steps** | 1. Navigate to Organizations 2. Click Approve on pending org |
| **Expected Result** | Org approved |
| **How to Verify** | Status updated |

---

# 10. PROFILE MANAGEMENT

## 10.1 Teacher Profile

### TC-PROF-T-001: View Profile
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view profile |
| **Steps** | 1. Navigate to Settings |
| **Expected Result** | Display name, email, role shown |
| **How to Verify** | Info displayed |

### TC-PROF-T-002: View Selected Organization
| Field | Value |
|-------|-------|
| **What to Test** | Selected org shown in settings |
| **Steps** | 1. Navigate to Settings |
| **Expected Result** | Active organization displayed |
| **How to Verify** | Org name shown |

---

## 10.2 Student Profile

### TC-PROF-S-001: View Profile
| Field | Value |
|-------|-------|
| **What to Test** | Student can view profile |
| **Steps** | 1. Navigate to Profile |
| **Expected Result** | Display name, login, class memberships shown |
| **How to Verify** | All info displayed |

### TC-PROF-S-002: View Class Memberships
| Field | Value |
|-------|-------|
| **What to Test** | Student can see all enrolled classes |
| **Steps** | 1. Navigate to Profile |
| **Expected Result** | Table of classes with status, join date |
| **How to Verify** | All enrollments shown |

---

# 11. ADMIN OPERATIONS

## 11.1 Dashboard

### TC-ADMIN-001: View Dashboard Statistics
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view platform stats |
| **Steps** | 1. Navigate to Admin Dashboard |
| **Expected Result** | Counts: students, teachers, classes, organizations |
| **How to Verify** | Stats accurate |

### TC-ADMIN-002: View Pending Approvals Summary
| Field | Value |
|-------|-------|
| **What to Test** | Pending counts shown |
| **Steps** | 1. View dashboard |
| **Expected Result** | Pending orgs, materials, tests counts |
| **How to Verify** | Counts correct |

---

## 11.2 User Management

### TC-ADMIN-003: View All Teachers
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view teacher directory |
| **Steps** | 1. Navigate to Teachers |
| **Expected Result** | List of all teachers |
| **How to Verify** | All teachers shown |

### TC-ADMIN-004: View Teacher Details
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view teacher details |
| **Steps** | 1. Click on teacher |
| **Expected Result** | Details: memberships, classes |
| **How to Verify** | All info displayed |

### TC-ADMIN-005: View All Students
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view student directory |
| **Steps** | 1. Navigate to Students |
| **Expected Result** | List of all students |
| **How to Verify** | All students shown |

### TC-ADMIN-006: View Student Details
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view student details |
| **Steps** | 1. Click on student |
| **Expected Result** | Details: enrollments, memberships, submissions |
| **How to Verify** | All info displayed |

---

## 11.3 System Health

### TC-ADMIN-007: View System Overview
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view system status |
| **Steps** | 1. Navigate to System |
| **Expected Result** | Module health status |
| **How to Verify** | Status indicators shown |

### TC-ADMIN-008: View Detailed Health
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view detailed health |
| **Steps** | 1. Navigate to System > Health |
| **Expected Result** | Database latency, record counts |
| **How to Verify** | Metrics displayed |

---

# 12. CROSS-ROLE DATA VISIBILITY

## 12.1 Teacher-Student Visibility

### TC-VIS-TS-001: Teacher Sees Student Submissions
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view student submissions |
| **Steps** | 1. Student submits assignment 2. Teacher views reviews |
| **Expected Result** | Submission visible to teacher |
| **How to Verify** | Submission in review queue |

### TC-VIS-TS-002: Teacher Sees Student Test Results
| Field | Value |
|-------|-------|
| **What to Test** | Teacher can view test scores |
| **Steps** | 1. Student completes test 2. Teacher views gradebook |
| **Expected Result** | Test score visible |
| **How to Verify** | Score in gradebook |

### TC-VIS-TS-003: Student Cannot See Other Students
| Field | Value |
|-------|-------|
| **What to Test** | Student cannot view other students' data |
| **Steps** | 1. Login as student 2. Attempt to access other student's results |
| **Expected Result** | Access denied |
| **How to Verify** | Error or redirect |

### TC-VIS-TS-004: Student Sees Only Own Classes
| Field | Value |
|-------|-------|
| **What to Test** | Student sees only enrolled classes |
| **Steps** | 1. Student views classes |
| **Expected Result** | Only their enrolled classes |
| **How to Verify** | No other classes visible |

---

## 12.2 Teacher-Admin Visibility

### TC-VIS-TA-001: Admin Sees All Teachers
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view all teachers |
| **Steps** | 1. Admin views teacher directory |
| **Expected Result** | All teachers in system |
| **How to Verify** | Complete list |

### TC-VIS-TA-002: Teacher Cannot See Other Teachers' Private Content
| Field | Value |
|-------|-------|
| **What to Test** | Teachers cannot see others' personal materials |
| **Steps** | 1. Teacher A creates personal material 2. Teacher B attempts to view |
| **Expected Result** | Not visible to Teacher B |
| **How to Verify** | Material not in list |

### TC-VIS-TA-003: Teacher Sees School Library Content
| Field | Value |
|-------|-------|
| **What to Test** | All teachers see approved school content |
| **Steps** | 1. Material approved 2. All teachers in org can view |
| **Expected Result** | Material in school library for all |
| **How to Verify** | Visible to all org members |

---

## 12.3 Student-Admin Visibility

### TC-VIS-SA-001: Admin Sees All Students
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view all students |
| **Steps** | 1. Admin views student directory |
| **Expected Result** | All students in system |
| **How to Verify** | Complete list |

### TC-VIS-SA-002: Admin Sees Student Submissions
| Field | Value |
|-------|-------|
| **What to Test** | Admin can view any student's submissions |
| **Steps** | 1. Admin views student detail |
| **Expected Result** | Submission history visible |
| **How to Verify** | Submissions listed |

---

## 12.4 Organization Scoping

### TC-VIS-ORG-001: Teacher Sees Only Own Org Classes
| Field | Value |
|-------|-------|
| **What to Test** | Teacher sees only classes in their orgs |
| **Steps** | 1. Teacher views classes |
| **Expected Result** | Only classes from their organizations |
| **How to Verify** | No external classes |

### TC-VIS-ORG-002: Student Sees Only Own Org Content
| Field | Value |
|-------|-------|
| **What to Test** | Student sees only content from enrolled orgs |
| **Steps** | 1. Student views assignments |
| **Expected Result** | Only assignments from their classes |
| **How to Verify** | No external content |

### TC-VIS-ORG-003: Admin Sees All Organizations
| Field | Value |
|-------|-------|
| **What to Test** | Admin sees all organizations |
| **Steps** | 1. Admin views organizations |
| **Expected Result** | All organizations in system |
| **How to Verify** | Complete list |

---

# 13. EDGE CASES & ERROR HANDLING

## 13.1 Form Validation

### TC-EDGE-001: Required Field Validation
| Field | Value |
|-------|-------|
| **What to Test** | Forms validate required fields |
| **Steps** | 1. Submit form with empty required fields |
| **Expected Result** | Validation errors shown |
| **How to Verify** | Errors displayed |

### TC-EDGE-002: Min Length Validation
| Field | Value |
|-------|-------|
| **What to Test** | Min length enforced |
| **Steps** | 1. Enter title < 3 chars 2. Submit |
| **Expected Result** | Error shown |
| **How to Verify** | Form not submitted |

### TC-EDGE-003: Email Format Validation
| Field | Value |
|-------|-------|
| **What to Test** | Email format validated |
| **Steps** | 1. Enter invalid email 2. Submit |
| **Expected Result** | Error shown |
| **How to Verify** | Form not submitted |

### TC-EDGE-004: Password Match Validation
| Field | Value |
|-------|-------|
| **What to Test** | Password confirmation matches |
| **Steps** | 1. Enter different passwords in confirm field |
| **Expected Result** | Error shown |
| **How to Verify** | Form not submitted |

---

## 13.2 API Error Handling

### TC-EDGE-005: Network Error Handling
| Field | Value |
|-------|-------|
| **What to Test** | App handles network errors gracefully |
| **Steps** | 1. Disable network 2. Attempt action |
| **Expected Result** | Error message shown, no crash |
| **How to Verify** | User-friendly error |

### TC-EDGE-006: 404 Handling
| Field | Value |
|-------|-------|
| **What to Test** | Non-existent resources handled |
| **Steps** | 1. Navigate to non-existent page |
| **Expected Result** | 404 page or redirect |
| **How to Verify** | No crash |

### TC-EDGE-007: Unauthorized Access Handling
| Field | Value |
|-------|-------|
| **What to Test** | Unauthorized requests handled |
| **Steps** | 1. Attempt action without permission |
| **Expected Result** | Error or redirect |
| **How to Verify** | Graceful handling |

---

## 13.3 Concurrent Operations

### TC-EDGE-008: Concurrent Test Attempts
| Field | Value |
|-------|-------|
| **What to Test** | Multiple test attempts handled |
| **Steps** | 1. Open test in multiple tabs 2. Submit from both |
| **Expected Result** | Only one submission accepted |
| **How to Verify** | No duplicate submissions |

### TC-EDGE-009: Concurrent File Upload
| Field | Value |
|-------|-------|
| **What to Test** | Multiple file uploads handled |
| **Steps** | 1. Upload multiple files simultaneously |
| **Expected Result** | All uploads complete |
| **How to Verify** | All files uploaded |

---

# 14. UI/UX VERIFICATION

## 14.1 Navigation

### TC-UI-001: Sidebar Navigation Works
| Field | Value |
|-------|-------|
| **What to Test** | All sidebar links work |
| **Steps** | 1. Click each sidebar item |
| **Expected Result** | Correct page loads |
| **How to Verify** | URL and content correct |

### TC-UI-002: Active Navigation State
| Field | Value |
|-------|-------|
| **What to Test** | Current page highlighted in nav |
| **Steps** | 1. Navigate to page |
| **Expected Result** | Nav item highlighted |
| **How to Verify** | Visual indicator |

### TC-UI-003: Breadcrumb Navigation
| Field | Value |
|-------|-------|
| **What to Test** | Breadcrumbs work correctly |
| **Steps** | 1. Navigate to nested page 2. Click breadcrumb |
| **Expected Result** | Navigate to parent |
| **How to Verify** | Correct page loaded |

---

## 14.2 Responsive Design

### TC-UI-004: Mobile Layout
| Field | Value |
|-------|-------|
| **What to Test** | App works on mobile |
| **Steps** | 1. Resize to mobile width |
| **Expected Result** | Layout adapts |
| **How to Verify** | No horizontal scroll |

### TC-UI-005: Tablet Layout
| Field | Value |
|-------|-------|
| **What to Test** | App works on tablet |
| **Steps** | 1. Resize to tablet width |
| **Expected Result** | Layout adapts |
| **How to Verify** | Content accessible |

---

## 14.3 Loading States

### TC-UI-006: Loading Indicators
| Field | Value |
|-------|-------|
| **What to Test** | Loading states shown |
| **Steps** | 1. Trigger slow loading page |
| **Expected Result** | Loading indicator shown |
| **How to Verify** | Spinner/skeleton visible |

### TC-UI-007: Button Loading States
| Field | Value |
|-------|-------|
| **What to Test** | Buttons show loading during action |
| **Steps** | 1. Click submit button |
| **Expected Result** | Button shows loading state |
| **How to Verify** | Button disabled, spinner shown |

---

## 14.4 Empty States

### TC-UI-008: Empty Classes List
| Field | Value |
|-------|-------|
| **What to Test** | Empty state shown when no classes |
| **Steps** | 1. View classes with none created |
| **Expected Result** | Empty state with action |
| **How to Verify** | Message and CTA shown |

### TC-UI-009: Empty Assignments List
| Field | Value |
|-------|-------|
| **What to Test** | Empty state for no assignments |
| **Steps** | 1. View assignments with none |
| **Expected Result** | Empty state shown |
| **How to Verify** | Message displayed |

### TC-UI-010: Empty Notifications
| Field | Value |
|-------|-------|
| **What to Test** | Empty state for no notifications |
| **Steps** | 1. View notifications with none |
| **Expected Result** | Empty state shown |
| **How to Verify** | Message displayed |

---

# TEST EXECUTION SUMMARY

| Category | Test Count |
|----------|------------|
| Authentication | 24 |
| Class Management | 25 |
| Materials | 14 |
| Tests | 21 |
| Assignments | 23 |
| Grades | 13 |
| Reviews | 16 |
| Notifications | 18 |
| Organizations | 12 |
| Profile Management | 4 |
| Admin Operations | 8 |
| Cross-Role Visibility | 12 |
| Edge Cases | 9 |
| UI/UX | 10 |
| **TOTAL** | **209** |

---

## Test Execution Checklist

Use this checklist to track test execution progress:

- [ ] Authentication (24 tests)
- [ ] Class Management (25 tests)
- [ ] Materials (14 tests)
- [ ] Tests (21 tests)
- [ ] Assignments (23 tests)
- [ ] Grades (13 tests)
- [ ] Reviews (16 tests)
- [ ] Notifications (18 tests)
- [ ] Organizations (12 tests)
- [ ] Profile Management (4 tests)
- [ ] Admin Operations (8 tests)
- [ ] Cross-Role Visibility (12 tests)
- [ ] Edge Cases (9 tests)
- [ ] UI/UX (10 tests)

---

# TEST RESULTS LOG

| Test ID | Result | Notes |
|---------|--------|-------|
| TC-AUTH-T-001 | ✅ | Fixed - registration works, redirects to sign-in with success message |
| TC-AUTH-T-002 | ✅ | Works - teacher can login with correct credentials |
| TC-AUTH-T-003 | ✅ | Error shown when wrong password entered |
| TC-AUTH-T-004 | ✅ | Fixed - now shows proper error message |
| TC-AUTH-T-005 | ✅ | Logout works |
| TC-AUTH-T-006 | ✅ | Fixed - password change now works |
| TC-AUTH-T-007 | ✅ | Fixed - current password validation works |
| TC-AUTH-T-008 | ❌ | Password reset fails - email service not configured, shows error |
| TC-AUTH-T-009 | ✅ | Session expires after 8 hours, user redirected to login |
| TC-AUTH-T-010 | ⚠️ | Rate limit shows - need to verify button re-enables after 15 min timeout |
| TC-AUTH-S-001 | ✅ | Student login with valid PIN works |
| TC-AUTH-S-002 | ✅ | Invalid PIN shows error correctly |
| TC-AUTH-S-003 | ✅ | Non-existent login handled correctly |
| TC-AUTH-S-004 | ✅ | Student logout works |
| TC-AUTH-S-005 | ✅ | Student self-registration via join code works |
| TC-AUTH-S-006 | ⏭️ | Skipped |
| TC-AUTH-S-007 | ⏭️ | Skipped |
| TC-AUTH-A-001 | ⏭️ | Skipped |
| TC-AUTH-A-002 | ⏭️ | Skipped |
| TC-AUTH-X-001 | ✅ | Teacher redirected from student pages |
| TC-AUTH-X-002 | ✅ | Student redirected from teacher pages |
| TC-AUTH-X-003 | ⏭️ | Skipped |
| TC-AUTH-X-004 | ⏭️ | Skipped |
| TC-AUTH-X-005 | ✅ | Unauthenticated users redirected from protected routes |
| TC-CLASS-T-001 | ✅ | Create class works - fixed null organization check |
| TC-CLASS-T-002 | ✅ | No organization selected - shows proper empty state |
| TC-CLASS-T-003 | ✅ | View class details works |
| TC-CLASS-T-004 | ✅ | Update class title works |
| TC-CLASS-T-005 | ✅ | Update class description works |
| TC-CLASS-T-006 | ✅ | View class roster works |
| TC-CLASS-T-007 | ✅ | Add student manually works |
| TC-CLASS-T-008 | ✅ | Add student - duplicate login shows proper error |
| TC-CLASS-T-009 | ⏭️ | Skipped - feature not implemented |
| TC-CLASS-T-010 | ⏭️ | Skipped - feature not implemented |
| TC-CLASS-T-011 | ⏭️ | Skipped - feature not implemented |
| TC-CLASS-T-012 | ✅ | View join code works |
| TC-CLASS-T-013 | ✅ | Rotate join code works |
| TC-CLASS-T-014 | ✅ | Join code history works |
| TC-CLASS-T-015 | ✅ | Copy join code works |
| TC-CLASS-T-016 | ⏭️ | Skipped |
| TC-CLASS-S-001 | ✅ | View enrolled classes works |
| TC-CLASS-S-002 | ✅ | View class detail works |
| TC-CLASS-S-003 | ✅ | Join class via code for new student works |
| TC-CLASS-S-004 | ✅ | Join class via code for existing student works |
| TC-CLASS-S-005 | ✅ | Invalid join code shows error |
| TC-CLASS-S-006 | ✅ | Already enrolled join code shows correct message |
| TC-CLASS-S-007 | ✅ | Class assignments are visible and navigable |
| TC-CLASS-A-001 | ⏭️ | Skipped |
| TC-CLASS-A-002 | ⏭️ | Skipped |
| TC-MAT-T-001 | ✅ | Create personal material works |
| TC-MAT-T-002 | ✅ | Upload file for material works |
| TC-MAT-T-003 | ✅ | View personal materials works |
| TC-MAT-T-004 | ✅ | Edit material title works |
| TC-MAT-T-005 | ✅ | Edit material description works |
| TC-MAT-T-006 | ✅ | Submit material to school library works |
| TC-MAT-T-007 | ⏳ | |
| TC-MAT-T-008 | ⏳ | |
| TC-MAT-T-009 | ⏳ | |
| TC-MAT-T-010 | ⏳ | |
| TC-MAT-A-001 | ✅ | View pending material approvals works |
| TC-MAT-A-002 | ✅ | Approve material works - fixed NEXT_REDIRECT error in server action |
| TC-MAT-A-003 | ✅ | Reject material with reason works |
| TC-MAT-A-004 | ⏳ | |
| TC-TEST-T-001 | ✅ | Create manual test works |
| TC-TEST-T-002 | ✅ | Add question to test works |
| TC-TEST-T-003 | ✅ | Edit question works |
| TC-TEST-T-004 | ✅ | Delete question works |
| TC-TEST-T-005 | ⏳ | |
| TC-TEST-T-006 | ⏳ | |
| TC-TEST-T-007 | ✅ | Submit test to school approval works |
| TC-TEST-T-008 | ✅ | View test status works |
| TC-TEST-T-009 | ⚠️ | School test library list works, but tests cannot be opened for viewing |
| TC-TEST-T-010 | ✅ | Link test to assignment works |
| TC-TEST-A-001 | ⏳ | |
| TC-TEST-A-002 | ✅ | Approve test works |
| TC-TEST-A-003 | ⏳ | |
| TC-TEST-S-001 | ⏳ | |
| TC-TEST-S-002 | ⏳ | |
| TC-TEST-S-003 | ⏳ | |
| TC-TEST-S-004 | ⏳ | |
| TC-TEST-S-005 | ⏳ | |
| TC-TEST-S-006 | ⏳ | |
| TC-TEST-S-007 | ⏳ | |
| TC-TEST-S-008 | ⏳ | |
| TC-ASGN-T-001 | ✅ | Create assignment template works |
| TC-ASGN-T-002 | ✅ | Link materials to template works |
| TC-ASGN-T-003 | ✅ | Link tests to template works |
| TC-ASGN-T-004 | ⏳ | |
| TC-ASGN-T-005 | ✅ | Publish assignment to classes works |
| TC-ASGN-T-006 | ✅ | Publish to multiple classes works |
| TC-ASGN-T-007 | ⏳ | |
| TC-ASGN-T-008 | ✅ | View publications works |
| TC-ASGN-T-009 | ✅ | View publication details works |
| TC-ASGN-T-010 | ⏳ | |
| TC-ASGN-S-001 | ✅ | Student assignments list shows all published assignments with status, deadline, and links |
| TC-ASGN-S-002 | ✅ | Student filter tabs work (All/Active/Overdue/Completed/Reviewed). Teacher filter also added |
| TC-ASGN-S-003 | ✅ | Student assignment detail page shows title, description, deadline, linked content |
| TC-ASGN-S-004 | ✅ | Materials shown inline on assignment detail page (no separate page needed for students) |
| TC-ASGN-S-005 | ✅ | Upload practical work works |
| TC-ASGN-S-006 | ✅ | Invalid file types rejected with error message |
| TC-ASGN-S-007 | ⏭️ | Skipped — no large file available to test |
| TC-ASGN-S-008 | ✅ | File replacement allowed before deadline, even after initial submission |
| TC-ASGN-S-009 | ✅ | Submit flow: upload → init → signed-url upload → complete → submit API → success screen |
| TC-ASGN-S-010 | ✅ | StatusChip shows all 5 statuses (not_started/in_progress/submitted/reviewed/released) on detail + list page |
| TC-ASGN-S-011 | ✅ | formatDeadline() shows countdown: "Due in N days/hours", "Due soon", red styling when urgent |
| TC-ASGN-S-012 | ✅ | Overdue Badge + red text on detail page; isOverdue() filter tab on list page |
| TC-ASGN-A-001 | ⏳ | |
| TC-GRD-T-001 | ⏳ | |
| TC-GRD-T-002 | ⏳ | |
| TC-GRD-T-003 | ⏳ | |
| TC-GRD-T-004 | ⏳ | |
| TC-GRD-T-005 | ⏳ | |
| TC-GRD-T-006 | ⏳ | |
| TC-GRD-T-007 | ⏳ | |
| TC-GRD-T-008 | ⏳ | |
| TC-GRD-S-001 | ⏳ | |
| TC-GRD-S-002 | ⏳ | |
| TC-GRD-S-003 | ⏳ | |
| TC-GRD-S-004 | ⏳ | |
| TC-GRD-S-005 | ⏳ | |
| TC-REV-T-001 | ⏳ | |
| TC-REV-T-002 | ⏳ | |
| TC-REV-T-003 | ⏳ | |
| TC-REV-T-004 | ⏳ | |
| TC-REV-T-005 | ⏳ | |
| TC-REV-T-006 | ⏳ | |
| TC-REV-T-007 | ⏳ | |
| TC-REV-T-008 | ⏳ | |
| TC-REV-T-009 | ⏳ | |
| TC-REV-T-010 | ⏳ | |
| TC-REV-T-011 | ⏳ | |
| TC-REV-T-012 | ⏳ | |
| TC-REV-S-001 | ⏳ | |
| TC-REV-S-002 | ⏳ | |
| TC-REV-S-003 | ⏳ | |
| TC-REV-S-004 | ⏳ | |
| TC-NOTIF-T-001 | ⏳ | |
| TC-NOTIF-T-002 | ⏳ | |
| TC-NOTIF-T-003 | ⏳ | |
| TC-NOTIF-T-004 | ⏳ | |
| TC-NOTIF-T-005 | ⏳ | |
| TC-NOTIF-T-006 | ⏳ | |
| TC-NOTIF-T-007 | ⏳ | |
| TC-NOTIF-T-008 | ⏳ | |
| TC-NOTIF-T-009 | ⏳ | |
| TC-NOTIF-T-010 | ⏳ | |
| TC-NOTIF-S-001 | ⏳ | |
| TC-NOTIF-S-002 | ⏳ | |
| TC-NOTIF-S-003 | ⏳ | |
| TC-NOTIF-S-004 | ⏳ | |
| TC-NOTIF-S-005 | ⏳ | |
| TC-NOTIF-S-006 | ⏳ | |
| TC-NOTIF-S-007 | ⏳ | |
| TC-NOTIF-A-001 | ⏳ | |
| TC-ORG-T-001 | ⏳ | |
| TC-ORG-T-002 | ⏳ | |
| TC-ORG-T-003 | ⏳ | |
| TC-ORG-T-004 | ⏳ | |
| TC-ORG-T-005 | ⏳ | |
| TC-ORG-T-006 | ⏳ | |
| TC-ORG-A-001 | ⏳ | |
| TC-ORG-A-002 | ⏳ | |
| TC-ORG-A-003 | ⏳ | |
| TC-ORG-A-004 | ⏳ | |
| TC-ORG-A-005 | ⏳ | |
| TC-ORG-A-006 | ⏳ | |
| TC-PROF-T-001 | ⏳ | |
| TC-PROF-T-002 | ⏳ | |
| TC-PROF-S-001 | ⏳ | |
| TC-PROF-S-002 | ⏳ | |
| TC-ADMIN-001 | ⏳ | |
| TC-ADMIN-002 | ⏳ | |
| TC-ADMIN-003 | ⏳ | |
| TC-ADMIN-004 | ⏳ | |
| TC-ADMIN-005 | ⏳ | |
| TC-ADMIN-006 | ⏳ | |
| TC-ADMIN-007 | ⏳ | |
| TC-ADMIN-008 | ⏳ | |
| TC-VIS-TS-001 | ⏳ | |
| TC-VIS-TS-002 | ⏳ | |
| TC-VIS-TS-003 | ⏳ | |
| TC-VIS-TS-004 | ⏳ | |
| TC-VIS-TA-001 | ⏳ | |
| TC-VIS-TA-002 | ⏳ | |
| TC-VIS-TA-003 | ⏳ | |
| TC-VIS-SA-001 | ⏳ | |
| TC-VIS-SA-002 | ⏳ | |
| TC-VIS-ORG-001 | ⏳ | |
| TC-VIS-ORG-002 | ⏳ | |
| TC-VIS-ORG-003 | ⏳ | |
| TC-EDGE-001 | ⏳ | |
| TC-EDGE-002 | ⏳ | |
| TC-EDGE-003 | ⏳ | |
| TC-EDGE-004 | ⏳ | |
| TC-EDGE-005 | ⏳ | |
| TC-EDGE-006 | ⏳ | |
| TC-EDGE-007 | ⏳ | |
| TC-EDGE-008 | ⏳ | |
| TC-EDGE-009 | ⏳ | |
| TC-UI-001 | ⏳ | |
| TC-UI-002 | ⏳ | |
| TC-UI-003 | ⏳ | |
| TC-UI-004 | ⏳ | |
| TC-UI-005 | ⏳ | |
| TC-UI-006 | ⏳ | |
| TC-UI-007 | ⏳ | |
| TC-UI-008 | ⏳ | |
| TC-UI-009 | ⏳ | |
| TC-UI-010 | ⏳ | |

---

## Summary

| Status | Count |
|--------|-------|
| ✅ PASSED | 72 |
| ❌ FAILED | 1 |
| ⚠️ PARTIAL | 2 |
| ⏭️ SKIPPED | 13 |
| ⏳ PENDING | 121 |
| **Total** | 209 |
