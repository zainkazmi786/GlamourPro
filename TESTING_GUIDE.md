# Complete Testing Guide - Advanced Membership Management Module

This guide provides step-by-step instructions to test all features of the Advanced Membership Management Module.

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend
   npm start
   # Server should be running on http://localhost:5000
   ```

2. **Frontend Server Running**
   ```bash
   cd glamour-pro-forge
   npm run dev
   # Frontend should be running on http://localhost:8080
   ```

3. **Database Connected**
   - Ensure MongoDB is running and connected
   - Database should be accessible

4. **Staff Account**
   - You need a staff/admin account to access the admin panel
   - Login credentials should be available

---

## Phase 1: Setup & Configuration

### Step 1.1: Configure Business Settings

1. **Navigate to Settings**
   - Login as staff/admin
   - Go to **Settings** page (from sidebar)

2. **Configure Points System**
   - Find **Financial Settings** section
   - Set **Point Value**: `10` (PKR per point)
   - Set **Redemption Threshold**: `50` (minimum points required for redemption)
   - Click **Save**

3. **Verify Settings**
   - Refresh page
   - Confirm values are saved correctly

---

## Phase 2: Membership Tier Management

### Step 2.1: Create Membership Tiers

1. **Navigate to Memberships**
   - Go to **Memberships** page from sidebar

2. **Create Tier 1: Bronze**
   - Click **"Add New Tier"** button
   - Fill in:
     - **Name**: `Bronze`
     - **Discount %**: `5`
     - **Points per Session**: `10`
     - **Point Value**: `10`
     - **Redemption Threshold**: `50`
     - **Max Sessions Before Reset**: `10` (optional)
   - Click **"Create Tier"**
   - Verify tier appears in the list

3. **Create Tier 2: Silver**
   - Click **"Add New Tier"**
   - Fill in:
     - **Name**: `Silver`
     - **Discount %**: `10`
     - **Points per Session**: `20`
     - **Point Value**: `10`
     - **Redemption Threshold**: `50`
     - **Max Sessions Before Reset**: `15`
   - Click **"Create Tier"**

4. **Create Tier 3: Gold**
   - Click **"Add New Tier"**
   - Fill in:
     - **Name**: `Gold`
     - **Discount %**: `15`
     - **Points per Session**: `30`
     - **Point Value**: `10`
     - **Redemption Threshold**: `50`
     - **Max Sessions Before Reset**: `20`
   - Click **"Create Tier"**

### Step 2.2: Edit Membership Tier

1. Click **"Edit"** on any tier
2. Modify values (e.g., change discount from 10% to 12%)
3. Click **"Update Tier"**
4. Verify changes are reflected

### Step 2.3: Delete Membership Tier (Optional)

1. Click **"Delete"** on a tier
2. Confirm deletion
3. Verify tier is removed (only if no clients are using it)

---

## Phase 3: Client Management with Membership

### Step 3.1: Create Client with Membership

1. **Navigate to Clients**
   - Go to **Clients** page

2. **Create Test Client 1**
   - Click **"Add Client"**
   - Fill in:
     - **Name**: `John Doe`
     - **Phone**: `03001234567`
     - **Email**: `john@example.com`
     - **Membership**: Select `Bronze`
     - **RFID Number**: `RFID001` (optional but recommended for testing)
   - Click **"Create Client"**
   - Verify client is created

3. **Create Test Client 2**
   - Click **"Add Client"**
   - Fill in:
     - **Name**: `Jane Smith`
     - **Phone**: `03001234568`
     - **Email**: `jane@example.com`
     - **Membership**: Select `Silver`
     - **RFID Number**: `RFID002`
   - Click **"Create Client"**

4. **Create Test Client 3**
   - Click **"Add Client"**
   - Fill in:
     - **Name**: `Bob Wilson`
     - **Phone**: `03001234569`
     - **Email**: `bob@example.com`
     - **Membership**: Select `Gold`
     - **RFID Number**: `RFID003`
   - Click **"Create Client"**

### Step 3.2: View Client Profile

1. **Open Client Profile**
   - Find a client in the list
   - Click on the client card or **"View Profile"**

2. **Verify Information**
   - Check membership tier is displayed correctly
   - Verify points balance (should be 0 initially)
   - Verify total sessions (should be 0 initially)
   - Check membership details (discount %, points per session, etc.)

3. **Check Points History Tab**
   - Click **"Points History"** tab
   - Should show "No points history available" initially

---

## Phase 4: RFID Functionality

### Step 4.1: Test RFID Lookup in Appointment Booking

1. **Navigate to Appointments**
   - Go to **Appointments** page

2. **Start Creating Appointment**
   - Click **"Add Appointment"**

3. **Test RFID Input**
   - Find **"RFID Number"** field above client search
   - Enter `RFID001` (John Doe's RFID)
   - Press **Enter** or wait for auto-search
   - Verify:
     - Client is automatically selected
     - Client name appears
     - Membership tier is detected
     - Membership discount is calculated

4. **Test Invalid RFID**
   - Clear the field
   - Enter `RFID999` (non-existent)
   - Verify error message appears
   - Verify no client is selected

5. **Test RFID with Different Client**
   - Enter `RFID002` (Jane Smith)
   - Verify correct client is selected

---

## Phase 5: Appointment Booking with Points Redemption

### Step 5.1: Create Appointment with Points Redemption

1. **Navigate to Appointments**
   - Go to **Appointments** page
   - Click **"Add Appointment"**

2. **Select Client with Membership**
   - Use RFID or search for `John Doe`
   - Select the client
   - Verify membership tier is detected

3. **Add Service**
   - Select a service (e.g., "Haircut")
   - Select service variation
   - Set price (e.g., `2000` PKR)

4. **Test Points Redemption**
   - Scroll to **"Points to Redeem"** section
   - Enter points to redeem: `100`
   - Verify:
     - Available points shown (should be 0 initially)
     - Points discount calculated: `100 points × 10 PKR = 1000 PKR`
     - Total price updated with discount
   - **Note**: Since client has 0 points, this will fail validation

5. **Award Points First** (See Phase 6)
   - Complete an appointment first to earn points
   - Then come back to test redemption

---

## Phase 6: Points Awarding System

### Step 6.1: Create and Complete Appointment

1. **Create Appointment**
   - Go to **Appointments** page
   - Click **"Add Appointment"**

2. **Select Client**
   - Select `John Doe` (Bronze member)

3. **Add Service**
   - Select service and variation
   - Set price: `2000` PKR
   - **Do NOT redeem points** (leave at 0)

4. **Complete Appointment**
   - Fill in other required fields (staff, date, time)
   - Click **"Create Appointment"**

5. **Mark Appointment as Completed**
   - Find the appointment in the list
   - Click on it to view details
   - Change status to **"Completed"**
   - Save changes

6. **Verify Points Awarded**
   - Open **Clients** page
   - View `John Doe` profile
   - Check **Points Balance**: Should be `10` (Bronze tier: 10 points per session)
   - Check **Total Sessions**: Should be `1`
   - Go to **Points History** tab
   - Verify transaction:
     - Type: **Earned**
     - Points: **+10**
     
     - Description should mention appointment

### Step 6.2: Complete Multiple Appointments

1. **Create 2 More Appointments for John Doe**
   - Create appointments
   - Mark both as **"Completed"**

2. **Verify Accumulation**
   - View John Doe's profile
   - Points Balance: Should be `30` (10 + 10 + 10)
   - Total Sessions: Should be `3`
   - Points History: Should show 3 transactions

3. **Test with Different Tier**
   - Create appointment for `Jane Smith` (Silver tier)
   - Mark as completed
   - Verify:
     - Points Balance: `20` (Silver: 20 points per session)
     - Total Sessions: `1`

---

## Phase 7: Points Redemption

### Step 7.1: Redeem Points During Booking

1. **Ensure Client Has Points**
   - John Doe should have at least 50 points (redemption threshold)
   - If not, complete more appointments

2. **Create New Appointment**
   - Go to **Appointments**
   - Click **"Add Appointment"**
   - Select `John Doe`

3. **Add Service**
   - Select service
   - Set price: `2000` PKR

4. **Redeem Points**
   - In **"Points to Redeem"** field, enter `50`
   - Verify:
     - Available points shown correctly
     - Points discount: `50 × 10 = 500 PKR`
     - Total price: `2000 - 500 = 1500 PKR`
     - No validation errors

5. **Create Appointment**
   - Fill other fields
   - Click **"Create Appointment"**

6. **Verify Points Deducted**
   - View John Doe's profile
   - Points Balance: Should be reduced by 50
   - Points History: Should show redemption transaction
     - Type: **Redeemed**
     - Points: **-50**

### Step 7.2: Test Redemption Threshold

1. **Try Redeeming Below Threshold**
   - Create appointment for a client with 40 points
   - Try to redeem 30 points
   - Verify error message: "Minimum X points required for redemption"

2. **Try Redeeming More Than Available**
   - Client has 50 points
   - Try to redeem 60 points
   - Verify error message about insufficient points

---

## Phase 8: Session Reset Functionality

### Step 8.1: Reset Client Sessions

1. **Navigate to Memberships**
   - Go to **Memberships** page

2. **Find Member with Sessions**
   - Scroll to **"Members"** section
   - Find `John Doe` (should have 3+ sessions)

3. **Reset Sessions**
   - Click **"Reset Sessions"** button on John Doe's card
   - Confirm in the dialog
   - Verify success message

4. **Verify Reset**
   - View John Doe's profile
   - **Total Sessions**: Should be `0`
   - **Points Balance**: Should remain unchanged (points are not reset)
   - Check backend logs for `SessionResetLog` entry

---

## Phase 9: Client Portal - Registration & Login

### Step 9.1: Client Registration

1. **Navigate to Client Portal**
   - Open new browser tab/incognito
   - Go to: `http://localhost:8080/client-portal/register`

