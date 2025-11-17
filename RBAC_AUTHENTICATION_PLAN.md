# RBAC & JWT Authentication Implementation Plan

## Overview
Implement Role-Based Access Control (RBAC) with JWT authentication for staff members. Add role and password fields to Staff model, create login system, and protect routes based on roles.

---

## 1. Current Structure Analysis

### 1.1 Backend Structure
- **Models**: `backend/models/Staff.js` - No role or password fields
- **Controllers**: `backend/controllers/staffController.js` - No authentication logic
- **Routes**: `backend/routes/staffRoutes.js` - All routes are public
- **Server**: `backend/server.js` - No authentication middleware
- **Dependencies**: No JWT or bcrypt libraries installed

### 1.2 Frontend Structure
- **Staff Form**: `glamour-pro-forge/src/components/Staff/AddStaffDialog.tsx` - No role or password fields
- **API Service**: `glamour-pro-forge/src/services/api.ts` - No auth API functions
- **App Router**: `glamour-pro-forge/src/App.tsx` - No protected routes, Login page exists but not implemented
- **Login Page**: `glamour-pro-forge/src/pages/Login.tsx` - Exists but needs implementation

### 1.3 Key Observations
- All routes are currently public (no authentication)
- No password hashing mechanism
- No JWT token generation/validation
- No role-based access control
- Login page exists but is not functional
- Manager role should be created via seed script only

---

## 2. Technology Stack

### Backend Dependencies to Install
```json
{
  "jsonwebtoken": "^9.0.2",        // JWT token generation and verification
  "bcryptjs": "^2.4.3",            // Password hashing
  "express-validator": "^7.0.1"   // Input validation (optional)
}
```

### Frontend Dependencies (Already Available)
- React Router - For protected routes
- React Query - For API calls
- Local Storage / Session Storage - For token storage

---

## 3. Database Schema Changes

### 3.1 Staff Model Updates
**File**: `backend/models/Staff.js`

**New Fields to Add**:
```javascript
{
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['therapist', 'receptionist', 'manager'],
      message: 'Role must be therapist, receptionist, or manager'
    },
    default: 'therapist'
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false  // Don't include password in queries by default
  }
}
```

**Indexes to Add**:
```javascript
staffSchema.index({ phone: 1 }); // Already exists (unique)
staffSchema.index({ role: 1 });   // For role-based queries
```

**Methods to Add**:
```javascript
// Compare password method
staffSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token method
staffSchema.methods.generateToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};
```

---

## 4. Backend Implementation

### 4.1 Authentication Controller
**File**: `backend/controllers/authController.js` (NEW)

**Functions to Implement**:
1. **`login`** - Staff login
   - Validate phone and password
   - Find staff by phone
   - Check if staff exists and is active
   - Compare password
   - Generate JWT token
   - Return token and staff data (without password)

2. **`register`** - Staff registration (optional, for future use)
   - Hash password
   - Create staff member
   - Generate token
   - Return token and staff data

3. **`getMe`** - Get current logged-in staff
   - Extract token from request
   - Verify token
   - Find staff by ID
   - Return staff data

4. **`updatePassword`** - Update staff password
   - Verify current password
   - Hash new password
   - Update password in database

