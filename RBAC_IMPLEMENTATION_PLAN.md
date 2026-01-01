# Role-Based Access Control (RBAC) Implementation Plan

## Overview
Implement granular permissions for three user roles: Therapist, Receptionist, and Manager.

---

## Backend Implementation

### 1. Route Protection with Authorize Middleware

#### Routes to Protect:
- **Client Routes** (`/api/clients`)
  - GET `/` - Receptionist, Manager only
  - POST `/` - Receptionist, Manager only
  - GET `/:id` - Receptionist, Manager only (Therapist: no access)
  - PUT `/:id` - Receptionist, Manager only
  - DELETE `/:id` - Manager only

- **Appointment Routes** (`/api/appointments`)
  - GET `/` - All roles (filtered by role)
  - POST `/` - Receptionist, Manager only (Therapist: read-only)
  - GET `/:id` - All roles (filtered by role)
  - PUT `/:id` - Receptionist, Manager only
  - DELETE `/:id` - Manager only

- **Staff Routes** (`/api/staff`)
  - GET `/` - Manager only (Therapist: only self)
  - POST `/` - Manager only
  - GET `/:id` - Manager only (Therapist: only self)
  - PUT `/:id` - Manager only (Therapist: only self, limited fields)
  - DELETE `/:id` - Manager only

- **Dashboard Routes** (`/api/dashboard`)
  - Revenue endpoints - Manager only
  - Statistics endpoints - All roles (filtered data)

- **Leave Routes** (`/api/leaves`)
  - GET `/` - All roles (filtered by role)
  - POST `/` - All roles (Therapist: request only)
  - PUT `/:id/approve` - Manager only
  - DELETE `/:id` - Manager only

- **Attendance Routes** (`/api/attendance`)
  - All routes - Receptionist, Manager only

- **Salary Routes** (`/api/monthly-salary`)
  - All routes - Receptionist, Manager only

- **POS Routes** (`/api/payments`)
  - All routes - Receptionist, Manager only

- **Business Settings** (`/api/business-settings`)
  - All routes - Manager only

- **Reports Routes** (`/api/reports`)
  - Revenue reports - Manager only
  - Service statistics - All roles (filtered)

### 2. Controller Modifications

#### Client Controller:
- Filter client data for Therapist:
  - Remove phone numbers
  - Remove names (show as "Client #ID" or anonymized)
  - Show only count and statistics
- Receptionist/Manager: Full access

#### Appointment Controller:
- Therapist: Only appointments where `staffId === req.staff._id`
- Receptionist/Manager: All appointments

#### Staff Controller:
- Therapist: Only return their own data
- Manager: All staff data

#### Dashboard Controller:
- Therapist: No revenue data, only service statistics
- Receptionist/Manager: Full dashboard access

#### Leave Controller:
- Therapist: Can only create requests, cannot approve
- Manager: Full access

---

## Frontend Implementation

### 1. Route Protection

#### App.tsx Route Configuration:
```typescript
// Manager only
<Route path="/settings" element={<ProtectedRoute requiredRole="manager"><Settings /></ProtectedRoute>} />
<Route path="/staff" element={<ProtectedRoute requiredRole="manager"><Staff /></ProtectedRoute>} />

// Receptionist & Manager
<Route path="/clients" element={<ProtectedRoute requiredRole={['receptionist', 'manager']}><Clients /></ProtectedRoute>} />
<Route path="/pos" element={<ProtectedRoute requiredRole={['receptionist', 'manager']}><POS /></ProtectedRoute>} />
<Route path="/attendance" element={<ProtectedRoute requiredRole={['receptionist', 'manager']}><Attendance /></ProtectedRoute>} />
<Route path="/salary" element={<ProtectedRoute requiredRole={['receptionist', 'manager']}><Salary /></ProtectedRoute>} />

// All roles (with conditional rendering)
<Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
<Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
```

### 2. Component Modifications

#### Clients.tsx:
- Hide entire page for Therapist
- Show anonymized data if accidentally accessed

#### Appointments.tsx:
- Therapist: 
  - Hide "Create Appointment" button
  - Filter to show only their appointments
  - Read-only view
- Receptionist/Manager: Full access

#### Staff.tsx:
- Therapist: Redirect to profile view or show only self
- Manager: Full access

#### Dashboard.tsx:
- Therapist: Hide revenue cards, show only statistics
- Receptionist/Manager: Full dashboard

#### Leaves.tsx:
- Therapist: Hide "Approve" buttons, show only "Request Leave"
- Manager: Full access with approval buttons

#### POS.tsx:
- Hide for Therapist
- Full access for Receptionist/Manager

#### Settings.tsx:
- Manager only

### 3. Utility Hooks

Create `useRoleAccess.ts` hook:
```typescript
export const useRoleAccess = () => {
  const { role } = useAuth();
  
  return {
    isManager: role === 'manager',
    isReceptionist: role === 'receptionist',
    isTherapist: role === 'therapist',
    canManageClients: role === 'receptionist' || role === 'manager',
    canManageAppointments: role === 'receptionist' || role === 'manager',
    canViewRevenue: role === 'manager',
    canManageStaff: role === 'manager',
    canApproveLeaves: role === 'manager',
  };
};
```

### 4. Navigation/Sidebar

- Hide menu items based on role
- Show only accessible routes

---

## Implementation Steps

### Phase 1: Backend Route Protection
1. Add `authorize` middleware to all routes
2. Test route access with different roles

### Phase 2: Backend Controller Filtering
1. Modify controllers to filter data based on role
2. Implement data anonymization for Therapist
3. Test API responses for each role

### Phase 3: Frontend Route Protection
1. Update App.tsx with role-based routes
2. Test route access

### Phase 4: Frontend Component Updates
1. Add conditional rendering in components
2. Hide/show buttons and features based on role
3. Implement data filtering on frontend

### Phase 5: Testing
1. Test each role's access
2. Verify data filtering
3. Test edge cases

---

## Security Considerations

1. **Never trust frontend alone** - Always validate on backend
2. **Filter sensitive data** - Remove phone numbers, names for Therapist
3. **Audit logs** - Log access attempts (future enhancement)
4. **Token validation** - Ensure tokens are validated on every request

---

## Testing Checklist

### Therapist:
- [ ] Cannot access `/clients` page
- [ ] Cannot access `/staff` page (except own profile)
- [ ] Cannot access `/pos` page
- [ ] Cannot access `/settings` page
- [ ] Can view only own appointments
- [ ] Cannot create appointments
- [ ] Can view dashboard without revenue
- [ ] Can request leaves but not approve
- [ ] Can use chat system
- [ ] Cannot see client personal data

### Receptionist:
- [ ] Can access `/clients` page
- [ ] Can access `/appointments` page
- [ ] Can access `/pos` page
- [ ] Can access `/attendance` page
- [ ] Cannot access `/staff` management
- [ ] Cannot access `/settings` page
- [ ] Can view dashboard with revenue

### Manager:
- [ ] Full access to all pages
- [ ] Can manage staff
- [ ] Can access settings
- [ ] Can approve leaves
- [ ] Can view all financial data