2. **Register Client**
   - **Phone**: `03001234567` (John Doe's phone)
   - **Password**: `password123`
   - **Confirm Password**: `password123`
   - Click **"Register"**

3. **Verify**
   - Should redirect to dashboard
   - Should see client profile information
   - Should see membership tier details

4. **Test Registration Validation**
   - Try registering with non-member phone number
   - Should show error: "Only clients with active membership can register"

### Step 9.2: Client Login

1. **Logout** (if logged in)
   - Click logout button

2. **Login**
   - Go to: `http://localhost:8080/client-portal/login`
   - **Phone**: `03001234567`
   - **Password**: `password123`
   - Click **"Login"**

3. **Verify**
   - Should redirect to dashboard
   - Should see client information

4. **Test Invalid Credentials**
   - Try wrong password
   - Should show error message

---

## Phase 10: Client Portal - Dashboard

### Step 10.1: View Dashboard

1. **Access Dashboard**
   - After login, should be on dashboard
   - URL: `http://localhost:8080/client-portal/dashboard`

2. **Verify Information Displayed**
   - **Membership Tier**: Should show "Bronze Member (5% discount)"
   - **Points Balance**: Should show current balance
   - **Total Sessions**: Should show session count
   - **Membership Discount**: Should show discount percentage

3. **Check Recent Activity**
   - **Recent Appointments**: Should list recent appointments
   - **Recent Points Activity**: Should show recent transactions

---

## Phase 11: Client Portal - Points History

### Step 11.1: View Points History

1. **Navigate to Points**
   - Click **"Points"** in sidebar
   - URL: `http://localhost:8080/client-portal/points`

2. **Verify Display**
   - **Current Points Balance**: Should be displayed prominently
   - **Transaction History**: Should list all transactions
   - Each transaction should show:
     - Type (Earned/Redeemed)
     - Points amount (+/-)
     - Description
     - Date and time
     - Associated appointment (if any)

3. **Test Pagination** (if many transactions)
   - Scroll to bottom
   - Should see pagination controls if more than 50 transactions

---

## Phase 12: Client Portal - Appointments

### Step 12.1: View Appointment History

1. **Navigate to Appointments**
   - Click **"Appointments"** in sidebar
   - URL: `http://localhost:8080/client-portal/appointments`

2. **Verify Display**
   - Should list all client's appointments
   - Each appointment should show:
     - Date and time
     - Service name
     - Staff name
     - Status
     - Price information
     - Points used (if any)
     - Points awarded (if any)

3. **Test Filtering**
   - Filter by status (Upcoming, Completed, Cancelled)
   - Verify list updates

---

## Phase 13: Client Portal - Billing

### Step 13.1: View Payment History

1. **Navigate to Billing**
   - Click **"Billing"** in sidebar
   - URL: `http://localhost:8080/client-portal/billing`

2. **Verify Display**
   - Should list all payments
   - Each payment should show:
     - Date
     - Amount
     - Payment method
     - Status
     - Associated appointment
     - Discount applied (if any)
     - Points discount (if any)

---

## Phase 14: Client Portal - Profile Management

### Step 14.1: View Profile

1. **Navigate to Profile**
   - Click **"Profile"** in sidebar
   - URL: `http://localhost:8080/client-portal/profile`

2. **Verify Information**
   - Personal information (name, phone, email)
   - Membership details
   - Points and sessions summary

### Step 14.2: Change Password

1. **Change Password**
   - Scroll to **"Change Password"** section
   - **Current Password**: `password123`
   - **New Password**: `newpassword123`
   - **Confirm New Password**: `newpassword123`
   - Click **"Update Password"**

2. **Verify**
   - Should show success message
   - Logout and login with new password
   - Should work correctly

---

## Phase 15: Integration Testing

### Step 15.1: Complete End-to-End Flow

1. **Create Client with Membership**
   - Create new client with Gold membership
   - Assign RFID: `RFID004`

2. **Book Appointment with RFID**
   - Use RFID scanner/input
   - Select client automatically
   - Add service (price: 3000 PKR)
   - Verify membership discount applied (15% = 450 PKR)

3. **Complete Appointment**
   - Mark appointment as completed
   - Verify 30 points awarded (Gold tier)

4. **Redeem Points in Next Appointment**
   - Book another appointment
   - Redeem 50 points (500 PKR discount)
   - Complete appointment
   - Verify points deducted and new points awarded

5. **Client Portal Access**
   - Register client in portal
   - Login
   - Verify all information matches
   - Check points history shows all transactions

6. **Reset Sessions**
   - As admin, reset client sessions
   - Verify in client portal that sessions reset to 0

---

## Phase 16: Edge Cases & Error Handling

### Step 16.1: Test Edge Cases

1. **Client Without Membership**
   - Create appointment for client without membership
   - Verify no membership discount applied
   - Complete appointment
   - Verify no points awarded

2. **Points Redemption at Threshold**
   - Client has exactly 50 points
   - Try to redeem 50 points
   - Should work (meets threshold)

3. **Multiple Redemptions**
   - Client has 100 points
   - Book appointment, redeem 50 points
   - Book another appointment, redeem 50 points
   - Verify both redemptions work
   - Verify points balance is 0

4. **Appointment Status Changes**
   - Create appointment
   - Mark as completed (points awarded)
   - Change status back to "Pending"
   - Verify points are reversed
   - Change to "Completed" again
   - Verify points awarded again

5. **Invalid RFID**
   - Try booking with invalid RFID
   - Should show error, not crash

6. **Client Portal - Unauthorized Access**
   - Try accessing `/client-portal/dashboard` without login
   - Should redirect to login page

---

## Verification Checklist

After completing all phases, verify:

- [ ] Membership tiers can be created, edited, and deleted
- [ ] Clients can be assigned membership tiers
- [ ] RFID lookup works correctly
- [ ] Points are awarded when appointments are completed
- [ ] Points can be redeemed during booking
- [ ] Redemption threshold is enforced
- [ ] Session count increments correctly
- [ ] Sessions can be reset by admin
- [ ] Points history is tracked correctly
- [ ] Client portal registration works
- [ ] Client portal login works
- [ ] Client portal dashboard displays correct information
- [ ] Points history is visible in client portal
- [ ] Appointment history is visible in client portal
- [ ] Billing history is visible in client portal
- [ ] Password change works in client portal
- [ ] All calculations (discounts, points) are correct
- [ ] Error messages are user-friendly
- [ ] No console errors in browser
- [ ] No errors in backend logs

---

## Troubleshooting

### Common Issues

1. **Points Not Awarded**
   - Check appointment status is "Completed"
   - Verify client has active membership
   - Check backend logs for errors

2. **RFID Not Working**
   - Verify RFID number is saved in client profile
   - Check API endpoint is accessible
   - Verify client exists in database

3. **Client Portal Login Fails**
   - Verify client has active membership
   - Check phone number matches exactly
   - Verify password is correct
   - Check backend logs

4. **Points History Not Showing**
   - Verify appointments are marked as completed
   - Check PointsHistory collection in database
   - Verify API endpoint returns data

5. **Redemption Not Working**
   - Verify client has enough points
   - Check redemption threshold in business settings
   - Verify points calculation is correct

---

## Database Verification (Optional)

If you want to verify data directly in MongoDB:

```javascript
// Check membership tiers
db.membershiptiers.find()

// Check clients with membership
db.clients.find({ membership_id: { $ne: null } })

// Check points history
db.pointshistories.find().sort({ createdAt: -1 })

// Check session reset logs
db.sessionresetlogs.find().sort({ resetDate: -1 })

// Check client auth
db.clientauths.find()
```

---

## Notes

- All prices are in PKR (Pakistani Rupees)
- Point value is configurable in Business Settings
- Redemption threshold is configurable in Business Settings
- Points per session varies by membership tier
- Membership discount is applied automatically during booking
- Points are only awarded when appointment status changes to "Completed"
- Sessions reset does not affect points balance

---

## Support

If you encounter any issues during testing:
1. Check browser console for errors
2. Check backend terminal for errors
3. Verify database connection
4. Verify all environment variables are set
5. Check API endpoints are correct

Happy Testing! 🎉