5. **`logout`** - Logout (optional, token-based auth doesn't need server-side logout)
   - Could be handled on frontend by removing token

### 4.2 Authentication Middleware
**File**: `backend/middleware/authMiddleware.js` (NEW)

**Functions to Implement**:
1. **`protect`** - Protect routes (require authentication)
   - Extract token from Authorization header
   - Verify JWT token
   - Find staff by ID from token
   - Check if staff is active
   - Attach staff to request object
   - Call next() or return error

2. **`authorize`** - Role-based authorization
   - Check if staff role matches required roles
   - Accept single role or array of roles
   - Return error if unauthorized

**Usage Example**:
```javascript
// Protect route
router.get('/protected', protect, controllerFunction);

// Protect and authorize by role
router.get('/admin-only', protect, authorize('manager'), controllerFunction);
router.get('/staff-only', protect, authorize(['therapist', 'receptionist', 'manager']), controllerFunction);
```

### 4.3 Staff Controller Updates
**File**: `backend/controllers/staffController.js`

**Changes**:
1. **`createStaff`**:
   - Hash password before saving
   - Validate role (prevent creating manager role)
   - Exclude password from response
   - Set default role to 'therapist' if not provided

2. **`updateStaff`**:
   - If password is provided, hash it before updating
   - Prevent role change to 'manager' (only via seed)
   - Exclude password from response

3. **`getAllStaff`**:
   - Exclude password from response (already done via select)
   - Optionally filter by role

4. **`getStaffById`**:
   - Exclude password from response

5. **`deleteStaff`**:
   - Prevent deleting manager (optional security measure)

### 4.4 Authentication Routes
**File**: `backend/routes/authRoutes.js` (NEW)

**Routes**:
```javascript
POST   /api/auth/login          - Staff login
GET    /api/auth/me             - Get current staff (protected)
PUT    /api/auth/update-password - Update password (protected)
POST   /api/auth/logout         - Logout (optional)
```

### 4.5 Staff Routes Updates
**File**: `backend/routes/staffRoutes.js`

**Changes**:
- Add `protect` middleware to all routes (or specific routes)
- Add `authorize` middleware where needed
- Example:
  ```javascript
  router.route('/')
    .get(protect, getAllStaff)
    .post(protect, authorize('manager'), createStaff); // Only manager can create staff
  ```

### 4.6 Server Updates
**File**: `backend/server.js`

**Changes**:
1. Add auth routes:
   ```javascript
   const authRoutes = require('./routes/authRoutes');
   app.use('/api/auth', authRoutes);
   ```

2. Add environment variables loading:
   ```javascript
   require('dotenv').config();
   ```

3. (Optional) Add global error handler for authentication errors

### 4.7 Environment Variables
**File**: `backend/.env` (NEW or UPDATE)

**Variables**:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
NODE_ENV=development
```

---

## 5. Seed Script for Manager

### 5.1 Manager Seed Script
**File**: `backend/scripts/seed-manager.js` (NEW)

**Purpose**: Create initial manager account manually

**Features**:
- Check if manager already exists
- Create manager with role 'manager'
- Hash password
- Set all required fields
- Log success/failure

**Usage**:
```bash
node backend/scripts/seed-manager.js
```

**Example Data**:
```javascript
{
  name: "Admin Manager",
  phone: "+923001234567",
  email: "manager@glamourpro.com",
  password: "Admin@123", // Will be hashed
  role: "manager",
  hireDate: new Date(),
  referralCommission: 0,
  paidLeaves: 0,
  specialization: "Massage & Spa", // Default
  status: "Active",
  dailyWage: 0
}
```

---

## 6. Frontend Implementation

### 6.1 Authentication API Service
**File**: `glamour-pro-forge/src/services/api.ts`

**New Interfaces**:
```typescript
export interface LoginData {
  phone: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  data: Staff; // Staff without password
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}
```

**New API Functions**:
```typescript
export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => { ... },
  getMe: async (): Promise<Staff> => { ... },
  updatePassword: async (data: UpdatePasswordData): Promise<void> => { ... },
  logout: async (): Promise<void> => { ... }
};
```

### 6.2 Auth Context
**File**: `glamour-pro-forge/src/contexts/AuthContext.tsx` (NEW)

**Purpose**: Manage authentication state globally

**State**:
- `user: Staff | null` - Current logged-in staff
- `token: string | null` - JWT token
- `isAuthenticated: boolean` - Auth status
- `isLoading: boolean` - Loading state
- `role: 'therapist' | 'receptionist' | 'manager' | null` - User role

**Functions**:
- `login(phone, password)` - Login function
- `logout()` - Logout function
- `updateUser(user)` - Update user data
- `checkAuth()` - Check if user is authenticated (on app load)

**Token Storage**: Use `localStorage` 

### 6.3 Protected Route Component
**File**: `glamour-pro-forge/src/components/Auth/ProtectedRoute.tsx` (NEW)

**Purpose**: Protect routes based on authentication and roles

**Props**:
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'therapist' | 'receptionist' | 'manager' | ('therapist' | 'receptionist' | 'manager')[];
  redirectTo?: string;
}
```

**Logic**:
- Check if user is authenticated
- If not authenticated, redirect to `/login`
- If role required, check user role
- If role doesn't match, show unauthorized message or redirect
- If authenticated and authorized, render children

### 6.4 Login Page Implementation
**File**: `glamour-pro-forge/src/pages/Login.tsx`

**Features**:
- Phone number input
- Password input (with show/hide toggle)
- Login button
- Error handling
- Loading state
- Redirect to dashboard on success
- Remember me option (optional)

**Form Validation**:
- Phone: Required, valid format
- Password: Required, min 6 characters

### 6.5 Staff Form Updates
**File**: `glamour-pro-forge/src/components/Staff/AddStaffDialog.tsx`

**Changes**:
1. **Add Role Field**:
   - Select dropdown with options: 'therapist', 'receptionist'
   - Hide 'manager' option (not selectable)
   - Default to 'therapist'
   - Required field

2. **Add Password Field**:
   - Password input (with show/hide toggle)
   - Required for new staff (not required for edit)
   - Min 6 characters validation
   - Confirm password field (optional, for better UX)
   - In edit mode: Show "Change Password" section (optional)

3. **Form Validation**:
   - Role: Required, must be 'therapist' or 'receptionist'
   - Password: Required for new staff, min 6 characters
   - Password confirmation: Must match password (if implemented)

4. **API Updates**:
   - Include `role` and `password` in `CreateStaffData` interface
   - Update `staffApi.create` to send role and password
   - Update `staffApi.update` to handle password updates

### 6.6 API Service Updates
**File**: `glamour-pro-forge/src/services/api.ts`

**Changes**:
1. **Update Staff Interface**:
   ```typescript
   export interface Staff {
     // ... existing fields
     role: 'therapist' | 'receptionist' | 'manager';
     // password is NOT included in interface (never sent from backend)
   }
   ```

2. **Update CreateStaffData**:
   ```typescript
   export interface CreateStaffData {
     // ... existing fields
     role: 'therapist' | 'receptionist';
     password: string;
   }
   ```

3. **Add Token to Requests**:
   - Create axios instance or fetch wrapper
   - Add Authorization header to all requests
   - Handle token expiration (401 errors)
   - Auto-logout on 401

### 6.7 App Router Updates
**File**: `glamour-pro-forge/src/App.tsx`

**Changes**:
1. Wrap app with `AuthProvider`
2. Protect routes with `ProtectedRoute`
3. Add role-based route protection where needed
4. Redirect to login if not authenticated

**Example**:
```typescript
<Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
  <Route path="/" element={<Dashboard />} />
  <Route path="/staff" element={<ProtectedRoute requiredRole="manager"><Staff /></ProtectedRoute>} />
  // ... other routes
</Route>
```

### 6.8 MainLayout Updates
**File**: `glamour-pro-forge/src/components/Layout/MainLayout.tsx`

**Changes**:
1. Display logged-in user info
2. Add logout button
3. Show role badge
4. Conditionally show/hide menu items based on role

---

## 7. Role-Based Access Control (RBAC)

### 7.1 Role Permissions Matrix

| Feature | Therapist | Receptionist | Manager |
|---------|-----------|--------------|---------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Clients | ✅ | ✅ | ✅ |
| Create/Edit Clients | ❌ | ✅ | ✅ |
| Delete Clients | ❌ | ❌ | ✅ |
| View Appointments | ✅ | ✅ | ✅ |
| Create/Edit Appointments | ❌ | ✅ | ✅ |
| Delete Appointments | ❌ | ❌ | ✅ |
| View Services | ✅ | ✅ | ✅ |
| Create/Edit Services | ❌ | ❌ | ✅ |
| View Staff | ✅ | ✅ | ✅ |
| Create/Edit Staff | ❌ | ❌ | ✅ |
| Delete Staff | ❌ | ❌ | ✅ |
| View Payments | ✅ | ✅ | ✅ |
| Create/Edit Payments | ❌ | ✅ | ✅ |
| Generate Bills | ❌ | ✅ | ✅ |
| View Reports | ❌ | ✅ | ✅ |
| View Settings | ❌ | ❌ | ✅ |
| Chat | ✅ | ✅ | ✅ |

**Note**: This is a suggested matrix. Adjust based on business requirements. (leave applying middleware for now )

### 7.2 Implementation Strategy

1. **Backend**: Use `authorize` middleware on routes
2. **Frontend**: Use `ProtectedRoute` with `requiredRole` prop
3. **UI**: Conditionally show/hide buttons and menu items based on role
4. **API**: Backend validates role even if frontend is bypassed

---

## 8. Security Considerations

### 8.1 Password Security
- **Hashing**: Use `bcryptjs` with salt rounds (10-12)
- **Minimum Length**: 6 characters (can be increased)
- **Password Reset**: Implement password reset flow (future)
- **Password Strength**: Add validation for strong passwords (optional)

### 8.2 JWT Security
- **Secret Key**: Use strong, random secret key
- **Expiration**: Set reasonable expiration (7 days default)
- **Token Storage**: Use `httpOnly` cookies (more secure) or `localStorage` (easier)
- **Token Refresh**: Implement refresh token mechanism (optional, for future)

### 8.3 Route Protection
- **Backend**: Always validate token and role on server
- **Frontend**: Protect routes but don't rely solely on frontend
- **API Calls**: Include token in all authenticated requests

### 8.4 Manager Role Protection
- **Creation**: Only via seed script
- **Update**: Prevent role change to/from manager via form
- **Deletion**: Prevent deleting manager account (optional)

---

## 9. Implementation Phases

### Phase 1: Backend Foundation
1. Install dependencies (`jsonwebtoken`, `bcryptjs`)
2. Update Staff model with `role` and `password` fields
3. Add password hashing and JWT methods to Staff model
4. Create authentication controller (`authController.js`)
5. Create authentication middleware (`authMiddleware.js`)
6. Create authentication routes (`authRoutes.js`)
7. Update staff controller to handle password and role
8. Add role validation (prevent manager creation)
9. Update server.js to include auth routes
10. Create seed script for manager
11. Test authentication endpoints

### Phase 2: Frontend Authentication
1. Create AuthContext for state management
2. Implement Login page
3. Add authentication API functions
4. Update API service to include token in requests
5. Handle token storage and retrieval
6. Implement auto-logout on token expiration
7. Test login flow

### Phase 3: Route Protection
1. Create ProtectedRoute component
2. Update App.tsx with route protection
3. Add role-based route protection
4. Update MainLayout with user info and logout
5. Test route protection

### Phase 4: Staff Form Updates
1. Add role field to AddStaffDialog
2. Add password field to AddStaffDialog
3. Update Staff interface in api.ts
4. Update form validation
5. Test staff creation with role and password

### Phase 5: RBAC Implementation
1. Add role-based access control to backend routes
2. Add role-based UI restrictions (hide/show buttons)
3. Test role-based access
4. Update all routes with appropriate protection

### Phase 6: Testing & Polish
1. Test all authentication flows
2. Test role-based access
3. Test password updates
4. Test manager seed script
5. Fix any bugs
6. Add error handling improvements
7. Add loading states
8. Update documentation

---

## 10. File Structure

### Backend (New Files)
```
backend/
├── controllers/
│   └── authController.js          (NEW)
├── middleware/
│   └── authMiddleware.js           (NEW)
├── routes/
│   └── authRoutes.js               (NEW)
├── scripts/
│   └── seed-manager.js             (NEW)
├── models/
│   └── Staff.js                    (UPDATED)
└── .env                            (NEW/UPDATE)
```

### Frontend (New Files)
```
glamour-pro-forge/src/
├── contexts/
│   └── AuthContext.tsx             (NEW)
├── components/
│   ├── Auth/
│   │   └── ProtectedRoute.tsx     (NEW)
│   └── Staff/
│       └── AddStaffDialog.tsx     (UPDATED)
├── pages/
│   └── Login.tsx                   (UPDATED)
├── services/
│   └── api.ts                      (UPDATED)
└── App.tsx                         (UPDATED)
```

---

## 11. Environment Variables

### Backend (.env)
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRE=7d

# Database (if not already set)
MONGODB_URI=mongodb://localhost:27017/glamour-pro

# Server
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_URL=http://localhost:3000
```

---

## 12. Testing Checklist

### Backend Testing
- [ ] Staff model saves password as hash
- [ ] Staff model generates JWT token
- [ ] Login endpoint validates credentials
- [ ] Login endpoint returns token
- [ ] Protected routes require token
- [ ] Role-based authorization works
- [ ] Manager cannot be created via form
- [ ] Password is excluded from responses
- [ ] Seed script creates manager successfully

### Frontend Testing
- [ ] Login page works
- [ ] Token is stored after login
- [ ] Token is included in API requests
- [ ] Protected routes redirect to login
- [ ] Role-based routes show/hide correctly
- [ ] Logout clears token and redirects
- [ ] Staff form includes role and password
- [ ] Staff form prevents manager role selection
- [ ] Password field works correctly
- [ ] Auto-logout on token expiration

### Integration Testing
- [ ] Full login flow works
- [ ] Role-based access works end-to-end
- [ ] Staff creation with role and password works
- [ ] Password update works
- [ ] Manager seed script works

---

## 13. Migration Strategy

### For Existing Staff Data
1. **Add Default Role**: Update all existing staff to have `role: 'therapist'` (or appropriate default)
2. **Add Default Password**: Set a temporary password for existing staff (e.g., "Temp@123")
3. **Force Password Reset**: Require password change on first login (optional, for future)
4. **Migration Script**: Create script to update existing staff records

**Migration Script Example** (`backend/scripts/migrate-staff-auth.js`):
```javascript
// Add role and temporary password to existing staff
// Run once to migrate existing data
```

---

## 14. Future Enhancements (Optional)

1. **Password Reset**: Email-based password reset
2. **Two-Factor Authentication**: 2FA for additional security
3. **Session Management**: Track active sessions
4. **Password History**: Prevent reusing old passwords
5. **Account Lockout**: Lock account after failed login attempts
6. **Audit Logging**: Log all authentication events
7. **Refresh Tokens**: Implement refresh token mechanism
8. **Remember Me**: Extended session for "remember me" option
9. **Role Permissions**: Granular permissions system (beyond roles)
10. **Multi-factor Authentication**: SMS/Email verification

---

## 15. Notes

- **Manager Role**: Can only be created via seed script, not through the form
- **Password Hashing**: Always hash passwords before saving to database
- **Token Expiration**: Set reasonable expiration time (7 days default)
- **Role Validation**: Always validate role on backend, don't trust frontend
- **Security First**: Backend validation is critical, frontend is for UX only
- **Testing**: Test all authentication flows thoroughly before deployment
- **Migration**: Plan migration strategy for existing staff data

---

## 16. Questions to Consider

1. **Password Policy**: What's the minimum password length? Any complexity requirements?
2. **Token Expiration**: How long should tokens be valid? (7 days suggested)
3. **Remember Me**: Should we implement "remember me" functionality?
4. **Password Reset**: Do we need password reset functionality now or later?
5. **Role Permissions**: Are the suggested role permissions correct for your business?
6. **Existing Staff**: How should we handle existing staff without passwords?
7. **Manager Account**: What should be the default manager credentials?
8. **Session Management**: Should we track active sessions?
9. **Audit Logging**: Do we need to log authentication events?
10. **Multi-tenant**: Is this a single business or multi-tenant system?

---

This plan provides a comprehensive roadmap for implementing RBAC and JWT authentication. You can use this as a guide to implement the feature step by step.

